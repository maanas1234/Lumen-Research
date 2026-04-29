@echo off
title AI Research Co-Pilot — Launcher
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║      AI Research Co-Pilot  Launcher      ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Set root to the folder this batch file lives in ──────────────────────────
set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend
set VENV=%ROOT%venv\Scripts

:: ── 1. Start Optimized Ollama (Forces reloading with multi-model capability) ───
echo [1/3] Optimizing Ollama environment...
taskkill /F /IM ollama.exe >NUL 2>&1
timeout /t 2 /nobreak >NUL

set OLLAMA_MAX_LOADED_MODELS=3
set OLLAMA_NUM_PARALLEL=2
set OLLAMA_FLASH_ATTENTION=1

echo      Starting optimized Ollama instance...
start "Ollama" /MIN cmd /c "ollama serve"
timeout /t 6 /nobreak >NUL
echo      Ollama running in multi-model caching mode.

:: ── 2. Start FastAPI Backend ─────────────────────────────────────────────────
echo [2/3] Starting FastAPI backend on port 8000...
start "Co-Pilot Backend" cmd /k "cd /d %BACKEND% && set PYTHONPATH=. && %VENV%\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >NUL

:: ── 3. Start Vite Frontend ───────────────────────────────────────────────────
echo [3/3] Starting frontend on port 5173...
start "Co-Pilot Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"
timeout /t 4 /nobreak >NUL

:: ── 4. Open browser ──────────────────────────────────────────────────────────
echo.
echo  Opening http://localhost:5173 in your browser...
start "" "http://localhost:5173"

echo.
echo  ✓ All services launched!
echo  ─────────────────────────────────────────
echo    Frontend  →  http://localhost:5173
echo    Backend   →  http://localhost:8000
echo    Ollama    →  http://localhost:11434
echo  ─────────────────────────────────────────
echo.
echo  Close the two terminal windows to stop the servers.
echo  Press any key to close this launcher window...
pause >NUL
