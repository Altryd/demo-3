from contextlib import contextmanager
from typing import Optional, List
from langchain_core.tools import tool
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from datetime import datetime
import os.path
from src.backend.database import UserCalendar, get_db
from src.config.config import Config
from src.utlis.logging_config import get_logger


logger = get_logger(__name__)
SCOPES = ['https://www.googleapis.com/auth/calendar']

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SCOPES = ['https://www.googleapis.com/auth/calendar']
REDIRECT_URI = "http://localhost:8000/auth/callback"  # Настройте под ваш домен

# ##############
# NEW


def get_google_calendar_service(user_id: int) -> tuple[any, any]:
    """
    Create a Google Calendar service using OAuth credentials from UserCalendar.

    Args:
        user_id (int): The ID of the user whose calendar credentials are used.

    Returns:
        Google Calendar service object and calendar ID.

    Raises:
        ValueError: If no active calendar credentials are found for the user.
    """
    with contextmanager(get_db)() as db:
        user_calendar = db.query(UserCalendar).filter(
            UserCalendar.user_id == user_id,
            UserCalendar.is_active == True
        ).first()
        if not user_calendar:
            logger.error(f"No active calendar credentials found for user_id={user_id}")
            raise ValueError(f"No active calendar credentials found for user {user_id}")
        if not user_calendar.calendar_id:
            logger.error(f"No calendar_id found for user_id={user_id}")
            raise ValueError(f"No calendar_id found for user {user_id}")

        credentials = Credentials(
            token=user_calendar.access_token,
            refresh_token=user_calendar.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=Config.GOOGLE_CLIENT_ID,
            client_secret=Config.GOOGLE_CLIENT_SECRET,
            scopes=Config.SCOPES
        )
        if credentials.expired and credentials.refresh_token:
            logger.info(f"Access token expired for user_id={user_id}, refreshing...")
            credentials.refresh(Request())
            user_calendar.access_token = credentials.token
            user_calendar.token_expiry = credentials.expiry.isoformat() if credentials.expiry else None
            db.commit()
            logger.info(f"Tokens updated for user_id={user_id}")
        return build('calendar', 'v3', credentials=credentials), user_calendar.calendar_id


@tool
def list_calendar_events(max_results: int = 10, user_id: Optional[int] = None, **kwargs) -> dict:
    """
    List upcoming events in the user's Google Calendar.

    Args:
        max_results (int): Maximum number of events to return (default: 10).
        user_id (Optional[int]): ID of the user (default: None but that means that you don't know what user requested that tool).

    Returns:
        dict: Dictionary containing lists of event descriptions and event IDs or error.
    """
    # user_id = kwargs.get("config", {}).get("configurable", {}).get("user_id")
    if not user_id:
        return {"error": "No user_id provided in context"}

    try:
        service, calendar_id = get_google_calendar_service(user_id)
        now = datetime.utcnow().isoformat() + 'Z'
        logger.info(f"Fetching up to {max_results} events for user_id={user_id}, calendar_id={calendar_id}")
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=now,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        events = events_result.get('items', [])

        if not events:
            return {"events": [], "event_ids": []}

        events_str_list = []
        event_ids = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            events_str_list.append(f"{start} - {event['summary']}")
            event_ids.append(event.get('id'))

        return {"events": events_str_list, "event_ids": event_ids}
    except Exception as e:
        logger.error(f"Error listing events for user_id={user_id}: {e}")
        return {"error": f"Failed to list events: {str(e)}"}


