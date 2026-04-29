# AI Research Co-Pilot 🚀

A local-first AI tool to deeply understand research papers — with RAG-powered chat, math explanations, deep dive threads, and zero cloud dependency.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend |
| Node.js | 18+ | Frontend |
| Ollama | Any | Local LLM |

---

## Quick Start

### 1. Pull required Ollama models

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

> You can use any model. Change `OLLAMA_MODEL` in `backend/.env` to match.

---

### 2. Start the Backend

Open a terminal in the project root:

```powershell
# From Paper_Reader/ directory
.\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Run from within the backend/ directory:
# cd backend; ..\venv\Scripts\python.exe -m uvicorn main:app --reload
```

Or use the included script:
```powershell
cd backend
.\start.ps1
```

Backend runs at: **http://localhost:8000**

---

### 3. Start the Frontend

Open a second terminal:

```powershell
cd frontend
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Configuration (`backend/.env`)

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2          # Change to your preferred model
OLLAMA_EMBED_MODEL=nomic-embed-text
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K_CHUNKS=5
```

---

## How to Use

### Upload a Paper
1. Drag & drop a PDF onto the sidebar, or click "Browse"
2. The paper uploads instantly; indexing runs in the background (~10-30s)
3. A ✓ indicator appears when indexing is complete

### Chat
- Type any question in the chat panel (right side)
- Toggle **ELI5 / Exam / Research** mode to change explanation depth
- Sources used are shown below each answer

### Text Selection → Smart Actions
1. Highlight any text in the PDF viewer
2. A popup appears with options:
   - **Explain Simply** — Plain English, analogies
   - **Explain Mathematically** — LaTeX notation, formal
   - **Derive Step-by-Step** — Every intermediate step shown
   - **Give Intuition** — "Why does this make sense?"
   - **Give Analogy** — Real-world mapping
   - **Open Deep Dive Thread** — Isolated concept exploration
   - **Save to Notes** — Persist the excerpt

### Deep Dive Threads
- Click a thread tab to enter isolated conversation
- Each thread has its own memory — won't pollute main chat
- Click ⭐ **Promote** on any response to send it to main chat
- Create new threads from the + button in the thread header

### Summary
- Click **Paper Summary** in the sidebar bottom
- Auto-generates: TL;DR, key contributions, formulas, suggested questions

### Notes
- Click **My Notes** in the sidebar
- See all saved notes with timestamps and source tags
- Delete individual notes

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Focus chat input |
| `Enter` | Send message |
| `Shift+Enter` | New line in chat |

---

## Architecture

```
Paper_Reader/
├── venv/                    ← Python virtual environment
├── backend/
│   ├── main.py              ← FastAPI server (port 8000)
│   ├── rag/
│   │   ├── pipeline.py      ← RAG + Ollama streaming
│   │   └── prompts.py       ← All system prompts
│   ├── document/
│   │   ├── processor.py     ← PyMuPDF text extraction
│   │   └── chunker.py       ← Sliding window chunker
│   ├── embeddings/
│   │   └── ollama_embeddings.py  ← Ollama /api/embeddings
│   └── storage/
│       └── vector_store.py  ← FAISS cosine similarity
├── frontend/
│   └── src/
│       ├── components/      ← All React components
│       ├── store/           ← Zustand global state
│       └── utils/api.ts     ← SSE streaming API client
├── uploads/                 ← PDFs stored here
├── vector_stores/           ← FAISS indexes per paper
└── notes/                   ← User notes (JSON)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Paper is still indexing" | Wait 10–30s; indexing uses embedding model |
| Chat returns empty | Check Ollama is running: `ollama list` |
| No models in dropdown | Ensure Ollama is running at port 11434 |
| Math not rendering | Ensure KaTeX CSS is loaded (check browser console) |
| PDF not displaying | Check browser allows iframes for localhost |
