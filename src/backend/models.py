from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from src.backend.database import Role


class UserGet(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ChatGet(BaseModel):
    id: int
    user_id: int
    summary: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AttachmentCreate(BaseModel):
    url: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None


class AttachmentGet(BaseModel):
    id: int
    url: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None

    class Config:
        from_attributes = True


class MessageGet(BaseModel):
    id: int
    chat_id: int
    text: str
    role: Role
    attachments: List[AttachmentGet] = []
    # --- поле для контекста ---
    context: Optional[List[str]] = None

    class Config:
        from_attributes = True


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
    id: int
    user_id: int
    taps: int
    time: float
    stream_speed: float
    unstable_rate: float
    chart_data: Optional[List[SpeedTestChartData]] = None
    timestamp: str

    class Config:
        from_attributes = True
        
class SelectCalendarRequest(BaseModel):
    user_id: int
    calendar_id: str

    class Config:
        from_attributes = True
