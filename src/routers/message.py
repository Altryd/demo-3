from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.backend.database import get_db, Chat, Message
from src.backend.models import MessagePost, MessageGet
from src.utlis.utility import save_message
from src.utlis.logging_config import get_logger
from sqlalchemy import and_

from src.backend.models import ChatPost
from src.utlis.utility import add_new_chat

logger = get_logger(__name__)
# context_manager = ContextManager()

router = APIRouter()


@router.get("/chat_messages/{chat_id}")
def get_chat_messages(chat_id: int, db: Session = Depends(
        get_db)) -> List[MessageGet]:
    chat_messages = (db.query(Message).filter(
        and_(
            Message.is_deleted == False,
            Message.chat_id == chat_id))
        .order_by(Message.id).all())
    if len(chat_messages) == 0:
        raise HTTPException(status_code=404, detail="Chat messages not found")
    return chat_messages


@router.post("/chat_message", response_model=MessageGet)
def add_chat_message(message: MessagePost, db: Session = Depends(get_db)):
    if message.chat_id is None:
        chat = add_new_chat(
            ChatPost(
                user_id=message.user_id,
                summary=None),
            db)
        if not chat:
            raise HTTPException(
                status_code=500,
                detail="Problem while creating a chat")
    else:
        chat = db.query(Chat).filter(Chat.id == message.chat_id).first()
    if chat is None:
        raise HTTPException(status_code=404,
                            detail="Chat with provided id was not found")
    try:
        created_message = save_message(
            db, chat_id=chat.id, role=message.role, text=message.text)
        # context_manager.save_context(user_id=message.user_id, role=message.role,
        #                             text=message.text, chat_id=chat.id)
    except Exception as ex:
        db.rollback()
        logger.error(f"Exception while creating a message: {ex}")
        raise HTTPException(status_code=500,
                            detail="Problem while creating a message")
    return created_message
