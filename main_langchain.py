import os
from datetime import datetime
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_mistralai import ChatMistralAI
from langchain_community.chat_models import ChatOllama
from dotenv import load_dotenv
from langchain_tools import list_calendar_events, create_calendar_event, delete_calendar_event, update_calendar_event
from logging_config import get_logger


logger = get_logger(__name__)

load_dotenv()
api_key = os.getenv("MISTRAL_API_KEY")
model_provider = os.getenv("MODEL_PROVIDER", "mistral").lower()  # По умолчанию Mistral
ollama_model = os.getenv("OLLAMA_MODEL", "llama3")
ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")

if model_provider == "mistral":
    if not api_key:
        raise ValueError("MISTRAL_API_KEY not found in .env file")
    llm = ChatMistralAI(api_key=api_key, model="mistral-medium-latest")
    logger.info("Using Mistral AI API")
elif model_provider == "ollama":
    llm = ChatOllama(model=ollama_model, base_url=ollama_host)
    logger.info(f"Using Ollama with model {ollama_model} at {ollama_host}")
else:
    raise ValueError("Unsupported MODEL_PROVIDER. Use 'mistral' or 'ollama'.")

system_prompt = """
You are a helpful AI Agent. The current date and time is {now}. The needed timezone is UTC+4 (Europe/Samara).

Your primary function is to assist with managing events in Google Calendar based on user requests. You can:
- View upcoming or specific events in Google Calendar using the `list_calendar_events` tool.
- Add new events to Google Calendar using the `create_calendar_event` tool with details like title, date, time, description, and attendees.
- Update existing events in Google Calendar (e.g., change time, title, or other details).
- Delete events from Google Calendar using the `delete_calendar_event` tool with the event ID.
- Provide a summary of events for a specific date or period.

Instructions:
1. For requests to add or create an event (e.g., "Add a meeting"), confirm the user's intent by summarizing the event details (e.g., "Do you want to create an event called 'Meeting' on [date] at [time]?").
2. For requests to delete an event (e.g., "Delete the meeting"), first use `list_calendar_events` to fetch the list of events. 
Show the user a list of events with their titles, dates, and event IDs. Ask the user to confirm which event to delete by providing the event ID or title.
3. For requests to update an event (e.g., "Update the meeting"), first use `list_calendar_events` to fetch the list of events. 
Show the user a list of events with their titles, dates, and event IDs. 
Ask the user to provide the event ID or title and the fields to update (e.g., title, time). Confirm the changes before updating.
4. If the user provides incomplete details for event creation (e.g., no end time or description), assume reasonable defaults: 
   - End time: 1 hour after start time unless specified.
   - Description: Empty string unless specified.
   - Location: None unless specified.
   - Attendees: Empty list unless specified.
If the user asks about their schedule, events, meetings or any other activities involving schedules, use the `list_calendar_events` tool to query Google Calendar.
5. For vague requests, ask clarifying questions (e.g., "Which date or time range would you like to check?").
6. Use natural language to respond clearly and concisely.
7. If the user provides incomplete details for creating or updating an event, prompt for missing information (e.g., "Please specify the time or duration for the event").
8. Ensure all dates and times are interpreted relative to {now} in the UTC+4 timezone unless otherwise specified.
9. If an error occurs (e.g., no access to Google Calendar), inform the user politely and suggest checking the connection.
10. For event creation, format the `start_datetime` and `end_datetime` in RFC3339 format (e.g., '2025-07-13T15:00:00+04:00') and use the calendar ID '4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com'.
11. For event deletion, use the `delete_calendar_event` tool with the correct event ID.
12. For event updates, use the `update_calendar_event` tool with the correct event ID and updated fields.
13. Event ID looks like that, e.g "14gngu8rb71tkam27fk1to08jv", "35gc50jmu343lm0jga3adge1or" and so on.
"""

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")

# промпт
prompt = ChatPromptTemplate.from_messages([
    SystemMessage(content=system_prompt.format(now=now)),
    MessagesPlaceholder(variable_name="messages"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

tools = [list_calendar_events, create_calendar_event, delete_calendar_event, update_calendar_event]

agent = create_tool_calling_agent(llm=llm, tools=tools, prompt=prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)


def main():
    # user_input = input("Введите ваш запрос (например, 'What's my schedule tomorrow?' или 'Add a meeting tomorrow at 3 PM'): ")
    """
    result = create_calendar_event.invoke(input={
        "summary":"Test Meeting",
        "location": None,
        "start_datetime":"2025-07-13T15:00:00+04:00",
        "end_datetime":"2025-07-13T16:00:00+04:00",
        "calendar_id":"4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com",
        "description":"Test event",
        "attendees":[]
        }
    )
    print(result)
    """
    history = []
    while True:
        user_input = input("\nВведите ваш запрос (например, 'What's my schedule tomorrow?' или 'Add a meeting tomorrow at 3 PM'): "
                           "Чтобы выйти - напишите exit\n")
        if user_input.lower() == "exit":
            break

        history.append(HumanMessage(content=user_input))
        response = agent_executor.invoke({"messages": history})
        history.append(SystemMessage(content=response["output"]))
        print(response["output"])

    print(f"\n\nПолная история: {history}")


if __name__ == "__main__":
    main()
