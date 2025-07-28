from contextlib import contextmanager

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum, Boolean, DateTime, func, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import enum
from src.config.config import Config

Base = declarative_base()


class Role(enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    chats = relationship("Chat", back_populates="user")
    is_deleted = Column(Boolean, default=False, nullable=False)
    speed_results = relationship("SpeedTestResult", back_populates="user")


class Chat(Base):
    __tablename__ = "chat"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey(
            "user.id",
            ondelete="CASCADE"),
        nullable=False)
    summary = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat")
    is_deleted = Column(Boolean, default=False, nullable=False)


class Message(Base):
    __tablename__ = "message"
    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(
        Integer,
        ForeignKey(
            "chat.id",
            ondelete="CASCADE"),
        nullable=False)
    text = Column(Text, nullable=False)
    role = Column(Enum(Role), nullable=False)
    chat = relationship("Chat", back_populates="messages")
    is_deleted = Column(Boolean, default=False, nullable=False)


engine = create_engine(
    Config.POSTGRES_DATABASE_URL, echo=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class SpeedTestResult(Base):
    __tablename__ = "speed_test_result"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer,
                     ForeignKey(
                         "user.id",
                         ondelete="CASCADE"
                     ),
                     nullable=False, index=True)
    user = relationship("User", back_populates="speed_results")
    taps = Column(Integer, nullable=False)
    time = Column(Float, nullable=False)
    stream_speed = Column(Float, nullable=False) # BPM
    unstable_rate = Column(Float, nullable=False)
    chart_data = Column(JSON, nullable=True) # Поле для хранения данных графика
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserCalendar(Base):
    __tablename__ = "user_calendar"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer,
                     ForeignKey(
                         "user.id",
                         ondelete="CASCADE"
                     ),
                     nullable=False, index=True)
    # user = relationship("User", back_populates="calendars")
    calendar_id = Column(String, nullable=False)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    token_expiry = Column(String, nullable=True)  # Храним в формате ISO
    is_active = Column(Boolean, default=True)


postgres_engine = create_engine(
    Config.POSTGRES_DATABASE_URL,
    echo=True
)

PostgresSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)


def get_db():
    db = PostgresSessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_for_debug():
    db = PostgresSessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_postgres_tables():
    Base.metadata.create_all(bind=postgres_engine)