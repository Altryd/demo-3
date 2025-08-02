import requests
from src.utlis.logging_config import get_logger
import base64
from src.config.config import Config

logger = get_logger(__name__)

UPLOAD_URL = "https://temp.sh/upload"
IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload"

def upload_to_imgbb(file_bytes: bytes) -> str | None:
    """
    Uploads an image to ImgBB using their API and returns the public URL.
    """
    try:
        api_key = Config.IMGBB_API_KEY
        if not api_key:
            logger.error("IMGBB_API_KEY is not configured. Cannot upload image.")
            return None

        logger.info(f"Attempting to upload image to ImgBB.")

        # Кодируем байты изображения в base64, как требует API ImgBB
        base64_image = base64.b64encode(file_bytes).decode('utf-8')

        # Готовим данные для POST-запроса
        payload = {
            'key': api_key,
            'image': base64_image
        }

        # Выполняем POST-запрос
        response = requests.post(IMGBB_UPLOAD_URL, data=payload, timeout=120)

        # Проверяем на наличие HTTP-ошибок (4xx или 5xx)
        response.raise_for_status()

        # Парсим JSON-ответ
        json_response = response.json()

        # Проверяем, был ли успешным ответ от API
        if json_response.get("success"):
            download_url = json_response["data"]["url"]
            logger.info(f"Successfully uploaded image to ImgBB. URL: {download_url}")
            return download_url
        else:
            error_message = json_response.get("error", {}).get("message", "Unknown ImgBB API error")
            logger.error(f"ImgBB API returned an error: {error_message}")
            return None

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error during file upload to ImgBB: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in upload_to_imgbb: {e}")
        return None

def upload_to_tempsh(file_bytes: bytes, filename: str) -> str | None:
    """
    Загружает файл на temp.sh с помощью POST-запроса на эндпоинт /upload
    и возвращает публичную ссылку.
    """
    try:
        logger.info(f"Attempting to upload '{filename}' to {UPLOAD_URL}")

        # Готовим данные для multipart/form-data
        # Ключ 'file' - это то, что ожидает сервер temp.sh
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