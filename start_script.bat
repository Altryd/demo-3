@echo off
setlocal EnableDelayedExpansion

cd src\backend

docker-compose --env-file ../../.env up -d
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to start Docker Compose.
    exit /b 1
)

cd ..\..

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not found. Ensure Python 3.11 is installed and added to PATH.
    exit /b 1
)

:: creating venv
if not exist .venv (
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to create virtual environment.
        exit /b 1
    )
)

call .venv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to activate virtual environment.
    exit /b 1
)

python -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install requirements.
    exit /b 1
)

python -m src.server
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to start the server.
    exit /b 1
)

endlocal