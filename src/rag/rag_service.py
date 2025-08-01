import os
import pickle
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import UnstructuredFileLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.retrievers import BM25Retriever, EnsembleRetriever
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
#from langchain_core.utils.math import sorted
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)

RAG_INDEXES_DIR = "rag_indexes"
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

class RAGService:
    def __init__(self):
        if not os.path.exists(RAG_INDEXES_DIR):
            os.makedirs(RAG_INDEXES_DIR)
            logger.info(f"Created directory for RAG indexes: {RAG_INDEXES_DIR}")

        self.embedding_model = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={'device': 'cpu'}
        )

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        
        # Инициализация реранкера
        self.reranker = HuggingFaceCrossEncoder(
            model_name=RERANKER_MODEL,
            model_kwargs={'device': 'cpu'}
        )

        logger.info("RAGService initialized successfully.")

    def _get_index_path(self, chat_id: int) -> str:
        return os.path.join(RAG_INDEXES_DIR, f"chat_{chat_id}")

    def _get_chunks_path(self, chat_id: int) -> str:
        """Возвращает путь к файлу, где хранятся сериализованные чанки."""
        return os.path.join(RAG_INDEXES_DIR, f"chat_{chat_id}_chunks.pkl")

    def is_document_in_index(self, chat_id: int, filename: str) -> bool:
        """
        Проверяет, содержатся ли в индексе чата чанки из файла с указанным именем.
        """
        index_path = self._get_index_path(chat_id)
        if not os.path.exists(index_path):
            return False

        try:
            logger.info(f"Checking for '{filename}' in existing index for chat {chat_id}.")
            vector_store = FAISS.load_local(index_path, self.embedding_model, allow_dangerous_deserialization=True)
            
            if not hasattr(vector_store, 'docstore') or not hasattr(vector_store.docstore, '_dict'):
                logger.warning(f"Docstore not found or in unexpected format for chat {chat_id}.")
                return False

            for doc in vector_store.docstore._dict.values():
                source = doc.metadata.get('source')
                if source and os.path.basename(source) == filename:
                    logger.info(f"Found matching document '{filename}' in index for chat {chat_id}.")
                    return True
            
            logger.info(f"No matching document '{filename}' found in index for chat {chat_id}.")
            return False
        except Exception as e:
            logger.error(f"Error checking index for chat {chat_id}: {e}")
            return False

    def add_document_to_index(self, file_path: str, chat_id: int) -> list:
        try:
            logger.info(f"Starting to process document '{file_path}' for chat_id {chat_id}.")
            
            file_extension = os.path.splitext(file_path)[1].lower()
            if file_extension not in [".pdf", ".docx"]:
                logger.warning(f"Unsupported file type for RAG: {file_path}. Skipping.")
                return []

            loader = UnstructuredFileLoader(file_path)
            documents = loader.load()

            new_chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Document split into {len(new_chunks)} new chunks.")

            index_path = self._get_index_path(chat_id)
            chunks_path = self._get_chunks_path(chat_id)
            all_chunks = []

            if os.path.exists(chunks_path):
                logger.info(f"Chunks file for chat {chat_id} exists. Loading and appending.")
                with open(chunks_path, "rb") as f:
                    all_chunks = pickle.load(f)
            
            all_chunks.extend(new_chunks)

            with open(chunks_path, "wb") as f:
                pickle.dump(all_chunks, f)
            logger.info(f"Saved {len(all_chunks)} total chunks to '{chunks_path}'.")

            if os.path.exists(index_path):
                logger.info(f"FAISS index for chat {chat_id} already exists. Loading and updating.")
                vector_store = FAISS.load_local(index_path, self.embedding_model, allow_dangerous_deserialization=True)
                vector_store.add_documents(new_chunks)
            else:
                logger.info(f"Creating a new FAISS index for chat {chat_id}.")
                vector_store = FAISS.from_documents(new_chunks, self.embedding_model)
            
            vector_store.save_local(index_path)
            logger.info(f"Successfully saved FAISS index for chat {chat_id} to '{index_path}'.")

            return new_chunks

        except Exception as e:
            logger.error(f"Failed to add document to index for chat {chat_id}: {e}")
            return []

    def query_index(self, question: str, chat_id: int) -> list:
        index_path = self._get_index_path(chat_id)
        chunks_path = self._get_chunks_path(chat_id)

        if not os.path.exists(index_path) or not os.path.exists(chunks_path):
            logger.info(f"Index or chunks file not found for chat {chat_id}. Returning empty context.")
            return []

        try:
            vector_store = FAISS.load_local(index_path, self.embedding_model, allow_dangerous_deserialization=True)
            faiss_retriever = vector_store.as_retriever(search_kwargs={"k": 4})
            logger.info("FAISS retriever loaded.")

            with open(chunks_path, "rb") as f:
                all_chunks = pickle.load(f)
            
            if not all_chunks:
                logger.warning(f"No chunks loaded from {chunks_path}. Skipping BM25.")
                return faiss_retriever.invoke(question)

            bm25_retriever = BM25Retriever.from_documents(all_chunks, k=4)
            logger.info("BM25 retriever initialized.")

            ensemble_retriever = EnsembleRetriever(
                retrievers=[bm25_retriever, faiss_retriever],
                weights=[0.5, 0.5]
            )
            logger.info(f"Querying EnsembleRetriever for chat {chat_id} with question: '{question[:50]}...'")
            
            retrieved_docs = ensemble_retriever.invoke(question)
            
            # Этап переранжирования
            if not retrieved_docs:
                logger.info("Hybrid search returned no documents. Nothing to rerank.")
                return []

            logger.info(f"Reranking {len(retrieved_docs)} documents...")
            # Создаем пары [запрос, документ] для модели
            doc_pairs = [(question, doc.page_content) for doc in retrieved_docs]
            
            # Получаем баллы релевантности от модели
            scores = self.reranker.score(doc_pairs)
            
            # Объединяем документы с их баллами
            doc_scores = list(zip(retrieved_docs, scores))
            
            # Сортируем по убыванию балла
            sorted_doc_scores = sorted(doc_scores, key=lambda x: x[1], reverse=True)
            
            # Возвращаем только топ-3 документа после переранжирования
            reranked_docs = [doc for doc, score in sorted_doc_scores[:3]]
            
            logger.info(f"Reranking complete. Returning top {len(reranked_docs)} documents.")
            return reranked_docs

        except Exception as e:
            logger.error(f"Failed to query index for chat {chat_id}: {e}")
            return []