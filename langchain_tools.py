from typing import Optional, List
from langchain_core.tools import tool
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import os.path
import pickle
from logging_config import get_logger


logger = get_logger(__name__)
SCOPES = ['https://www.googleapis.com/auth/calendar']


def authenticate_google_calendar():
    """
    Authenticate with Google Calendar API using a Service Account.
    """
    credentials_path = os.path.join(os.path.dirname(__file__), 'credentials_2.json')

    # Загрузка учетных данных из JSON-файла
    credentials = Credentials.from_service_account_file(
        credentials_path,
        scopes=SCOPES
    )

    # Создание сервиса Google Calendar
    return build('calendar', 'v3', credentials=credentials)


@tool
def list_calendar_events(max_results: int = 10, calendar_id: str = "4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com") -> dict:
    """
    List upcoming events in the Google Calendar.

    Args:
        max_results (int): Maximum number of events to return (default: 10).
        calendar_id (str): ID of the calendar to query (default: '4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com').

    Returns:
        dict: Dictionary containing lists of event descriptions and event IDs.
    """
    service = authenticate_google_calendar()
    now = datetime.utcnow().isoformat() + 'Z'
    logger.info(f"Получение ближайших {max_results} событий")
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


@tool
def create_calendar_event(
    summary: str,
    location: Optional[str],
    description: str,
    start_datetime: str,
    end_datetime: str,
    attendees: Optional[List[str]] = None,
    calendar_id: str = "4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com"
) -> str:
    """
    Create a new event in the Google Calendar.

    Args:
        summary (str): Title of the event.
        location (str): Location of the event.
        description (str): Description of the event.
        start_datetime (str): Start date and time in RFC3339 format.
        end_datetime (str): End date and time in RFC3339 format.
        attendees (Optional[List[str]]): List of attendee email addresses.
        calendar_id (str): ID of the calendar (default: '4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com').

    Returns:
        str: Link to the created event.
    """
    service = authenticate_google_calendar()
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
    return f"Event created: {event.get('htmlLink')}"


@tool
def delete_calendar_event(event_id: str,
                          calendar_id: str = "4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com") -> str:
    """
    Delete an event from Google Calendar.

    Args:
        event_id (str): The ID of the event to delete.
        calendar_id (str): ID of the calendar (default: '4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com').

    Returns:
        str: Confirmation message.
    """
    service = authenticate_google_calendar()
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return f"Event with ID {event_id} successfully deleted!"
    except Exception as e:
        return f"Error deleting event: {str(e)}"

@tool
def update_calendar_event(event_id: str,
                          summary: Optional[str],
                          location: Optional[str],
                          description: Optional[str],
                          start_datetime: Optional[str],
                          end_datetime: Optional[str],
                          attendees: Optional[List[str]] = None,
                          calendar_id: str="4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com") -> str:
    """
    Update an event in Google Calendar with new information.

    Args:
        event_id (str): The ID of the event to update.
        summary (Optional[str]): Title of the event. Leave as None if the updated is not needed for that field.
        location (Optional[str]): Location of the event. Leave as None if the updated is not needed for that field.
        description (Optional[str]): Description of the event. Leave as None if the updated is not needed for that field.
        start_datetime (Optional[str]): Start date and time in RFC3339 format. Leave as None if the updated is not needed for that field.
        end_datetime (Optional[str]): End date and time in RFC3339 format. Leave as None if the updated is not needed for that field.
        attendees (Optional[List[str]]): List of attendee email addresses. Leave as None if the updated is not needed for that field.
        calendar_id (str): ID of the calendar (default: '4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com').

    Returns:
        str: Confirmation message.
    """
    service = authenticate_google_calendar()
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

    try:
        if not event:
            return f"No updates provided for event with ID {event_id}"
        current_event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        updated_event = {**current_event, **event}
        service.events().update(calendarId=calendar_id, eventId=event_id, body=updated_event).execute()
        return f"Event with ID {event_id} successfully updated! You can view it here: {updated_event.get('htmlLink')}"
    except Exception as e:
        return f"Error updating event: {str(e)}"

"""
def main():
    service = authenticate_google_calendar()

    events, ids = list_events(service,
                              calendar_id="primary") # 4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com
    print(events, ids)

    create_event(service, summary='Встреча', location='Офис', description='Обсуждение проекта',
                 start={
                     'dateTime': '2025-07-16T10:00:00+04:00',
                     'timeZone': 'Europe/Samara',
                 },
                 end={
                     'dateTime': '2025-07-16T11:00:00+04:00',
                     'timeZone': 'Europe/Samara',
                 },
                 attendees=[],
                 reminders={
                     'useDefault': False,
                     'overrides': [
                         {'method': 'email', 'minutes': 24 * 60},
                         {'method': 'popup', 'minutes': 10}
                     ],
                 },
                 calendar_id="4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com")

    events, ids = list_events(service, calendar_id="4332dd8d4199feba063d2bfab712522c230fb3529ebe4e8e23d1554722f18087@group.calendar.google.com")
    print(events, ids)
"""

if __name__ == "__main__":
    pass
    # main()
