# START OF FILE src/backend/models.py

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime
from src.backend.database import Role


class UserGet(BaseModel):
    # Используем новый синтаксис и объединяем все поля в одной модели
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    google_display_name: Optional[str] = None
    google_email: Optional[str] = None
    google_picture_url: Optional[str] = None


class ChatGet(BaseModel):
    # Оставляем только новый синтаксис, удаляем старый class Config
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    summary: Optional[str] = None
    created_at: Optional[datetime] = None


class AttachmentCreate(BaseModel):
    url: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None


class AttachmentGet(BaseModel):
    # Заменяем старый синтаксис на новый
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None


class MessageGet(BaseModel):
    # Заменяем старый синтаксис на новый
    model_config = ConfigDict(from_attributes=True)

    id: int
    chat_id: int
    text: str
    role: Role
    attachments: List[AttachmentGet] = []
    context: Optional[List[str]] = None


class ChatPost(BaseModel):
    user_id: int
    summary: Optional[str] = None


class MessagePost(BaseModel):
    user_id: int
    chat_id: Optional[int] = None
    text: str
    role: Role


class Query(BaseModel):
    question: str
    language: Optional[str] = None
    user_id: int
    chat_id: int
    attachments: Optional[List[AttachmentCreate]] = None


class QueryResponseContextItem(BaseModel):
    text: str
    source: str


class QueryResponse(BaseModel):
    answer: str
    context: List[QueryResponseContextItem]
    language: str
    summary: Optional[str] = None


class ContextLine(BaseModel):
    role: str
    text: str


class SpeedTestChartData(BaseModel):
    time: float
    bpm: float


class SpeedTestPayload(BaseModel):
    user_id: int
    taps: int
    time: float
    bpm: float
    unstable_rate: float
    chart_data: List[SpeedTestChartData]


class SpeedTestResultGet(BaseModel):
    # Заменяем старый синтаксис на новый
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    taps: int
    time: float
    stream_speed: float
    unstable_rate: float
    chart_data: Optional[List[SpeedTestChartData]] = None
    timestamp: str


class SelectCalendarRequest(BaseModel):
    # Заменяем старый синтаксис на новый
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    calendar_id: str
