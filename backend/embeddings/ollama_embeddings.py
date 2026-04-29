"""
Ollama embeddings client.
Calls the /api/embeddings endpoint to get text embeddings.
"""
import httpx
from typing import List
import os


class OllamaEmbeddings:
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def embed(self, text: str) -> List[float]:
        """Get embedding for a single text string."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                # keep_alive=-1 keeps the model loaded in RAM indefinitely
                # so it never gets swapped out when qwen3 takes over
                json={"model": self.model, "prompt": text, "keep_alive": -1},
            )
            response.raise_for_status()
            data = response.json()
            return data["embedding"]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for a list of texts."""
        results = []
        for text in texts:
            emb = await self.embed(text)
            results.append(emb)
        return results
