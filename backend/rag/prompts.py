"""
Lean prompts returning (system_prompt, user_message) tuples
for use with Ollama /api/chat role-based messages.
"""
from typing import Tuple

# ── Mode hints (one short line) ───────────────────────────────────────────────
MODE_HINT = {
    "eli5":     "Use simple language and real-world analogies. No jargon.",
    "exam":     "Be structured. Show step-by-step derivations with LaTeX.",
    "research": "Be technically precise. Use LaTeX for all math.",
}

# ── System prompts (short, focused) ───────────────────────────────────────────
RAG_SYSTEM = (
    "You are a research paper assistant. Answer only from the provided context. "
    "Use LaTeX for math (inline $...$, block $$...$$). Cite page numbers as [Px]."
)

EXPLAIN_SYSTEM = "You are an expert math and AI tutor. Use LaTeX for all math expressions."

THREAD_SYSTEM = "You are a focused assistant doing a deep dive on one concept. Use LaTeX for math."

SUMMARY_SYSTEM = (
    "You are a research paper analyst. Produce structured Markdown summaries. "
    "Use LaTeX for equations."
)


# ── Builder functions — all return (system: str, user: str) ───────────────────

def build_rag_prompt(context: str, question: str, mode: str = "research") -> Tuple[str, str]:
    system = f"{RAG_SYSTEM}\n{MODE_HINT.get(mode, MODE_HINT['research'])}"
    user = f"CONTEXT:\n{context}\n\nQUESTION: {question}"
    return system, user


def build_explain_prompt(action: str, text: str) -> Tuple[str, str]:
    instructions = {
        "explain_simple": "Explain this simply with a relatable analogy. No jargon. Bullet points welcome.",
        "explain_math":   "Explain this mathematically. Define every symbol with LaTeX.",
        "derive_steps":   "Derive this step-by-step. Show EVERY intermediate step. Number each step. Use LaTeX.",
        "give_intuition": "Explain the intuition: why does this make sense? What problem does it solve?",
        "give_analogy":   "Give a vivid real-world analogy that maps every component of this concept.",
    }
    instruction = instructions.get(action, instructions["explain_simple"])
    system = f"{EXPLAIN_SYSTEM}\nTask: {instruction}"
    user = text[:600]  # cap selected text
    return system, user


def build_summary_prompt(text: str) -> Tuple[str, str]:
    system = SUMMARY_SYSTEM
    user = (
        "Summarize this paper. Sections:\n"
        "1. **TL;DR** (2-3 sentences)\n"
        "2. **Key Contributions** (bullets)\n"
        "3. **Core Method** (1 paragraph)\n"
        "4. **Key Equations** (LaTeX)\n"
        "5. **Key Concepts** (term: one-line definition)\n"
        "6. **5 Questions to Explore**\n\n"
        f"PAPER:\n{text[:5000]}"
    )
    return system, user


def build_thread_prompt(topic: str, context: str, question: str, mode: str = "research") -> Tuple[str, str]:
    system = (
        f"{THREAD_SYSTEM}\n"
        f"Concept: {topic}\n"
        f"{MODE_HINT.get(mode, MODE_HINT['research'])}"
    )
    user = f"CONTEXT FROM PAPER:\n{context}\n\nQUESTION: {question}"
    return system, user

