import os
from datetime import datetime
from typing import List, Optional, Type
from sqlalchemy import and_
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers.string import StrOutputParser
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_mistralai import ChatMistralAI
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from httpx import HTTPStatusError
from openai import RateLimitError

from src.backend.database import get_db, Message
from src.config.config import Config
from src.google_calendar.google_calendar import list_calendar_events, create_calendar_event, delete_calendar_event, \
    update_calendar_event
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
            update_calendar_event, read_from_image
        ]
        self.mistral_llm = None
        self.llm = self._initialize_llm()

    def _initialize_llm(self) -> Optional[ChatMistralAI | ChatOpenAI | ChatOllama]:
        self.system_prompt = """
        You are a helpful AI Agent. The current date and time is {now}. The needed timezone is UTC+4 (Europe/Samara).

        Your primary function is to assist with managing events in Google Calendar based on user requests. You can:
        - View upcoming or specific events in Google Calendar using the `list_calendar_events` tool.
        - Add new events to Google Calendar using the `create_calendar_event` tool with details like title, date, time, description, and attendees.
        - Update existing events in Google Calendar (e.g., change time, title, or other details)  using the `update_calendar_event` tool.
        - Delete events from Google Calendar using the `delete_calendar_event` tool with the event ID.
        - Provide a summary of events for a specific date or period.

        Instructions:
        1. For requests to create an event (e.g., "Add a meeting"):
           - Summarize the event details (e.g., title, date, time, location, description, attendees) and ask the user to confirm (e.g., "Do you want to create an event called 'Meeting' on [date] at [time] with these details?").
           - Do not invoke `create_calendar_event` until the user confirms.
           - If details are incomplete (e.g., no end time or description), assume reasonable defaults:
             - End time: 1 hour after start time unless specified.
             - Description: Empty string unless specified.
             - Location: None unless specified.
             - Attendees: Empty list unless specified.
           - Prompt for missing information if critical (e.g., "Please specify the time or duration for the event").
           - Format `start_datetime` and `end_datetime` in RFC3339 format (e.g., '2025-07-13T15:00:00+04:00') and use the calendar ID 'bb5dc868e699caa679f120036d22a69dac91a6a32e79eaab345abfe42e61740e@group.calendar.google.com'.

        2. For requests to update an event (e.g., "Update the meeting"):
           - Always invoke `list_calendar_events` first to fetch the list of events for the relevant date or period.
           - Display the list of events with their titles, dates, times, and event IDs to the user.
           - Ask the user to specify the event ID or title of the event to update and confirm the changes (e.g., "Please provide the event ID or title and the fields to update, such as time or description.").
           - Do not invoke `update_calendar_event` until the user confirms the event ID and changes.
           - Do not invent or assume event IDs. Use only IDs retrieved from `list_calendar_events`.
           - If no matching event is found, inform the user and suggest checking the event details or date range.
           - Prompt for missing information if needed (e.g., "Please specify the new time or duration").

        3. For requests to delete an event (e.g., "Delete the meeting"):
           - Always invoke `list_calendar_events` first to fetch the list of events for the relevant date or period.
           - Display the list of events with their titles, dates, times, and event IDs to the user.
           - Ask the user to confirm the event ID or title of the event to delete (e.g., "Please confirm the event ID or title of the event to delete."). Always ask the user to confirm deletion!
           - Do not invoke `delete_calendar_event` until the user confirms the event ID.
           - Do not invent or assume event IDs. Use only IDs retrieved from `list_calendar_events`.
           - If no matching event is found, inform the user and suggest checking the event details or date range.

        4. For schedule-related requests (e.g., "What's my schedule tomorrow?"):
           - Use the `list_calendar_events` tool to query Google Calendar for the relevant date or period.
           - Present the events in a clear, concise format, including titles, dates, times, and event IDs.
        5. For vague requests, ask clarifying questions (e.g., "Which date or time range would you like to check?").																	 
        6. Ensure all dates and times are interpreted relative to {now} in the UTC+4 timezone unless otherwise specified.
        7. If an error occurs (e.g., no access to Google Calendar), inform the user politely and suggest checking the connection.
        8. Event IDs are strings like '14gngu8rb71tkam27fk1to08jv' or '35gc50jmu343lm0jga3adge1or'. Never generate or assume an event ID without fetching it via `list_calendar_events`.
        9. Respond clearly and concisely in natural language, ensuring all actions (create, update, delete) are confirmed by the user before execution.
        10. If the user provides incomplete details for creating or updating an event, prompt for missing information before proceeding.
        11. Use the `read_from_image` tool to extract text from images. The tool accepts a local image path or URL and a list of languages (e.g., ['en', 'ja']). 
            - If the user requests translation (e.g., "Translate text from image.png"), extract the text and translate it (e.g., to Russian).
            - If the text contains dates or event details (e.g., "Meeting 2025-07-20"), suggest creating a calendar event and ask for confirmation.
            - Handle errors gracefully and inform the user (e.g., "Failed to process image").

        Example workflow for update/delete:
        - User: "Update the meeting"
        - Agent: Invokes `list_calendar_events`, shows events (e.g., "1. Meeting A, 2025-07-15 10:00, ID: 14gngu8rb71tkam27fk1to08jv"), asks, "Which event would you like to update? Please provide the event ID or title and the changes."
        - User: "Update event ID 14gngu8rb71tkam27fk1to08jv to start at 11:00"
        - Agent: Confirms, "Do you want to update 'Meeting A' (ID: 14gngu8rb71tkam27fk1to08jv) to start at 11:00 on 2025-07-15?" and proceeds only after confirmation.
        """

        self.tools = [list_calendar_events, create_calendar_event, delete_calendar_event, update_calendar_event,
                 read_from_image]
        if self.config.MISTRAL_API_KEY:
            self.mistral_llm = ChatMistralAI(api_key=self.config.MISTRAL_API_KEY, model="mistral-medium-latest")
            logger.info("Mistral fallback LLM initialized")
        else:
            logger.warning("MISTRAL_API_KEY not found in .env file, Mistral fallback unavailable")

        if self.config.MODEL_PROVIDER == "openrouter":
            if not self.config.OPENROUTER_API_KEY:
                if self.mistral_llm:
                    logger.warning("OPENROUTER_API_KEY not found, falling back to Mistral")
                    return self.mistral_llm
                raise ValueError("OPENROUTER_API_KEY not found and no Mistral fallback available")
            logger.info(f"Using OpenRouter API with model {self.config.OPENROUTER_MODEL}")
            return ChatOpenAI(model=self.config.OPENROUTER_MODEL, api_key=self.config.OPENROUTER_API_KEY,
                                           base_url="https://openrouter.ai/api/v1")
        elif self.config.MODEL_PROVIDER == "mistral":
            if not self.config.MISTRAL_API_KEY:
                raise ValueError("MISTRAL_API_KEY not found in .env file")
            logger.info("Using Mistral AI API")
            return ChatMistralAI(api_key=self.config.MISTRAL_API_KEY, model="mistral-medium-latest")
        elif self.config.MODEL_PROVIDER == "ollama":
            logger.info(f"Using Ollama with model {self.config.OLLAMA_MODEL} at {self.config.OLLAMA_HOST}")
            return ChatOllama(model=self.config.OLLAMA_MODEL, base_url=self.config.OLLAMA_HOST)
        else:
            raise ValueError("Unsupported MODEL_PROVIDER. Use 'mistral', 'openrouter', or 'ollama'.")

    @staticmethod
    def create_agent_executor(llm, tools, prompt):
        try:
            agent = create_tool_calling_agent(llm=llm, tools=tools, prompt=prompt)
            return AgentExecutor(agent=agent, tools=tools, verbose=True)
        except Exception as e:
            logger.error(f"Failed to create agent with LLM: {str(e)}")
            raise

    def generate(self, question: str, history: List[Type[Message]],
                 context: List[dict], language: str) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=self.system_prompt.format(now=now)),
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
                agent_executor = self.create_agent_executor(self.llm, self.tools, prompt)
                try:
                    response = agent_executor.invoke({
                        "messages": messages,
                    })
                    messages.append(SystemMessage(content=response["output"]))
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
            logger.error(f"Unexpected error in generate: {e}")
            return f"An unexpected error occurred while processing your request: {str(e)}"
    
        # --- НОВЫЙ АСИНХРОННЫЙ МЕТОД ---
    async def agenerate(self, question: str, history: List[Type[Message]],
                        context: List[dict], language: str) -> str:
        """Асинхронная версия метода generate."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=self.system_prompt.format(now=now)),
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
            print("ПОЙМАЛИ КАБАЛА")
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
                agent_executor = self.create_agent_executor(self.llm, self.tools, prompt)
                try:
                    response = agent_executor.invoke({
                        "messages": messages,
                    })
                    messages.append(SystemMessage(content=response["output"]))
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
            logger.error(f"Unexpected error in agenerate: {e}")
            return f"An unexpected error occurred while processing your request: {str(e)}"
        
           
    async def agenerate_response_from_context(self, question: str, context: str, history: List[Type[Message]]) -> str:
        """
        Генерирует ответ, напрямую используя предоставленный контекст, без логики Агента.
        """
        logger.info("Generating response directly from provided RAG context.")
        
        # Простой промпт, который заставляет модель использовать контекст
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful assistant. Answer the user's question based ONLY on the following context:\n\n--- CONTEXT ---\n{context}\n--- END CONTEXT ---"),
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
            print("ПОЙМАЛИ КАБАЛА")
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