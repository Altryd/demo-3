import os
import requests
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from bs4 import BeautifulSoup
from src.backend.database import get_db, Message, Chat, Attachment
from sqlalchemy import and_
from src.llm.llm import LLMInterface
from src.backend.models import Query, QueryResponse
from src.utlis.logging_config import get_logger
from src.rag.rag_service import RAGService
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers.string import StrOutputParser

logger = get_logger(__name__)
llm_interface = LLMInterface()
router = APIRouter()

rag_service = RAGService()

DOWNLOADS_DIR = "downloads"
if not os.path.exists(DOWNLOADS_DIR):
    os.makedirs(DOWNLOADS_DIR)

IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']

@router.post("/query", response_model=QueryResponse)
async def process_query(query: Query, db: Session = Depends(get_db)):
    backup_llm = llm_interface.llm
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
        chat_history = db.query(Message).filter(
            and_(
                Message.is_deleted.is_(False),
                Message.chat_id == query.chat_id)).order_by(Message.id).all()

        newly_indexed_docs = []
        attachment_prompts = []
        if query.attachments:
            for attachment in query.attachments:
                file_type = attachment.file_type or ''
                file_url = attachment.url
                file_name = attachment.file_name or 'attached file'
                is_image_by_url = any(file_url.lower().endswith(ext) for ext in IMAGE_EXTENSIONS)

                if file_type.startswith("image/") or (file_type == 'url' and is_image_by_url):
                    prompt = (f"\n[User has attached an image named '{file_name}'. Analyze it using its URL: {file_url}]")
                    attachment_prompts.append(prompt)

                elif file_type in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:

                    # --- ИЗМЕНЕНИЕ: Проверка на существование документа в индексе ---
                    is_already_processed = rag_service.is_document_in_index(query.chat_id, file_name)

                    if is_already_processed:
                        logger.info(f"Document '{file_name}' is already indexed for this chat. Skipping download and processing.")
                        attachment_prompts.append(f"\n[System note: The document '{file_name}' is already available in the knowledge base.]")
                        continue # Переходим к следующему вложению

                    file_path = os.path.join(DOWNLOADS_DIR, file_name)
                    try:
                        logger.info(f"Submitting POST request to {file_url} to trigger download.")

                        with requests.post(file_url, stream=True, timeout=120) as r:
                            r.raise_for_status()
                            with open(file_path, 'wb') as f:
                                for chunk in r.iter_content(chunk_size=8192):
                                    f.write(chunk)

                        logger.info(f"Successfully saved document to {file_path}. Now indexing.")
                        new_chunks = rag_service.add_document_to_index(file_path, query.chat_id)

                        if new_chunks:
                            newly_indexed_docs.extend(new_chunks)
                            attachment_prompts.append(f"\n[System note: The document '{file_name}' has been successfully indexed and its content is available for answering questions.]")
                        else:
                            attachment_prompts.append(f"\n[System note: Failed to process the attached document '{file_name}'. Please inform the user about the error.]")

                    except requests.RequestException as e:
                        logger.error(f"Failed to download document {file_name}: {e}")
                        attachment_prompts.append(f"\n[System note: Failed to download attached document '{file_name}'.]")
                    except Exception as e:
                        logger.error(f"An unexpected error occurred during file processing for {file_name}: {e}")
                        attachment_prompts.append(f"\n[System note: An error occurred while processing '{file_name}'.]")

                else:
                    attachment_prompts.append(f"\n[User has attached a file named '{file_name}'. URL: {file_url}]")

        final_context_docs = []
        formatted_history = "\n".join([f"{msg.role}: {msg.text}" for msg in chat_history[-4:]])

        if newly_indexed_docs:
            logger.info(f"Using context from newly uploaded document ({len(newly_indexed_docs)} chunks).")
            final_context_docs = newly_indexed_docs
        else:
            logger.info("No new documents. Querying existing index.")
            search_query = query.question
            if chat_history:
                rewrite_prompt = ChatPromptTemplate.from_messages([
                    ("system", "Given a chat history and a follow up question, rephrase the follow up question to be a standalone question."),
                    ("user", "Chat History:\n{chat_history}\n\nFollow Up Input: {question}")
                ])
                llm_interface.llm = llm_interface.mistral_llm
                rewriter_chain = rewrite_prompt | llm_interface.llm | StrOutputParser()
                search_query = await rewriter_chain.ainvoke({"chat_history": formatted_history, "question": query.question})
                logger.info(f"Original question: '{query.question}' | Rewritten search query: '{search_query}'")
                llm_interface.llm = backup_llm
            final_context_docs = rag_service.query_index(search_query, query.chat_id)

        retrieved_context = "\n\n".join([doc.page_content for doc in final_context_docs])

        use_rag_context = False
        if newly_indexed_docs and retrieved_context:
            use_rag_context = True
            logger.info("New document indexed. Assuming first question is relevant, using RAG context directly.")
        elif retrieved_context:
            logger.info("Found context from existing index. Checking for relevance...")

            relevance_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are a helpful assistant that determines if a retrieved document context is relevant to the user's question, considering the ongoing conversation.
