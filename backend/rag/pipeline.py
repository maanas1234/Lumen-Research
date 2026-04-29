"""
RAG pipeline — uses Ollama /api/chat (role-based, faster prefill) instead of /api/generate.
"""
import httpx
import json
from typing import AsyncIterator, List, Dict, Any

from rag.prompts import build_rag_prompt, build_explain_prompt, build_summary_prompt, build_thread_prompt
from storage.vector_store import VectorStoreManager
from embeddings.ollama_embeddings import OllamaEmbeddings


class RAGPipeline:
    def __init__(
        self,
        ollama_base_url: str,
        ollama_model: str,
        embed_model: str,
        vector_store: VectorStoreManager,
        top_k: int = 3,
    ):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.model = ollama_model
        self.embedder = OllamaEmbeddings(ollama_base_url, embed_model)
        self.vector_store = vector_store
        self.top_k = top_k

    async def retrieve_context(
        self, paper_id: str, query: str
    ) -> tuple[str, List[Dict[str, Any]]]:
        """Embed query, retrieve top-k chunks, return formatted context + sources."""
        query_emb = await self.embedder.embed(query)
        chunks = self.vector_store.search(paper_id, query_emb, top_k=self.top_k)

        if not chunks:
            return "No relevant context found in the paper.", []

        context_parts = []
        for i, chunk in enumerate(chunks):
            snippet = chunk["text"][:400].rstrip()
            context_parts.append(f"[P{chunk.get('page', '?')}] {snippet}")

        return "\n---\n".join(context_parts), chunks

    # ── Public streaming methods ───────────────────────────────────────────────

    async def stream_chat(
        self,
        paper_id: str,
        question: str,
        history: List[Dict[str, str]],
        mode: str = "research",
    ) -> AsyncIterator[str]:
        context, sources = await self.retrieve_context(paper_id, question)
        system_prompt, user_message = build_rag_prompt(context, question, mode)

        # Build message list: system + trimmed history + current question
        messages = [{"role": "system", "content": system_prompt}]
        for m in history[-6:]:   # last 6 messages (3 turns)
            messages.append({"role": m["role"], "content": m["content"][:300]})
        messages.append({"role": "user", "content": user_message})

        yield json.dumps({
            "type": "sources",
            "sources": [
                {"page": c.get("page", "?"), "text": c["text"][:200], "score": c.get("score", 0)}
                for c in sources
            ],
        }) + "\n"

        async for token in self._stream_chat_api(messages):
            yield json.dumps({"type": "token", "content": token}) + "\n"

        yield json.dumps({"type": "done"}) + "\n"

    async def stream_explain(
        self, action: str, selected_text: str
    ) -> AsyncIterator[str]:
        system_prompt, user_message = build_explain_prompt(action, selected_text)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ]
        async for token in self._stream_chat_api(messages):
            yield json.dumps({"type": "token", "content": token}) + "\n"
        yield json.dumps({"type": "done"}) + "\n"

    async def stream_summary(self, full_text: str) -> AsyncIterator[str]:
        system_prompt, user_message = build_summary_prompt(full_text)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ]
        async for token in self._stream_chat_api(messages):
            yield json.dumps({"type": "token", "content": token}) + "\n"
        yield json.dumps({"type": "done"}) + "\n"

    async def stream_thread(
        self,
        paper_id: str,
        topic: str,
        question: str,
        history: List[Dict[str, str]],
        mode: str = "research",
    ) -> AsyncIterator[str]:
        context, sources = await self.retrieve_context(paper_id, question)
        system_prompt, user_message = build_thread_prompt(topic, context, question, mode)

        messages = [{"role": "system", "content": system_prompt}]
        for m in history[-6:]:
            messages.append({"role": m["role"], "content": m["content"][:300]})
        messages.append({"role": "user", "content": user_message})

        yield json.dumps({
            "type": "sources",
            "sources": [
                {"page": c.get("page", "?"), "text": c["text"][:200], "score": c.get("score", 0)}
                for c in sources
            ],
        }) + "\n"

        async for token in self._stream_chat_api(messages):
            yield json.dumps({"type": "token", "content": token}) + "\n"

        yield json.dumps({"type": "done"}) + "\n"



    # ── Low-level: /api/chat (role-based, faster than /api/generate) ───────────

    async def _stream_chat_api(self, messages: List[Dict[str, str]]) -> AsyncIterator[str]:
        """
        Stream tokens via Ollama /api/chat.
        Role-based messages allow the model to use its native chat template,
        which gives faster time-to-first-token and better instruction following.
        No num_predict cap — let the model finish naturally.
        """
        # Inject /no_think for Qwen3 models to skip the Chain-of-Thought
        # reasoning phase. Without this, Qwen3 spends 15-20s generating
        # a hidden <think> block before producing the actual answer.
        optimized_messages = []
        for msg in messages:
            if msg["role"] == "system":
                optimized_messages.append({"role": "system", "content": "/no_think\n" + msg["content"]})
            else:
                optimized_messages.append(msg)

        payload = {
            "model": self.model,
            "messages": optimized_messages,
            "stream": True,
            "keep_alive": -1,   # keep model in RAM — no re-loading between requests
            "options": {
                "temperature": 0.3,
                "num_ctx": 4096,
                "num_thread": 6,
            },
        }
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                "POST",
                f"{self.ollama_base_url}/api/chat",
                json=payload,
            ) as response:
                response.raise_for_status()
                in_think_block = False
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            # /api/chat response shape: {"message": {"content": "..."}}
                            token = data.get("message", {}).get("content", "")
                            if token:
                                # Filter out Qwen3 <think>...</think> blocks
                                # These appear when thinking mode leaks through
                                if "<think>" in token:
                                    in_think_block = True
                                if "</think>" in token:
                                    in_think_block = False
                                    # yield the part after </think>
                                    after = token.split("</think>", 1)[-1]
                                    if after.strip():
                                        yield after
                                elif not in_think_block:
                                    yield token
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
