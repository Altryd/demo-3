# uvicorn app.main:app --host localhost --port 8000 --reload

from src.routers import health, speed_test, user, chat, message, query, google_calendar_oauth, attachment
from src.utlis.logging_config import get_logger
from contextlib import asynccontextmanager
from src.backend.database import engine, get_db, create_postgres_tables
from dotenv import load_dotenv
from src.backend.database import User, Chat, Message, SpeedTestResult
from src.config.config import Config
from src.backend import database
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import and_
from sqlalchemy.orm import Session
from typing import List
from fastapi import FastAPI, HTTPException, Depends
import os
os.environ['PGCLIENTENCODING'] = 'utf-8'

# from app.context import ContextManager
# from app.llm import LLMInterface
# from app.models import UserGet, Query, ChatGet, MessageGet, MessagePost, ChatPost, QueryResponse, SpeedTestPayload, SpeedTestResultGet
# from app.rag import RAGPipeline
# from app.utility import detect_language, add_new_chat, save_message, generate_summary, format_history

# импорты для PostgreSQL
# from app.speed_database import get_postgres_db, create_postgres_tables
# from app.speed_database import SpeedTestResult as SpeedTestResultDB

database.Base.metadata.create_all(bind=engine)
create_postgres_tables()

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load RAG DATABASE
    db = next(get_db())
    """
    try:
        data_files = [os.path.join(Config.RAG_DIR, file_) for file_ in os.listdir(Config.RAG_DIR)]
        data_files = [f for f in data_files if os.path.exists(f)]
        if data_files:
            rag.load_documents(data_files)
            logger.info(f"Loaded {len(data_files)} documents")
        else:
            logger.warning("No documents found in rag_database")
    except Exception as e:
        logger.error(f"Error loading documents: {e}")
    """
    # load test database
    if Config.FILL_MYSQL_IF_EMPTY:
        users = db.query(User).filter(User.is_deleted == False).all()
        if len(users) == 0:
            logger.info("MySQL is empty, start to fill it with test data")
            users = [
                {"id": 0, "name": "Zoleks"},
                {"id": 1, "name": "Varyag"},
                {"id": 2, "name": "Schmyrdak"},
                {"id": 3, "name": "test_user"}
            ]
            for user in users:
                db_user = User(name=user["name"], is_deleted=False)
                db.add(db_user)
            db.commit()
            users = db.query(User).filter(User.is_deleted == False).all()
            first_user_id = users[0].id
            second_user_id = users[1].id

            chats = [
                {"id": 0, "summary": "schmyrdak vs kth", "user_id": second_user_id},
                {"id": 1, "summary": "clown fiesta", "user_id": first_user_id}
            ]

            for chat in chats:
                db_chat = Chat(
                    user_id=chat["user_id"],
                    summary=chat["summary"])
                db.add(db_chat)
            db.commit()
            chats = db.query(Chat).filter(Chat.is_deleted == False).all()
            first_chat_id = chats[0].id
            second_chat_id = chats[1].id

            messages = [
                {"id": 0, "chat_id": first_chat_id,
                    "text": "genzo", "role": "user"},
                {"id": 1,
                 "chat_id": first_chat_id,
                 "text": "wtf is GENZO ??? what the sigma??",
                 "role": "assistant"},
                {"id": 2,
                 "chat_id": second_chat_id,
                 "text": "hello i'm fully clown",
                 "role": "user"},
                {"id": 3,
                 "chat_id": second_chat_id,
                 "text": "why :( ?",
                 "role": "assistant"},
            ]
            for message in messages:
                db_message = Message(
                    chat_id=message["chat_id"],
                    text=message["text"],
                    role=message["role"])
                db.add(db_message)
            db.commit()
        else:
            logger.info("MySQL is NOT empty, skipping filling stage")

    yield
    # Clean up and release the resources
    # ml_models.clear()


app = FastAPI(title="osu! AI Agent", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
"""
rag = RAGPipeline()
llm = LLMInterface()
context_manager = ContextManager()
"""

logger = get_logger(__name__)

# REGION UTILS


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


app.include_router(health.router)
app.include_router(query.router)
app.include_router(speed_test.router)
app.include_router(user.router)
app.include_router(chat.router)
app.include_router(message.router)
app.include_router(attachment.router)
app.include_router(google_calendar_oauth.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
