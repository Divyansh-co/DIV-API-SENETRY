@echo off
REM ========================================================
REM APISentry - GitHub Repository Setup & Push Helper
REM Author: Divyansh Mishra
REM ========================================================

echo.
echo ========================================================
echo   APISentry - Git ^& GitHub Deployment Assistant
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Git installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH.
    pause
    exit /b 1
)

echo [2/4] Staging changes...
git add .

echo.
set /p commit_msg="Enter commit message (Press Enter for default: 'Update APISentry'): "
if "%commit_msg%"=="" set commit_msg=Update APISentry

git commit -m "%commit_msg%"

echo.
echo [3/4] Pushing to GitHub...
git push origin main

echo.
echo ========================================================
echo   Done! APISentry changes pushed to GitHub.
echo   https://github.com/Divyansh-co/DIV-API-SENETRY
echo ========================================================
echo.
pause
