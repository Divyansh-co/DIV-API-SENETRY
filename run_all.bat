@echo off
echo ===================================================
echo   Starting APISentry Full Stack Services
echo ===================================================

echo [1/3] Starting Sample Target API (port 8001)...
start "APISentry - Sample Target API" cmd /k "cd sample-api\app && python -m uvicorn main:app --host 127.0.0.1 --port 8001"

echo [2/3] Starting APISentry Backend (port 8000)...
start "APISentry - Backend Engine" cmd /k "cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Starting APISentry Dashboard (port 5173)...
start "APISentry - Frontend Dashboard" cmd /k "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo.
echo All services have been launched!
echo - Dashboard:   http://localhost:5173
echo - Backend API: http://localhost:8000/docs
echo - Sample API:  http://localhost:8001/docs
echo.
pause
