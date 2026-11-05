@echo off
title SMART TIMETABLE - Kashmir Government Polytechnic Srinagar
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3 and enable "Add Python to PATH".
  pause
  exit /b 1
)
start "SMART TIMETABLE Server" /min cmd /c "cd /d ""%~dp0"" && python app.py"
echo Starting SMART TIMETABLE...
set "URL=http://127.0.0.1:8000"
for /l %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing '%URL%/api/status' -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)
echo Server did not start. Check Python installation or whether port 8000 is in use.
pause
exit /b 1
:ready
start "" "%URL%"
echo SMART TIMETABLE opened in your default browser.
