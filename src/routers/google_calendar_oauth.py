from sqlalchemy.orm import Session
from typing import Optional, List
from fastapi import Depends, APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from langchain_core.tools import tool
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow
from datetime import datetime
import os.path
from src.backend.database import get_db, UserCalendar, User
from src.backend.models import SelectCalendarRequest
from src.utlis.logging_config import get_logger
from src.config.config import Config
logger = get_logger(__name__)


router = APIRouter()


@router.get("/auth/google")
async def start_google_auth(user_id: int, db: Session = Depends(get_db)):
    """
    Start Google OAuth flow for a user.
    """
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": Config.GOOGLE_CLIENT_ID,
                "client_secret": Config.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [Config.REDIRECT_URI]
            }
        },
        scopes=Config.SCOPES
    )
    flow.redirect_uri = Config.REDIRECT_URI
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=str(user_id)  # Передаём user_id через state
    )
    return {"authorization_url": authorization_url}


@router.get("/auth/callback")
async def google_auth_callback(
        code: str, state: str, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback and store tokens.
    """
    user_id = int(state)
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": Config.GOOGLE_CLIENT_ID,
                "client_secret": Config.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [Config.REDIRECT_URI]
            }
        },
        scopes=Config.SCOPES
    )
    flow.redirect_uri = Config.REDIRECT_URI
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Запрашиваем информацию о пользователе у Google
        user_info_service = build('oauth2', 'v2', credentials=credentials)
        user_info = user_info_service.userinfo().get().execute()

        google_name = user_info.get('name')
        google_email = user_info.get('email')
        google_picture = user_info.get('picture')

        # Находим нашего пользователя и обновляем его данные
        db_user = db.query(User).filter(User.id == user_id).first()
        if db_user:
            db_user.google_display_name = google_name
            db_user.google_email = google_email
            db_user.google_picture_url = google_picture

        user_calendar = db.query(UserCalendar).filter(
            UserCalendar.user_id == user_id,
            UserCalendar.is_active == True
        ).first()
        if user_calendar:
            user_calendar.access_token = credentials.token
            user_calendar.refresh_token = credentials.refresh_token
            user_calendar.token_expiry = credentials.expiry.isoformat(
            ) if credentials.expiry else None
        else:
            # Сохраняем токены в базе данных
            user_calendar = UserCalendar(
                user_id=user_id,
                calendar_id="primary",  # По умолчанию используем основной календарь
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expiry=credentials.expiry.isoformat() if credentials.expiry else None,
                is_active=True
            )
            db.add(user_calendar)
        db.commit()
        return RedirectResponse(
            url=f"{Config.FRONTEND_ADDRESS}/#/callback?status=success&user_id={user_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error in OAuth callback: {e}")
        return RedirectResponse(
            url=f"{Config.FRONTEND_ADDRESS}/#/callback?status=error&error={str(e)}")


@router.get("/calendars")
async def list_user_calendars(user_id: int, db: Session = Depends(get_db)):
    """
    List available Google Calendars for the user.
    """

    logger.info(f"--- START: list_user_calendars for user_id={user_id} ---")

    user_calendar = db.query(UserCalendar).filter(
        UserCalendar.user_id == user_id,
        UserCalendar.is_active == True
    ).first()
    if not user_calendar:
        logger.error(
            f"--- ABORT: No calendar credentials found for user_id={user_id} ---")
        raise HTTPException(status_code=404,
                            detail="No calendar credentials found for user")

    credentials = Credentials(
        token=user_calendar.access_token,
        refresh_token=user_calendar.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        scopes=Config.SCOPES
    )
    if credentials.expired and credentials.refresh_token:
        logger.info(
            f"Access token expired for user_id={user_id}, refreshing...")
        credentials.refresh(Request())
        user_calendar.access_token = credentials.token
        user_calendar.token_expiry = credentials.expiry.isoformat(
        ) if credentials.expiry else None
        db.commit()
        logger.info(f"Tokens updated for user_id={user_id}")
    service = build('calendar', 'v3', credentials=credentials)
    try:
        logger.info(
            f"--- API CALL: Calling Google Calendar API with showHidden=True for user_id={user_id} ---")

        calendar_list = service.calendarList().list(
            showHidden=True, minAccessRole='reader').execute()

        calendars = [
            {
                "id": cal["id"],
                "summary": cal.get("summary", "Unnamed Calendar"),
                "accessRole": cal.get("accessRole")
            }
            for cal in calendar_list.get("items", [])
        ]

        db_user = db.query(User).filter(User.id == user_id).first()
        user_email = db_user.google_email if db_user else None
        """
        birthdays_calendar_id = "addressbook#contacts@group.v.calendar.google.com"

        if not any(c['id'] == birthdays_calendar_id for c in calendars):
            calendars.append({
                "id": birthdays_calendar_id,
                "summary": "Birthdays",
                "accessRole": "reader"
            })
            logger.info(f"Manually added 'Birthdays' calendar for user_id={user_id}")

        if user_email and not any(c['id'] == user_email for c in calendars):
            calendars.append({
                "id": user_email,
                "summary": "Tasks",
                "accessRole": "reader"
            })
            logger.info(f"Manually added 'Tasks' calendar for user_id={user_id}")
        """

        logger.info(
            f"--- SUCCESS: Found {len(calendars)} calendars for user_id={user_id}. Summaries: {[c['summary'] for c in calendars]} ---")

        return {"calendars": calendars}
    except Exception as e:
        logger.error(f"Error listing calendars for user_id={user_id}: {e}")
        raise HTTPException(status_code=400,
                            detail=f"Failed to list calendars: {str(e)}")


@router.post("/select_calendar")
async def select_calendar(request: SelectCalendarRequest,
                          db: Session = Depends(get_db)):
    """
    Selects a specific calendar for the user after verifying write access.
    """
    user_calendar = db.query(UserCalendar).filter(
        UserCalendar.user_id == request.user_id,
        UserCalendar.is_active == True
    ).first()
    if not user_calendar:
        raise HTTPException(status_code=404,
                            detail="No calendar credentials found for user")

    credentials = Credentials(
        token=user_calendar.access_token,
        refresh_token=user_calendar.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        scopes=Config.SCOPES
    )
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        user_calendar.access_token = credentials.token
        user_calendar.token_expiry = credentials.expiry.isoformat(
        ) if credentials.expiry else None

    service = build('calendar', 'v3', credentials=credentials)

    try:
        calendar_metadata = service.calendarList().get(
            calendarId=request.calendar_id).execute()
        access_role = calendar_metadata.get('accessRole')

        if access_role not in ['writer', 'owner']:
            logger.warning(
                f"User {request.user_id} attempted to select calendar {request.calendar_id} with insufficient role: {access_role}")
            raise HTTPException(
                status_code=403,
                detail=f"You have '{access_role}' access to this calendar. Write permissions are required to set it as active."
            )

        user_calendar.calendar_id = request.calendar_id
        db.commit()
        logger.info(
            f"Calendar {request.calendar_id} successfully selected for user {request.user_id}")
        return {
            "message": f"Calendar {request.calendar_id} selected for user {request.user_id}"}

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        logger.error(
            f"Error selecting calendar for user {request.user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while selecting the calendar: {str(e)}")
