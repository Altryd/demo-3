import os
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)

RAG_INDEXES_DIR = "rag_indexes"
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

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
        logger.info("RAGService initialized successfully.")

    def _get_index_path(self, chat_id: int) -> str:
        return os.path.join(RAG_INDEXES_DIR, f"chat_{chat_id}")

    # --- НОВЫЙ МЕТОД ---
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
            
            # FAISS хранит метаданные в docstore. Мы можем проверить их.
            if not hasattr(vector_store, 'docstore') or not hasattr(vector_store.docstore, '_dict'):
                logger.warning(f"Docstore not found or in unexpected format for chat {chat_id}.")
                return False

            # Итерируемся по всем документам в хранилище
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
            
            if file_path.lower().endswith(".pdf"):
                loader = PyPDFLoader(file_path)
            elif file_path.lower().endswith(".docx"):
                loader = Docx2txtLoader(file_path)
            else:
                logger.warning(f"Unsupported file type for RAG: {file_path}. Skipping.")
                return []

            documents = loader.load()
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Document split into {len(chunks)} chunks.")

            index_path = self._get_index_path(chat_id)

            if os.path.exists(index_path):
                logger.info(f"Index for chat {chat_id} already exists. Loading and updating.")
                vector_store = FAISS.load_local(index_path, self.embedding_model, allow_dangerous_deserialization=True)
                vector_store.add_documents(chunks)
            else:
                logger.info(f"Creating a new index for chat {chat_id}.")
                vector_store = FAISS.from_documents(chunks, self.embedding_model)
            
            vector_store.save_local(index_path)
            logger.info(f"Successfully saved index for chat {chat_id} to '{index_path}'.")

            return chunks

        except Exception as e:
            logger.error(f"Failed to add document to index for chat {chat_id}: {e}")
            return []

    def query_index(self, question: str, chat_id: int) -> list:
        index_path = self._get_index_path(chat_id)

        if not os.path.exists(index_path):
            logger.info(f"No index found for chat {chat_id}. Returning empty context.")
            return []

        try:
            vector_store = FAISS.load_local(index_path, self.embedding_model, allow_dangerous_deserialization=True)
            logger.info(f"Querying index for chat {chat_id} with question: '{question[:50]}...'")
            
            retrieved_docs = vector_store.similarity_search(question, k=3)
            
            logger.info(f"Found {len(retrieved_docs)} relevant chunks.")
            return retrieved_docs

        except Exception as e:
            logger.error(f"Failed to query index for chat {chat_id}: {e}")
            return []