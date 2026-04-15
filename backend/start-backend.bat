@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    🚀 starting Dashboard IEEE Backend
echo ==========================================

:: 1. Check for Docker conflict
echo [1/3] Checking Docker containers...
for /f "tokens=*" %%i in ('docker ps -q --filter "name=dashboard_backend"') do (
    if not "%%i"=="" (
        echo ⚠️ Found running Docker container 'dashboard_backend'.
        set /p choice="Do you want to stop it to free port 4000? (y/n): "
        if /i "!choice!"=="y" (
            echo 🛑 Stopping Docker container...
            docker stop dashboard_backend
        ) else (
            echo ❌ Cannot proceed while Docker is holding the port.
            exit /b 1
        )
    )
)

:: 2. Check for local process conflict
echo [2/3] Checking for local port 4000 conflicts...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000 ^| findstr LISTENING') do (
    set PID=%%a
    if not "!PID!"=="" (
        echo ⚠️ Port 4000 is being used by local PID !PID!.
        echo 🛑 Terminating conflicting process...
        taskkill /F /PID !PID!
    )
)

:: 3. Start the server
echo [3/3] Starting Node.js server...
echo 💡 Tip: Press Ctrl+C to stop the server when done.
echo.
node server.js

pause
