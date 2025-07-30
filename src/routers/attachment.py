from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
# ИЗМЕНЕНИЕ: Импортируем новую функцию для temp.sh вместо старой
from src.utlis.file_uploader import upload_to_tempsh
from src.backend.models import AttachmentCreate
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(
    prefix="/attachments",
    tags=["attachments"]
)


@router.post("/upload", response_model=List[AttachmentCreate])
async def upload_attachments(files: List[UploadFile] = File(...)):
    """
    Accepts one or more files, uploads them to temp.sh,
    and returns their metadata upon success.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files were sent.")

    uploaded_files_data = []

    for file in files:
        # Асинхронно читаем содержимое файла
        file_bytes = await file.read()
        filename = file.filename
        file_size = len(file_bytes)
        content_type = file.content_type

        logger.info(f"Preparing to upload file: {filename}, size: {file_size}, type: {content_type}")

        # ИЗМЕНЕНИЕ: Используем нашу НОВУЮ утилиту для загрузки на temp.sh
        file_url = upload_to_tempsh(file_bytes=file_bytes, filename=filename)

        # Если загрузка любого из файлов не удалась, прерываем операцию
        if not file_url:
            logger.error(f"Failed to upload file: {filename}")
            raise HTTPException(
                status_code=500,
                detail=f"Could not upload file: {filename}. Please try again."
            )

        # Собираем данные об успешно загруженном файле
        attachment_data = AttachmentCreate(
            url=file_url,
            file_name=filename,
            file_type=content_type,
            file_size=file_size
        )
        uploaded_files_data.append(attachment_data)

    return uploaded_files_data