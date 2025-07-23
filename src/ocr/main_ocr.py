import base64

import easyocr
from typing import List

from dotenv import load_dotenv
from mistralai import Mistral
import numpy as np
from PIL import Image
import io
import os
import requests
from langchain_core.tools import tool
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)


def read_from_image_easyocr(image_path: str, languages: List[str] = ['en']):
    """
        Reads text from an image using OCR. Supports local image paths or URLs.

        Args:
            image_path (str): Path to the image file or URL of the image (e.g., 'image.png' or 'https://example.com/image.jpg')
            languages (list): A list of languages to detect. Example: ['en', 'ru', 'ja']. Defaults to ['en'].

        Returns:
            dict: {'text': extracted_text, 'status': 'success'} or {'error': error_message, 'status': 'error'} if failed.
    """

    try:
        if not languages or not all(isinstance(lang, str) for lang in languages):
            raise ValueError("Languages must be a non-empty list of strings, e.g., ['en', 'ru'].")
        if image_path.startswith(('http://', 'https://')):
            logger.info(f"Downloading image from URL: {image_path}")
            response = requests.get(image_path, timeout=10)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content)).convert('RGB')
            image_np = np.array(image)
        else:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found at: {image_path}")
            image = Image.open(image_path).convert('RGB')
            image_np = np.array(image)
        reader = easyocr.Reader(languages)
        result = reader.readtext(image_np, paragraph=True, detail=1)

        if not result:
            return {"text": "No text detected in the image.", "status": "success"}

        extracted_text = "\n".join([item[1] for item in result])
        return {"text": extracted_text, "status": "success"}
    except requests.exceptions.RequestException as e:
        logger.error(f"Error downloading image from URL: {e}")
        return {"error": f"Failed to download image: {e}", "status": "error"}
    except FileNotFoundError as e:
        logger.error(f"File error: {e}")
        return {"error": str(e), "status": "error"}
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"error": str(e), "status": "error"}
    except Exception as e:
        logger.error(f"Unexpected error in OCR: {e}")
        return {"error": f"Exception occurred while reading text: {e}", "status": "error"}


_mistral_client = None

def get_mistral_client():
    global _mistral_client
    if not _mistral_client:
        load_dotenv()
        api_key = os.getenv("MISTRAL_API_KEY")
        _mistral_client = Mistral(api_key=api_key)
    return _mistral_client


def mistral_ocr(image_path: str) -> dict:
    """Performs OCR using Mistral API on a local image or URL."""
    client = get_mistral_client()
    try:
        if image_path.startswith(('http://', 'https://')):
            if image_path.startswith('http://'):  # TODO: that's a cringe fix but it is that it is..
                image_path = image_path.replace('http://', 'https://')
            ocr_response = client.ocr.process(
                model="mistral-ocr-latest",
                document={"type": "image_url", "image_url": image_path},
                include_image_base64=True
            )
        else:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
                ocr_response = client.ocr.process(
                    model="mistral-ocr-latest",
                    document={"type": "image_url", "image_url": f"data:image/png;base64,{base64_image}"},
                    include_image_base64=True
                )
        text = "No text detected."
        if len(ocr_response.pages) > 0:
            text = "\n".join([page.markdown for page in ocr_response.pages])
        return {"text": text, "status": "success"}
    except Exception as e:
        return {"error": f"Mistral OCR error: {str(e)}", "status": "error"}

@tool
def read_from_image(image_path: str, languages: List[str] = ['en']):
    """
        Reads text from an image using OCR. Supports local image paths or URLs.

        Args:
            image_path (str): Path to the image file or URL of the image (e.g., 'image.png' or 'https://example.com/image.jpg')
            languages (list): A list of languages to detect. Example: ['en', 'ru', 'ja']. Defaults to ['en'].

        Returns:
            dict: {'text': extracted_text, 'status': 'success'} or {'error': error_message, 'status': 'error'} if failed.
    """
    mistral_result = mistral_ocr(image_path)
    if mistral_result["status"] == "success" and mistral_result["text"].strip():
        text = mistral_result["text"]
    else:
        logger.warning(f"Mistral OCR failed for the image: {image_path}")
        easy_result = read_from_image_easyocr(image_path, languages=languages)
        if easy_result["status"] == "success" and easy_result["text"].strip():
            text = easy_result["text"]
        else:
            logger.error(f"Both OCR methods failed for the image: {image_path}")
            return {"error": "Both OCR methods failed.", "status": "error"}
    return {"text": text, "status": "success"}


if __name__ == "__main__":
    mistral_res = mistral_ocr("http://0x0.st/8dY5.png")
    result = read_from_image.invoke("http://0x0.st/8dY5.png", languages=['ru', 'en'])
    print(result)
    print(f"mistral_res: {mistral_res}")
