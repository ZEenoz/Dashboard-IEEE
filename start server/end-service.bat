@echo off
title Closing Dashboard IEEE...
echo ==========================================
echo   Stopping Dashboard IEEE Services
echo ==========================================

echo [1/4] Stopping Frontend Docker Containers...
cd /d "%~dp0..\frontend"
docker-compose down
cd /d "%~dp0"

echo [2/4] Stopping Main Docker Containers...
docker-compose down

echo [3/4] Stopping Node.js Processes...
echo -- Closing Backend Window...
taskkill /F /FI "WINDOWTITLE eq Backend - Dashboard IEEE*" /T >nul 2>&1
taskkill /F /IM "node.exe" >nul 2>&1

echo -- Closing Frontend Window...
taskkill /F /FI "WINDOWTITLE eq Frontend - Dashboard IEEE*" /T >nul 2>&1

echo [4/4] Stopping ngrok Process...
echo -- Closing ngrok Window...
taskkill /F /FI "WINDOWTITLE eq ngrok - Dashboard IEEE*" /T >nul 2>&1
taskkill /F /IM "ngrok.exe" >nul 2>&1

echo.
echo ==========================================
echo   All services have been stopped.
echo ==========================================
pause