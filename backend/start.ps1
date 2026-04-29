# Start backend (activate venv and run uvicorn)
$env:PYTHONPATH = "."
..\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