@tool
def create_calendar_event(
    summary: str,
    location: Optional[str] = None,
    description: Optional[str] = None,
    start_datetime: str = None,
    end_datetime: str = None,
    attendees: Optional[List[str]] = None,
    user_id: Optional[int] = None,
    **kwargs
) -> str:
    """
    Create a new event in the user's Google Calendar.

    Args:
        summary (str): Title of the event.
        location (Optional[str]): Location of the event.
        description (Optional[str]): Description of the event.
        start_datetime (str): Start date and time in RFC3339 format.
        end_datetime (str): End date and time in RFC3339 format.
        attendees (Optional[List[str]]): List of attendee email addresses.
        user_id (Optional[int]): ID of the user (default: None but that means that you don't know what user requested that tool).
    Returns:
        str: Link to the created event or error message.
    """
    # user_id = kwargs.get("config", {}).get("configurable", {}).get("user_id")
    if not user_id:
        return "Error: No user_id provided in context"
    if not start_datetime or not end_datetime:
        return "Error: start_datetime and end_datetime are required"

    try:
        service, calendar_id = get_google_calendar_service(user_id)
        event = {
            'summary': summary,
            'location': location,
            'description': description,
            'start': {
                'dateTime': start_datetime,
                'timeZone': 'Europe/Samara',
            },
            'end': {
                'dateTime': end_datetime,
                'timeZone': 'Europe/Samara',
            },
            'attendees': [{'email': email} for email in attendees] if attendees else [],
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 10}
                ],
            },
        }
        event = service.events().insert(calendarId=calendar_id, body=event).execute()
        logger.info(f"Event created for user_id={user_id}, calendar_id={calendar_id}: {event.get('htmlLink')}")
        return f"Event created: {event.get('htmlLink')}"
    except Exception as e:
        logger.error(f"Error creating event for user_id={user_id}: {e}")
        return f"Error creating event: {str(e)}"


@tool
def delete_calendar_event(event_id: str, user_id: Optional[int], **kwargs) -> str:
    """
    Delete an event from the user's Google Calendar.

    Args:
        event_id (str): The ID of the event to delete.
        user_id (Optional[int]): ID of the user (default: None but that means that you don't know what user requested that tool).

    Returns:
        str: Confirmation message or error.
    """
    # user_id = kwargs.get("config", {}).get("configurable", {}).get("user_id")
    if not user_id:
        return "Error: No user_id provided in context"

    try:
        service, calendar_id = get_google_calendar_service(user_id)
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        logger.info(f"Event with ID {event_id} deleted for user_id={user_id}, calendar_id={calendar_id}")
        return f"Event with ID {event_id} successfully deleted!"
    except Exception as e:
        logger.error(f"Error deleting event {event_id} for user_id={user_id}: {e}")
        return f"Error deleting event: {str(e)}"


@tool
def update_calendar_event(
    event_id: str,
    summary: Optional[str] = None,
    location: Optional[str] = None,
    description: Optional[str] = None,
    start_datetime: Optional[str] = None,
    end_datetime: Optional[str] = None,
    attendees: Optional[List[str]] = None,
    user_id: Optional[int] = None,
    **kwargs
) -> str:
    """
    Update an event in the user's Google Calendar with new information.

    Args:
        event_id (str): The ID of the event to update.
        summary (Optional[str]): Title of the event.
        location (Optional[str]): Location of the event.
        description (Optional[str]): Description of the event.
        start_datetime (Optional[str]): Start date and time in RFC3339 format.
        end_datetime (Optional[str]): End date and time in RFC3339 format.
        attendees (Optional[List[str]]): List of attendee email addresses.
        user_id (Optional[int]): ID of the user (default: None but that means that you don't know what user requested that tool).

    Returns:
        str: Confirmation message or error.
    """
    # user_id = kwargs.get("config", {}).get("configurable", {}).get("user_id")
    if not user_id:
        return "Error: No user_id provided in context"

    try:
        service, calendar_id = get_google_calendar_service(user_id)
        event = {}
        fields = [("summary", summary), ("location", location), ("description", description)]
        for field_name, value in fields:
            if value is not None:
                event[field_name] = value

        if start_datetime is not None:
            event["start"] = {"dateTime": start_datetime, "timeZone": "Europe/Samara"}
        if end_datetime is not None:
            event["end"] = {"dateTime": end_datetime, "timeZone": "Europe/Samara"}
        if attendees is not None:
            event["attendees"] = [{"email": email} for email in attendees]

        if not event:
            return f"No updates provided for event with ID {event_id}"

        current_event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        updated_event = {**current_event, **event}
        service.events().update(calendarId=calendar_id, eventId=event_id, body=updated_event).execute()
        logger.info(f"Event with ID {event_id} updated for user_id={user_id}, calendar_id={calendar_id}")
        return f"Event with ID {event_id} successfully updated! You can view it here: {updated_event.get('htmlLink')}"
    except Exception as e:
        logger.error(f"Error updating event {event_id} for user_id={user_id}: {e}")
        return f"Error updating event: {str(e)}"


if __name__ == "__main__":
    pass
    # main()
