from typing import List
from src.backend.models import ChatGet, ChatPost, MessageGet
from src.backend.database import Chat, Message
from langchain_core.messages import HumanMessage, SystemMessage
from src.utlis.logging_config import get_logger
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

logger = get_logger(__name__)


def convert_to_messages(history_records: List[dict]) -> List:
    """Преобразует записи из базы в объекты сообщений LangChain."""
    messages = []
    for record in history_records:
        if record.role.value == "user":
            messages.append(HumanMessage(content=record.text))
        elif record.role.value == "assistant" or record.role.value == "system":
            messages.append(SystemMessage(content=record.text))
    return messages


def add_new_chat(chat: ChatPost, db: Session):
    """
    Добавляет новый чат в базу данных
    Args:
        chat:
        db:

    Returns:

    """
    db_chat = Chat(
        summary=chat.summary,
        user_id=chat.user_id,
        is_deleted=False,
        created_at=datetime.now()
    )
    try:
        db.add(db_chat)
        db.commit()
        db.refresh(db_chat)
        return db_chat
    except Exception as ex:
        logger.error(f"Exception while adding new chat: {ex}")
        db.rollback()
        return None


def save_message(db: Session, chat_id, role, text) -> MessageGet:
    """
    Сохраняет сообщение в базу данных.
    Args:
        db:
        chat_id:
        role:
        text:

    Returns:

    """
    db_message = Message(chat_id=chat_id, text=text, role=role)
    try:
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        return db_message
    except Exception as ex:
        db.rollback()
        logger.error(f"Exception while creating (saving) a message: {ex}")
        raise HTTPException(status_code=500, detail="Problem while creating a message")
"""
def convert_to_messages(history_records: List[dict]) -> List:
    # ""Преобразует записи из базы в объекты сообщений LangChain.""
    messages = []
    for record in history_records:
        if record["role"] == "human":
            messages.append(HumanMessage(content=record["content"]))
        elif record["role"] == "system":
            messages.append(SystemMessage(content=record["content"]))
    return messages
"""