@echo off
setlocal EnableDelayedExpansion

cd src\backend
docker-compose --env-file ../../.env up -d

cd ..\..

:: conda is available?
where conda >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Conda is not found. Ensure Anaconda/Miniconda is installed and added to PATH.
    exit /b 1
)

call conda create -n demo-3-assistant python=3.11 -y
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create Conda environment.
    exit /b 1
)


call conda activate demo-3-assistant
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to activate Conda environment.
    exit /b 1
)

call python -m pip install -r requirements.txt
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