Respond with only the word 'yes' or 'no'.

The user is in a conversation. If their new question is a follow-up or on the same topic as the chat history, the context from the document is likely relevant.

Chat History:
{history}"""),
                ("user", """User's New Question: {question}

Retrieved Context from the document:
---
{context}
---

Is the retrieved context relevant to the user's new question?""")
            ])

            llm_interface.llm = llm_interface.mistral_llm
            relevance_chain = relevance_prompt | llm_interface.llm | StrOutputParser()

            relevance_decision = await relevance_chain.ainvoke({
                "history": formatted_history,
                "question": query.question,
                "context": retrieved_context
            })
            llm_interface.llm = backup_llm
            logger.info(f"Relevance check decision: '{relevance_decision.strip()}'")

            if 'yes' in relevance_decision.lower():
                use_rag_context = True

        answer = ""
        if use_rag_context:
            logger.info("Context is relevant. Generating response from context.")
            answer = await llm_interface.agenerate_response_from_context(
                question=query.question,
                context=retrieved_context,
                history=chat_history
            )
        else:
            logger.info("Context is not relevant or not found. Using agentic generation.")
            question_for_llm = query.question
            if attachment_prompts:
                question_for_llm += "\n" + "\n".join(attachment_prompts)

            answer = await llm_interface.agenerate(question_for_llm, chat_history, user_id=query.user_id,
                                                   context=[], language="")

        chat = db.query(Chat).filter(
            Chat.id == query.chat_id,
            Chat.user_id == query.user_id,
            Chat.is_deleted.is_(False)
        ).first()
        if not chat:
            if not query.attachments:
                 raise HTTPException(status_code=404, detail="Chat not found or does not belong to user")

        user_message = Message(chat_id=query.chat_id, text=query.question, role="user", is_deleted=False)
        db.add(user_message)
        db.flush()

        if query.attachments:
            for attachment_data in query.attachments:
                db_attachment = Attachment(
                    message_id=user_message.id,
                    url=attachment_data.url,
                    file_name=attachment_data.file_name,
                    file_type=attachment_data.file_type,
                    file_size=attachment_data.file_size
                )
                db.add(db_attachment)

        context_for_db = None
        if use_rag_context:
            source_files = list(set([doc.metadata.get('source', 'unknown') for doc in final_context_docs]))
            context_for_db = [os.path.basename(f) for f in source_files]

        assistant_message = Message(
            chat_id=query.chat_id,
            text=answer,
            role="assistant",
            is_deleted=False,
            context=context_for_db
        )
        db.add(assistant_message)
        db.commit()

        response_context = []
        if use_rag_context:
            response_context = [{"text": doc.page_content, "source": doc.metadata.get('source', 'unknown')} for doc in final_context_docs]

        return QueryResponse(answer=answer, context=response_context, language=chat.summary if chat else "")

    except Exception as ex:
        db.rollback()
        logger.error(f"Error processing query: {ex}")
        logger.exception("An unhandled exception occurred in process_query:")
        raise HTTPException(status_code=500, detail=str(ex))