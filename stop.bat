@echo off
title Stopping Co-Pilot...
echo Stopping AI Research Co-Pilot services...

:: Kill node (Vite)
taskkill /F /FI "WINDOWTITLE eq Co-Pilot Frontend*" >NUL 2>&1

:: Kill python (uvicorn)
taskkill /F /FI "WINDOWTITLE eq Co-Pilot Backend*" >NUL 2>&1

:: Optional: kill ollama too (comment out if you want to keep it running)
:: taskkill /F /IM ollama.exe >NUL 2>&1

echo All Co-Pilot services stopped.
timeout /t 2 /nobreak >NUL
