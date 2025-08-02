import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Google envs
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        # 'https://www.googleapis.com/auth/tasks.readonly',
        'openid',  # Стандарт для аутентификации
        'https://www.googleapis.com/auth/userinfo.email',  # Доступ к email
        'https://www.googleapis.com/auth/userinfo.profile'  # Доступ к имени и аватару
    ]
    # Настроить если нужно потом релизнуть куда-то
    REDIRECT_URI = "http://localhost:8000/auth/callback"

    MYSQL_DATABASE_URL = (f"mysql+mysqlconnector://{os.getenv('MYSQL_USER')}:"
                          f"{os.getenv('MYSQL_PASSWORD')}@127.0.0.1:3308/{os.getenv('MYSQL_DATABASE')}")
    FILL_MYSQL_IF_EMPTY = True
    POSTGRES_DATABASE_URL = (f"postgresql+pg8000://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@"
                             f"{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}")

    IMGBB_API_KEY = os.getenv("IMGBB_API_KEY")

    USE_CASE = "API"
    LANGSMITH_TRACING = True
    LANGSMITH_ENDPOINT = "https://api.smith.langchain.com"
    LANGSMITH_PROJECT = "pr-notable-divider-48"

    MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
    MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "openrouter").lower()
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    OPENROUTER_MODEL = os.getenv(
        "OPENROUTER_MODEL",
        "deepseek/deepseek-chat-v3-0324:free")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

    LLM_API_KEY = os.getenv("KIMI_API_KEY")
    LLM_BASE_URL = "https://openrouter.ai/api/v1"
    LLM_MODEL = "google/gemma-3n-e2b-it:free"

    EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB = "osu_agent"
    MONGODB_COLLECTION = "documents"
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6381/0")
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

    FASTAPI_HOST = "0.0.0.0"
    FASTAPI_PORT = 8000

    MAX_QUERY_LENGTH = 500
    ALLOWED_LANGUAGES = ["ru", "en"]

    DATA_DIR = "data/"
    RAG_DIR = "rag_database"
    FT_DIR = "fine-tuning/dataset"

    # frontend network
    FRONTEND_ADDRESS = "http://localhost:5173"
