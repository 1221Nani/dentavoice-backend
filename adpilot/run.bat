@echo off
title AdPilot AI

echo Starting AdPilot AI...

:: Kill any existing processes on these ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

timeout /t 1 /nobreak >nul

:: Start backend
start "AdPilot Backend" /min cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn main:app --port 8000"

timeout /t 5 /nobreak >nul

:: Start frontend
start "AdPilot Frontend" /min cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 4 /nobreak >nul

echo.
echo  AdPilot is running:
echo   App:  http://localhost:5173
echo   API:  http://localhost:8000
echo.
echo  Login: krishna.jagadish2@gmail.com / Adpilot@123
echo.
echo  Both server windows are minimized in the taskbar.
echo  Do NOT close them or the app will stop working.
echo.
start http://localhost:5173
pause
