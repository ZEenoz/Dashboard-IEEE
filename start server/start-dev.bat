@echo off
title Dashboard IEEE Launcher
echo ==========================================
echo   Starting Dashboard IEEE Dev Environment
echo ==========================================

REM Root directory = parent of this bat file's folder
set "ROOT=%~dp0.."

echo [1/3] Starting Docker Services (Postgres ^& MQTT)...
docker-compose -f "%ROOT%\docker-compose.yml" up -d
if %errorlevel% neq 0 (
    echo Failed to start Docker. Please ensure Docker Desktop is running.
    pause
    exit /b
)

echo.
echo [2/3] Starting Backend Server...
start "Backend - Dashboard IEEE" cmd /k "cd /d "%ROOT%\backend" && echo Starting Backend... && node server.js"

echo.
echo [3/3] Starting Frontend (Next.js)...
echo -- Starting Frontend Docker Services (CPM)...
docker-compose -f "%ROOT%\frontend\docker-compose.yml" up -d
start "Frontend - Dashboard IEEE" cmd /k "cd /d "%ROOT%\frontend" && echo Starting Frontend... && npm run dev"

echo.
echo [4/4] Starting ngrok for LINE OA (Port 5000)...
start "ngrok - Dashboard IEEE" cmd /k "ngrok http 5000"

echo.
echo ==========================================
echo   All services launched!
echo   - Backend: http://localhost:4000
echo   - Frontend: http://localhost:3000
echo   - ngrok URL will appear in the new window!
echo ==========================================
echo.
pause
