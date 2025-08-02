@echo off
setlocal EnableDelayedExpansion
cd frontend

call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install frontend packages
    exit /b 1
)
call npm run dev
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to run frontend
    exit /b 1
)

endlocal