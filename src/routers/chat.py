from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.backend.database import get_db, Chat
from src.backend.models import ChatPost, ChatGet
from src.utlis.utility import add_new_chat
from src.utlis.logging_config import get_logger
from sqlalchemy import and_
from src.backend.database import Message

logger = get_logger(__name__)

router = APIRouter()


@router.post("/user_chat", response_model=ChatGet)
def create_chat(chat: ChatPost, db: Session = Depends(get_db)):
    new_chat = add_new_chat(chat, db)
    if new_chat is None:
        raise HTTPException(status_code=500, detail="Could not create chat")
    return new_chat


@router.get("/user_chats")
def get_all_user_chats(db: Session = Depends(get_db)) -> List[ChatGet]:
    chats = db.query(Chat).filter(Chat.is_deleted == False).all()
    return chats


@router.get("/user_chats/{user_id}")
def get_user_chats(user_id: int, db: Session = Depends(
    get_db)) -> List[ChatGet]:
    user_chats = db.query(Chat).filter(
        and_(
            Chat.is_deleted == False,
            Chat.user_id == user_id)).all()
    if len(user_chats) == 0:
        return []
    return user_chats


@router.delete("/chat/{chat_id}")
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    """
    Помечает чат и все его сообщения как удаленные (мягкое удаление).
    """
    db_chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_deleted == False).first()

    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    try:
        db_chat.is_deleted = True

        db.add(db_chat)

        db.query(Message).filter(Message.chat_id == chat_id).update({"is_deleted": True})

        db.commit()
        logger.info(f"Chat with id {chat_id} and its messages marked as deleted.")
        return {"message": f"Chat {chat_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not delete chat.")