"""
AI Research Co-Pilot — FastAPI Backend
"""
import os
import uuid
import json
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any

import time
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

load_dotenv()

from document.processor import extract_text_and_metadata
from document.chunker import chunk_text
from embeddings.ollama_embeddings import OllamaEmbeddings
from storage.vector_store import VectorStoreManager
from rag.pipeline import RAGPipeline

# ── Config ────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL     = os.getenv("OLLAMA_MODEL", "qwen3:1.7b")
EMBED_MODEL      = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
UPLOAD_DIR       = Path(os.getenv("UPLOAD_DIR", "uploads"))
VECTOR_STORE_DIR = Path(os.getenv("VECTOR_STORE_DIR", "vector_stores"))
NOTES_DIR        = Path(os.getenv("NOTES_DIR", "notes"))
THREADS_DIR      = Path(os.getenv("THREADS_DIR", "threads"))
CHUNK_SIZE       = int(os.getenv("CHUNK_SIZE", 1000))
CHUNK_OVERLAP    = int(os.getenv("CHUNK_OVERLAP", 200))
TOP_K            = int(os.getenv("TOP_K_CHUNKS", 5))

for d in [UPLOAD_DIR, VECTOR_STORE_DIR, NOTES_DIR, THREADS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── App + Dependencies ────────────────────────────────────────────────────────
app = FastAPI(title="Lumen Research", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = VectorStoreManager(str(VECTOR_STORE_DIR))
embedder     = OllamaEmbeddings(OLLAMA_BASE_URL, EMBED_MODEL)

# Restore persisted model selection (survives backend restarts)
_settings_path = UPLOAD_DIR / "_settings.json"
if _settings_path.exists():
    try:
        _saved = json.loads(_settings_path.read_text())
        OLLAMA_MODEL = _saved.get("model", OLLAMA_MODEL)
    except Exception:
        pass

rag = RAGPipeline(OLLAMA_BASE_URL, OLLAMA_MODEL, EMBED_MODEL, vector_store, TOP_K)
print(f"[Config] Using model: {OLLAMA_MODEL}")

# In-memory paper registry (paper_id → metadata dict) — persisted to disk
_papers: Dict[str, Dict[str, Any]] = {}
# Thread registry (thread_id → thread data) — persisted to disk
_threads: Dict[str, Dict[str, Any]] = {}


def _papers_registry_path() -> Path:
    return UPLOAD_DIR / "_registry.json"

def _load_registry():
    p = _papers_registry_path()
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return {}

def _save_registry():
    with open(_papers_registry_path(), "w") as f:
        json.dump(_papers, f, indent=2)

_papers = _load_registry()

# ── Thread persistence ────────────────────────────────────────────────────────
def _threads_registry_path() -> Path:
    return THREADS_DIR / "_registry.json"

def _load_threads() -> Dict[str, Dict[str, Any]]:
    p = _threads_registry_path()
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return {}

def _save_threads():
    with open(_threads_registry_path(), "w") as f:
        json.dump(_threads, f, indent=2)

_threads: Dict[str, Dict[str, Any]] = _load_threads()

# ── Startup: pre-load FAISS indexes for all indexed papers ────────────────────
@app.on_event("startup")
async def _preload_indexes():
    """Load all existing FAISS indexes into memory at startup so the first
    chat request on any paper is instant (no per-request disk load)."""
    loaded = 0
    for paper_id, meta in _papers.items():
        if meta.get("indexed") and vector_store.index_exists(paper_id):
            try:
                vector_store._load_index(paper_id)
                loaded += 1
            except Exception as e:
                print(f"[WARN] Could not pre-load index for {paper_id}: {e}")
    print(f"[Startup] Pre-loaded {loaded} FAISS index(es) into memory.")


class ChatRequest(BaseModel):
    paper_id: str
    question: str
    history: List[Dict[str, str]] = []
    mode: str = "research"

class ExplainRequest(BaseModel):
    action: str  # explain_simple | explain_math | derive_steps | give_intuition | give_analogy
    text: str
    paper_id: Optional[str] = None

class ThreadCreateRequest(BaseModel):
    paper_id: str
    topic: str
    mode: str = "research"

class ThreadChatRequest(BaseModel):
    question: str
    mode: str = "research"

class NoteRequest(BaseModel):
    paper_id: str
    content: str
    source: Optional[str] = None
    tag: Optional[str] = None

class ModelSelectRequest(BaseModel):
    model: str

# ── Health & Models ───────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
        return {"status": "ok", "ollama": "connected", "model": OLLAMA_MODEL}
    except Exception as e:
        return {"status": "degraded", "ollama": str(e), "model": OLLAMA_MODEL}

@app.get("/api/models")
async def list_models():
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        r.raise_for_status()
        data = r.json()
        return {"models": [m["name"] for m in data.get("models", [])]}

@app.post("/api/models/select")
async def select_model(req: ModelSelectRequest):
    global OLLAMA_MODEL
    OLLAMA_MODEL = req.model
    rag.model = req.model
    # Persist so it survives backend restarts
    _settings_path.write_text(json.dumps({"model": req.model}))
    return {"model": OLLAMA_MODEL}

# ── PDF Upload + Processing ───────────────────────────────────────────────────
@app.post("/api/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    paper_id = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{paper_id}.pdf"

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Extract metadata immediately (fast)
    meta = extract_text_and_metadata(str(save_path))

    paper_record = {
        "paper_id": paper_id,
        "filename": file.filename,
        "title": meta["title"],
        "author": meta["author"],
        "total_pages": meta["total_pages"],
        "indexed": False,
        "math_regions": meta["math_regions"][:50],  # store top 50
    }
    _papers[paper_id] = paper_record
    _save_registry()

    # Index in background (can take a few seconds)
    background_tasks.add_task(_index_paper, paper_id, meta)

    return {
        "paper_id": paper_id,
        "title": paper_record["title"],
        "author": paper_record["author"],
        "total_pages": paper_record["total_pages"],
        "message": "PDF uploaded. Indexing in background...",
    }

async def _index_paper(paper_id: str, meta: Dict[str, Any]):
    """Background task: chunk text, embed, store in FAISS."""
    try:
        chunks = chunk_text(
            meta["full_text"],
            meta["page_texts"],
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )
        texts = [c["text"] for c in chunks]
        embeddings = await embedder.embed_batch(texts)
        vector_store.create_index(paper_id, chunks, embeddings)
        _papers[paper_id]["indexed"] = True
        _save_registry()
    except Exception as e:
        print(f"[ERROR] Indexing paper {paper_id}: {e}")

@app.get("/api/papers")
async def list_papers():
    return {"papers": list(_papers.values())}

@app.get("/api/papers/{paper_id}")
async def get_paper(paper_id: str):
    if paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    return _papers[paper_id]

@app.get("/api/papers/{paper_id}/status")
async def get_paper_status(paper_id: str):
    if paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    return {
        "paper_id": paper_id,
        "indexed": _papers[paper_id].get("indexed", False),
    }

@app.get("/api/papers/{paper_id}/chat")
async def get_paper_chat(paper_id: str):
    if paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    history_path = UPLOAD_DIR / f"{paper_id}_chat.json"
    if history_path.exists():
        with open(history_path) as f:
            return {"messages": json.load(f)}
    return {"messages": []}

@app.get("/api/papers/{paper_id}/pdf")
async def serve_pdf(paper_id: str):
    path = UPLOAD_DIR / f"{paper_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "PDF not found")
    return FileResponse(path, media_type="application/pdf")

@app.delete("/api/papers/{paper_id}")
async def delete_paper(paper_id: str):
    if paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    pdf_path = UPLOAD_DIR / f"{paper_id}.pdf"
    if pdf_path.exists():
        pdf_path.unlink()
    try:
        vector_store.delete_index(paper_id)
    except Exception:
        pass
    del _papers[paper_id]
    _save_registry()
    return {"message": "Paper deleted"}

# ── Chat (Main RAG) ───────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    if not _papers[req.paper_id].get("indexed"):
        raise HTTPException(503, "Paper is still being indexed, please wait...")

    async def event_stream():
        full_response = ""
        sources_list = []
        async for chunk in rag.stream_chat(
            req.paper_id, req.question, req.history, req.mode
        ):
            yield f"data: {chunk}\n"
            try:
                data = json.loads(chunk)
                if data.get("type") == "token":
                    full_response += data["content"]
                elif data.get("type") == "sources":
                    sources_list = data["sources"]
            except Exception:
                pass

        # Save to main chat history
        history_path = UPLOAD_DIR / f"{req.paper_id}_chat.json"
        history = []
        if history_path.exists():
            with open(history_path) as f:
                history = json.load(f)

        # Append User Message
        history.append({
            "id": str(int(time.time() * 1000)),
            "role": "user",
            "content": req.question,
            "timestamp": int(time.time() * 1000)
        })

        # Append Assistant Message
        history.append({
            "id": str(int(time.time() * 1000) + 1),
            "role": "assistant",
            "content": full_response,
            "sources": sources_list,
            "timestamp": int(time.time() * 1000)
        })

        with open(history_path, "w") as f:
            json.dump(history, f, indent=2)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ── Text Selection Explain ────────────────────────────────────────────────────
@app.post("/api/explain")
async def explain(req: ExplainRequest):
    valid_actions = {"explain_simple", "explain_math", "derive_steps", "give_intuition", "give_analogy"}
    if req.action not in valid_actions:
        raise HTTPException(400, f"Invalid action. Must be one of: {valid_actions}")

    async def event_stream():
        async for chunk in rag.stream_explain(req.action, req.text):
            yield f"data: {chunk}\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ── Summary ───────────────────────────────────────────────────────────────────
@app.get("/api/summary/{paper_id}")
async def get_summary(paper_id: str):
    if paper_id not in _papers:
        raise HTTPException(404, "Paper not found")

    # Check cache
    cache_path = UPLOAD_DIR / f"{paper_id}_summary.json"
    if cache_path.exists():
        with open(cache_path) as f:
            return json.load(f)

    meta = extract_text_and_metadata(str(UPLOAD_DIR / f"{paper_id}.pdf"))

    async def event_stream():
        full = ""
        async for chunk in rag.stream_summary(meta["full_text"]):
            full += chunk
            yield f"data: {chunk}\n"
        # Cache the summary
        with open(cache_path, "w") as f:
            json.dump({"paper_id": paper_id, "summary": full}, f)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ── Deep Dive Threads ─────────────────────────────────────────────────────────
@app.post("/api/threads")
async def create_thread(req: ThreadCreateRequest):
    if req.paper_id not in _papers:
        raise HTTPException(404, "Paper not found")
    thread_id = str(uuid.uuid4())[:8]
    _threads[thread_id] = {
        "thread_id": thread_id,
        "paper_id": req.paper_id,
        "topic": req.topic,
        "mode": req.mode,
        "history": [],
    }
    _save_threads()  # persist immediately
    return {"thread_id": thread_id, "topic": req.topic}

@app.get("/api/threads")
async def list_threads():
    return {"threads": list(_threads.values())}

@app.get("/api/threads/{thread_id}")
async def get_thread(thread_id: str):
    if thread_id not in _threads:
        raise HTTPException(404, "Thread not found")
    return _threads[thread_id]

@app.post("/api/threads/{thread_id}/chat")
async def thread_chat(thread_id: str, req: ThreadChatRequest):
    if thread_id not in _threads:
        raise HTTPException(404, "Thread not found")
    thread = _threads[thread_id]

    async def event_stream():
        full_response = ""
        async for chunk in rag.stream_thread(
            thread["paper_id"],
            thread["topic"],
            req.question,
            thread["history"],
            req.mode or thread["mode"],
        ):
            yield f"data: {chunk}\n"
            try:
                data = json.loads(chunk)
                if data.get("type") == "token":
                    full_response += data["content"]
            except Exception:
                pass
        # Save to thread history and persist
        thread["history"].append({"role": "user", "content": req.question})
        thread["history"].append({"role": "assistant", "content": full_response})
        _save_threads()

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.delete("/api/threads/{thread_id}")
async def delete_thread(thread_id: str):
    if thread_id not in _threads:
        raise HTTPException(404, "Thread not found")
    del _threads[thread_id]
    _save_threads()
    return {"message": "Thread deleted"}

@app.post("/api/threads/{thread_id}/promote")
async def promote_insight(thread_id: str, body: Dict[str, str]):
    """Promote a key insight from a thread to the main context (returns formatted text)."""
    if thread_id not in _threads:
        raise HTTPException(404, "Thread not found")
    thread = _threads[thread_id]
    insight = body.get("insight", "")
    return {
        "promoted_text": f"💡 Insight from Deep Dive [{thread['topic']}]:\n\n{insight}",
        "topic": thread["topic"],
    }

# ── Notes ─────────────────────────────────────────────────────────────────────
@app.post("/api/notes")
async def save_note(req: NoteRequest):
    notes_file = NOTES_DIR / f"{req.paper_id}.json"
    notes = []
    if notes_file.exists():
        with open(notes_file) as f:
            notes = json.load(f)
    note = {
        "id": str(uuid.uuid4())[:8],
        "content": req.content,
        "source": req.source,
        "tag": req.tag,
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    notes.append(note)
    with open(notes_file, "w") as f:
        json.dump(notes, f, indent=2)
    return note

@app.get("/api/notes/{paper_id}")
async def get_notes(paper_id: str):
    notes_file = NOTES_DIR / f"{paper_id}.json"
    if not notes_file.exists():
        return {"notes": []}
    with open(notes_file) as f:
        return {"notes": json.load(f)}

@app.delete("/api/notes/{paper_id}/{note_id}")
async def delete_note(paper_id: str, note_id: str):
    notes_file = NOTES_DIR / f"{paper_id}.json"
    if not notes_file.exists():
        raise HTTPException(404, "No notes found")
    with open(notes_file) as f:
        notes = json.load(f)
    notes = [n for n in notes if n["id"] != note_id]
    with open(notes_file, "w") as f:
        json.dump(notes, f, indent=2)
    return {"message": "Note deleted"}
