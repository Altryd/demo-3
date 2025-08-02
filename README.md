# Основная (продакшн) ветка проекта демо-3

### Задание: https://disk.yandex.ru/i/RbAw5gF6gJWhmA

# Тематика приложения
Использование Google Calendar, OCR, RAG, анализа данных из базы данных.
**FastAPI + React.JS**

# Установка и запуск
## API Keys
- Необходимо получить API ключи с сайтов mistral, openrouter, imgbb. Помимо этого, также создайте OAuth клиент в Google Cloud (для этого нужно целую инструкцию расписывать ngl, .. А потом еще забрать нужные credentials.. + добавить test users в этом Google Cloud)
- `mv .env.example .env`
- в .env загрузите все нужные ключи и API

## Старт приложения:
- Для старта бекенда с использованием conda запустите start_script_conda.bat (если есть conda и пути к conda прописаны в PATH)
- Для старта бекенда с использованием обычного venv запустите start_script.bat  (рекомендуется иметь python=3.11)
- Для старта бекенда на **Linux** запустите start_script.sh (экспериментальный! не проверено на линуксе) 
- Для запуска фронтенда выполните start_frontend.bat