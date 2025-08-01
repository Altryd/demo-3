import os
from datetime import datetime
from typing import List, Optional, Type
from sqlalchemy.orm import Session
from fastapi import HTTPException
from sqlalchemy import and_
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers.string import StrOutputParser
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_mistralai import ChatMistralAI
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from openai import RateLimitError

from src.backend.database import get_db, Message, UserCalendar
from src.config.config import Config
from src.google_calendar.google_calendar import list_calendar_events, create_calendar_event, delete_calendar_event, \
    update_calendar_event
from src.llm.prompts import BASE_PROMPT, SYSTEM_PROMPT_CALENDAR, SYSTEM_PROMPT_OCR, SYSTEM_PROMPT_SPEED_TEST
from src.speed_tool.speed import get_speed_test_results
from src.utlis.logging_config import get_logger
import requests
from src.ocr.main_ocr import read_from_image
from src.utlis.utility import convert_to_messages

logger = get_logger(__name__)


class LLMInterface:
    def __init__(self):
        self.config = Config()
        self.tools = [
            list_calendar_events, create_calendar_event, delete_calendar_event,
            update_calendar_event, read_from_image, get_speed_test_results
        ]
        self.mistral_llm = self._initialize_mistral_fallback()
        self.llm = self._initialize_llm()

    def _initialize_llm(self) -> Optional[ChatMistralAI | ChatOpenAI | ChatOllama]:
        logger.info(f"Initializing LLM with provider: {self.config.MODEL_PROVIDER}")

        if self.config.MODEL_PROVIDER == "openrouter":
            if not self.config.OPENROUTER_API_KEY:
                if self.mistral_llm:
                    logger.warning("OPENROUTER_API_KEY not found, falling back to Mistral")
                    return self._initialize_mistral_fallback()
                raise ValueError("OPENROUTER_API_KEY not found and no Mistral fallback available")
            logger.info(f"Using OpenRouter API with model {self.config.OPENROUTER_MODEL}")
            return ChatOpenAI(model=self.config.OPENROUTER_MODEL, api_key=self.config.OPENROUTER_API_KEY,
                              base_url="https://openrouter.ai/api/v1")
        elif self.config.MODEL_PROVIDER == "mistral":
            if not self.config.MISTRAL_API_KEY:
                raise ValueError("MISTRAL_API_KEY not found in .env file")
            return ChatMistralAI(api_key=self.config.MISTRAL_API_KEY, model="mistral-medium-latest")
        elif self.config.MODEL_PROVIDER == "ollama":
            logger.info(f"Using Ollama with model {self.config.OLLAMA_MODEL} at {self.config.OLLAMA_HOST}")
            return ChatOllama(model=self.config.OLLAMA_MODEL, base_url=self.config.OLLAMA_HOST)
        else:
            raise ValueError("Unsupported MODEL_PROVIDER. Use 'mistral', 'openrouter', or 'ollama'.")

    def _initialize_mistral_fallback(self) -> Optional[ChatMistralAI]:
        """Initialize Mistral LLM as a fallback."""
        if not self.config.MISTRAL_API_KEY:
            raise ValueError("MISTRAL_API_KEY not found and no Mistral fallback available")
        logger.info("Mistral fallback LLM initialized")
        return ChatMistralAI(api_key=self.config.MISTRAL_API_KEY, model="mistral-medium-latest")

    def _handle_llm_error(self, error: Exception, backup_llm: Optional[ChatMistralAI], prompt, messages: List) -> str:
        """Handle LLM-related errors with fallback to Mistral if available."""
        status_code = None
        if isinstance(error, RateLimitError):
            status_code = 429
        elif isinstance(error, requests.exceptions.HTTPError):
            status_code = getattr(error, 'response', None).status_code

        if status_code and status_code >= 400 and self.config.MODEL_PROVIDER == "openrouter" and backup_llm:
            logger.warning(f"OpenRouter error (status {status_code}): {error}, falling back to Mistral")
            self.llm = backup_llm
            try:
                agent_executor = self.create_agent_executor(self.llm, self.tools, prompt)
                response = agent_executor.invoke({"messages": messages})
                return response.get("output", "Sorry, I encountered an issue and couldn't provide a response.")
            except Exception as fallback_e:
                logger.error(f"Mistral fallback failed: {str(fallback_e)}")
                return "Error: OpenRouter rate limit exceeded and Mistral fallback failed. Please try again later."

        logger.error(f"LLM error: {str(error)}")
        if status_code == 429:
            return "The AI model is currently rate-limited. Please try again in a few moments."
        return f"A network error occurred: {str(error)}"

    @staticmethod
    def create_agent_executor(llm, tools, prompt):
        """Create an AgentExecutor with the given LLM, tools, and prompt."""
        try:
            agent = create_tool_calling_agent(llm=llm, tools=tools, prompt=prompt)
            return AgentExecutor(agent=agent, tools=tools, verbose=True)
        except Exception as e:
            logger.error(f"Failed to create agent with LLM: {str(e)}")
            raise

    def generate(self, db: Session, question: str, history: List[Type[Message]],
                 context: List[dict], language: str, user_id: Optional[int] = None,
                 chat_id: Optional[int] = None) -> str:
                 # calendar_id: str = "") -> str:
        if not db:
            raise ValueError("Database session is required")

            # Проверка, что chat_id принадлежит user_id
        if user_id is not None and chat_id is not None:
            from src.backend.database import Chat
            chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            if not chat:
                logger.error(f"Chat ID {chat_id} does not belong to user ID {user_id}")
                raise HTTPException(status_code=403, detail="Chat does not belong to user")

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")
        formatted_system_prompt = (
                BASE_PROMPT +
                SYSTEM_PROMPT_CALENDAR +
                SYSTEM_PROMPT_OCR +
                SYSTEM_PROMPT_SPEED_TEST
        ).format(now=now, user_id=user_id)

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=formatted_system_prompt),
            MessagesPlaceholder(variable_name="messages"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        agent_executor = self.create_agent_executor(self.llm, self.tools, prompt)

        messages = convert_to_messages(history)
        messages.append(HumanMessage(content=question))

        try:
            response = agent_executor.invoke({"messages": messages})
            return response.get("output", "Sorry, I encountered an issue and couldn't provide a response.")
        
        except (requests.exceptions.HTTPError, RateLimitError) as e:
            return self._handle_llm_error(e, self.mistral_llm, prompt, messages)
        
        except Exception as e:
            logger.error(f"Unexpected error in generate: {e}")
            return f"An unexpected error occurred while processing your request: {str(e)}"
    
    async def agenerate(self, question: str, history: List[Type[Message]],
                        user_id: int, context: List[dict], language: str) -> str:
        """Асинхронная версия метода generate."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")

        formatted_system_prompt = (
                BASE_PROMPT +
                SYSTEM_PROMPT_CALENDAR +
                SYSTEM_PROMPT_OCR +
                SYSTEM_PROMPT_SPEED_TEST
        ).format(now=now, user_id=user_id)

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=formatted_system_prompt),
            MessagesPlaceholder(variable_name="messages"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        agent_executor = self.create_agent_executor(self.llm, self.tools, prompt)

        messages = convert_to_messages(history)
        messages.append(HumanMessage(content=question))

        try:
            # Используем асинхронный вызов .ainvoke()
            response = await agent_executor.ainvoke({"messages": messages})
            return response.get("output", "Sorry, I encountered an issue and couldn't provide a response.")
        
        except (requests.exceptions.HTTPError, RateLimitError) as e:
            return self._handle_llm_error(e, self.mistral_llm, prompt, messages)
        
        except Exception as e:
            logger.error(f"Unexpected error in agenerate: {e}")
            return f"An unexpected error occurred while processing your request: {str(e)}"

    async def agenerate_response_from_context(self, question: str, context: str, history: List[Type[Message]]) -> str:
        """
        Генерирует ответ, напрямую используя предоставленный контекст, без логики Агента.
        """
        logger.info("Generating response directly from provided RAG context.")
        
        # Простой промпт, который заставляет модель использовать контекст
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful assistant. "
                       "Answer the user's question based ONLY on the following context:"
                       "\n\n--- CONTEXT ---\n{context}\n--- END CONTEXT ---"),
            MessagesPlaceholder(variable_name="history"),
            ("user", "{question}")
        ])
        
        # Создаем простую цепочку: промпт -> модель -> парсер ответа
        chain = prompt_template | self.llm | StrOutputParser()
        
        formatted_history = convert_to_messages(history)

        try:
            # Вызываем цепочку напрямую
            response = await chain.ainvoke({
                "context": context,
                "history": formatted_history,
                "question": question
            })
            return response
        
        except (requests.exceptions.HTTPError, RateLimitError) as e:
            status_code = None
            if isinstance(e, requests.exceptions.HTTPError):
                status_code = e.response.status_code
            elif isinstance(e, RateLimitError):
                status_code = 429
            if status_code >= 400 and self.config.MODEL_PROVIDER == "openrouter" and self.mistral_llm:
                if status_code == 429:
                    logger.warning("OpenRouter rate limit exceeded, falling back to Mistral")
                else:
                    logger.warning(f"Unknown error in OpenRouter: {e}, falling back to Mistral")
                self.llm = self.mistral_llm
                chain = prompt_template | self.llm | StrOutputParser()
                
                try:
                    response = await chain.ainvoke({
                        "context": context,
                        "history": formatted_history,
                        "question": question
                        })
                    return response
                    print(response["output"])
                    return response["output"]
                except Exception as fallback_e:
                    logger.error(f"Mistral fallback failed: {str(fallback_e)}")
                    print("Error: OpenRouter rate limit exceeded and Mistral fallback failed. Please try again later.")
                    return "Error: OpenRouter rate limit exceeded and Mistral fallback failed. Please try again later."
            logger.error(f"HTTPError invoking agent: {str(e)}")
            if e.response.status_code == 429:
                return "The AI model is currently rate-limited. Please try again in a few moments."
            return f"A network error occurred: {str(e)}"
        
        except Exception as e:
            logger.error(f"Unexpected error in agenerate_response_from_context: {e}")
            return f"An unexpected error occurred while generating a response from the document: {str(e)}"


if __name__ == "__main__":
    with get_db() as db:
        chat_id = 1
        chat_messages = db.query(Message).filter(
            and_(
                Message.is_deleted == False,
                Message.chat_id == chat_id)).all()
        llm_interface = LLMInterface()
        while True:
            user_input = input(
                "\nВведите ваш запрос (например, 'What's my schedule tomorrow?' или 'Add a meeting tomorrow at 3 PM'): "
                "Чтобы выйти - напишите exit\n")
            if user_input.lower() == "exit":
                break
            llm_interface.generate(user_input, chat_messages, [], "en")
            print("pass")
            