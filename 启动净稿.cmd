@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. See runtime\launcher\logs. Press any key to close.
  pause >nul
  exit /b 1
)
exit /b 0
