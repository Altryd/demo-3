import requests
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)

# ИЗМЕНЕНИЕ: URL для эндпоинта загрузки, а не базовый URL
UPLOAD_URL = "https://temp.sh/upload"


# ИЗМЕНЕНИЕ: Функция полностью переписана для использования POST-запроса
def upload_to_tempsh(file_bytes: bytes, filename: str) -> str | None:
    """
    Загружает файл на temp.sh с помощью POST-запроса на эндпоинт /upload
    и возвращает публичную ссылку.
    """
    try:
        logger.info(f"Attempting to upload '{filename}' to {UPLOAD_URL}")

        # Готовим данные для multipart/form-data.
        # Ключ 'file' - это то, что ожидает сервер temp.sh.
        files_payload = {'file': (filename, file_bytes)}

        # Выполняем POST-запрос
        response = requests.post(UPLOAD_URL, files=files_payload, timeout=120)

        # Проверяем на наличие HTTP-ошибок (4xx или 5xx)
        response.raise_for_status()

        # В случае успеха, тело ответа содержит прямую ссылку на файл
        download_url = response.text
        logger.info(f"Successfully uploaded '{filename}'. URL: {download_url}")
        return download_url

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error during file upload to temp.sh: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in upload_to_tempsh: {e}")
        return None