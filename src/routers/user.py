from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from src.backend.database import (get_db, User)
from src.backend.models import UserGet
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/users")
def get_all_users(db: Session = Depends(get_db)) -> List[UserGet]:
    users = db.query(User).filter(User.is_deleted == False).all()
    return users


@router.post("/user", response_model=UserGet)
def add_user(user: UserGet, db: Session = Depends(get_db)):
    db_user = User(name=user.name, is_deleted=False)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
