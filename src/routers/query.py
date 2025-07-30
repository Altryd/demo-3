from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from src.backend.database import get_db, Message, Chat
from src.config.config import Config
from  sqlalchemy import and_
from src.llm.llm import LLMInterface
# from src.rag import RAGPipeline
# from src.context import ContextManager
from src.backend.models import Query, QueryResponse
# from src.utility import detect_language, format_history
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)
# rag = RAGPipeline()
llm = LLMInterface()
# context_manager = ContextManager()

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def process_query(query: Query, db: Session = Depends(get_db)):
    try:
        chat = db.query(Chat).filter(
            Chat.id == query.chat_id,
            Chat.user_id == query.user_id,
            Chat.is_deleted == False
        ).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found or does not belong to user")

        question = query.question
        # language = query.language or detect_language(question)
        chat_history = (db.query(Message).filter(
            and_(
                Message.is_deleted == False,
                Message.chat_id == query.chat_id))
                        .order_by(Message.id)
                        .all())
        # chat_history = context_manager.get_context(query.user_id, query.chat_id, db=db)
        """
        context = rag.retrieve(question, k=4)
        if not context:
            logger.warning(f"No relevant documents found for query: {question}")
        """
        context = []
        language = ""

        # formatted_history = format_history(chat_history)
        answer = llm.generate(db=db, question=question, history=chat_history, context=context, language=language,
                              user_id=query.user_id,  chat_id=query.chat_id)  # calendar_id="", TODO calendar_id !!!
        if not answer:
            db.rollback()
            db.query(Message).filter(Message.chat_id == chat.id).update({"is_deleted": True})
            chat.is_deleted = True
            db.commit()
        else:
            db.add_all([
                Message(chat_id=query.chat_id, text=question, role="user", is_deleted=False),
                Message(chat_id=query.chat_id, text=answer, role="assistant", is_deleted=False)
            ])
            db.commit()

        # context_manager.save_context(user_id=query.user_id, role="user", text=query.question, chat_id=query.chat_id)
        # context_manager.save_context(user_id=query.user_id, role="assistant", text=answer, chat_id=query.chat_id)
        # TODO: summary
        """
        if len(chat.messages) == 2 or not chat.summary:
            chat_history = context_manager.get_context(query.user_id, query.chat_id, db=db)
            chat.summary = generate_summary(llm, chat_history)
            db.commit()
            db.refresh(chat)
        """
        return QueryResponse(answer=answer, context=context, language=language, summary=chat.summary)
    except ValueError as ve:
        db.rollback()
        logger.error(f"Validation error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        db.rollback()
        logger.error(f"Error processing query: {ex}")
        raise HTTPException(status_code=500, detail=str(ex))