import os
from datetime import datetime
from typing import List, Optional, Type
from sqlalchemy.orm import Session
from fastapi import HTTPException
from sqlalchemy import and_
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_mistralai import ChatMistralAI
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from src.backend.database import get_db, Message, UserCalendar
from src.config.config import Config
from src.google_calendar.google_calendar import list_calendar_events, create_calendar_event, delete_calendar_event, \
    update_calendar_event
from src.speed_tool.speed import get_speed_test_results
from src.utlis.logging_config import get_logger
import requests
from src.ocr.main_ocr import read_from_image
from src.utlis.utility import convert_to_messages

logger = get_logger(__name__)

"""
load_dotenv()
mistral_api_key = os.getenv("MISTRAL_API_KEY")
model_provider = os.getenv("MODEL_PROVIDER", "mistral").lower()
ollama_model = os.getenv("OLLAMA_MODEL", "llama3")
ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
openrouter_model = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat-v3-0324:free")  # Default OpenRouter model
openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
"""


class LLMInterface:
    def __init__(self):
        self.config = Config()
        self.tools = [
            list_calendar_events, create_calendar_event, delete_calendar_event,
            update_calendar_event, read_from_image, get_speed_test_results
        ]
        self.mistral_llm = None
        self.llm = self._initialize_llm()

    def _initialize_llm(self) -> Optional[ChatMistralAI | ChatOpenAI | ChatOllama]:
        self.system_prompt = """
        You are a helpful AI Agent. The current date and time is {now}. The needed timezone is UTC+4 (Europe/Samara).

        Your primary function is to assist with managing events in Google Calendar based on user requests. You can:
        - View upcoming or specific events in Google Calendar using the `list_calendar_events` tool and providing user_id: {user_id} while calling `list_calendar_events`.
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
           - Format `start_datetime` and `end_datetime` in RFC3339 format (e.g., '2025-07-13T15:00:00+04:00').
           - Invoke the `create_calendar_event` tool with user_id: {user_id}

        2. For requests to update an event (e.g., "Update the meeting"):
           - Always invoke `list_calendar_events` first to fetch the list of events for the relevant date or period.
           - Display the list of events with their titles, dates, times, and event IDs to the user.
           - Ask the user to specify the event ID or title of the event to update and confirm the changes (e.g., "Please provide the event ID or title and the fields to update, such as time or description.").
           - Do not invoke `update_calendar_event` until the user confirms the event ID and changes.
           - Do not invent or assume event IDs. Use only IDs retrieved from `list_calendar_events`.
           - If no matching event is found, inform the user and suggest checking the event details or date range.
           - Prompt for missing information if needed (e.g., "Please specify the new time or duration").
           - Invoke the `update_calendar_event` tool with user_id: {user_id}

        3. For requests to delete an event (e.g., "Delete the meeting"):
           - Always invoke `list_calendar_events` first to fetch the list of events for the relevant date or period.
           - Display the list of events with their titles, dates, times, and event IDs to the user.
           - Ask the user to confirm the event ID or title of the event to delete (e.g., "Please confirm the event ID or title of the event to delete."). Always ask the user to confirm deletion!
           - Do not invoke `delete_calendar_event` until the user confirms the event ID.
           - Do not invent or assume event IDs. Use only IDs retrieved from `list_calendar_events`.
           - If no matching event is found, inform the user and suggest checking the event details or date range.
           - Invoke the `delete_calendar_event` tool with user_id: {user_id}

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
        12. For requests related to speed test results (e.g., "Show my speed test results" or "What were my last tapping speed tests?"):
            - Invoke the `get_speed_test_results` tool with user_id: {user_id}
            - Do NOT ask the user for a user ID, as it is handled automatically.
            - DO NOT reveal the user ID to user.
            - The tool will return a formatted string with results, including stream speed, unstable rate, timestamp, taps, and time.
            - If no results are found, inform the user (e.g., "No speed test results found for your account").
            - If an error occurs, inform the user (e.g., "Failed to retrieve speed test results").
            - Remember that Unstable rate (UR) is a measurement of variation of hit errors throughout a play. 
            It is calculated as the standard deviation of hit errors, displayed in tenths of a millisecond. 
            A lower UR indicates that the player's hits have more similar errors, while a higher UR indicates they are more spread apart.
            - Example output:
              "Here are your speed test results:
               1. Timestamp: 2025-07-20T10:00:00, Stream Speed: 170 BPM, Unstable Rate: 125.4, Taps: 10, Time: 10 sec
               2. Timestamp: 2025-07-19T15:30:00, Stream Speed: 200 BPM, Unstable Rate: 150.2, Taps: 12, Time: 13 sec"

        Example workflow for update/delete:
        - User: "Update the meeting"
        - Agent: Invokes `list_calendar_events`, shows events (e.g., "1. Meeting A, 2025-07-15 10:00, ID: 14gngu8rb71tkam27fk1to08jv"), asks, "Which event would you like to update? Please provide the event ID or title and the changes."
        - User: "Update event ID 14gngu8rb71tkam27fk1to08jv to start at 11:00"
        - Agent: Confirms, "Do you want to update 'Meeting A' (ID: 14gngu8rb71tkam27fk1to08jv) to start at 11:00 on 2025-07-15?" and proceeds only after confirmation.
        """
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
            #return mistral_llm, ChatOpenAI(model=openrouter_model, api_key=openrouter_api_key,
            #                               base_url="https://openrouter.ai/api/v1")
        elif self.config.MODEL_PROVIDER == "mistral":
            if not self.config.MISTRAL_API_KEY:
                raise ValueError("MISTRAL_API_KEY not found in .env file")
            logger.info("Using Mistral AI API")
            return ChatMistralAI(api_key=self.config.MISTRAL_API_KEY, model="mistral-medium-latest")
            # return mistral_llm, ChatMistralAI(api_key=mistral_api_key, model="mistral-medium-latest")
        elif self.config.MODEL_PROVIDER == "ollama":
            logger.info(f"Using Ollama with model {self.config.OLLAMA_MODEL} at {self.config.OLLAMA_HOST}")
            return ChatOllama(model=self.config.OLLAMA_MODEL, base_url=self.config.OLLAMA_HOST)
            # return mistral_llm, ChatOllama(model=ollama_model, base_url=ollama_host)
        else:
            raise ValueError("Unsupported MODEL_PROVIDER. Use 'mistral', 'openrouter', or 'ollama'.")

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

        # промпт
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=self.system_prompt.format(now=now,
                                                            user_id=user_id
                                                            )),
                                                            # calendar_id=calendar_id)),
            MessagesPlaceholder(variable_name="messages"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        agent_executor = self.create_agent_executor(self.llm, self.tools, prompt)

        messages = convert_to_messages(history)

        # Добавление нового вопроса
        messages.append(HumanMessage(content=question))
        try:
            response = agent_executor.invoke({
                "messages": messages,
            })
            messages.append(SystemMessage(content=response["output"]))
            print(response["output"])
            return response["output"]
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429 and self.config.MODEL_PROVIDER == "openrouter" and self.mistral_llm:
                logger.warning("OpenRouter rate limit exceeded, falling back to Mistral")
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
            else:
                logger.error(f"Error invoking agent: {str(e)}")
                print(f"Error: Failed to process request due to {str(e)}. Please check your connection or try again.")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            print(f"Error: An unexpected error occurred: {str(e)}. Please try again.")


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
