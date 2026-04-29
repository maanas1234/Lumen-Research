"""
FAISS vector store manager with persistence.
"""
import os
import json
import numpy as np
import faiss
from typing import List, Dict, Any, Optional
from pathlib import Path


class VectorStoreManager:
    """
    Manages FAISS index creation, persistence, and similarity search.
    Each paper gets its own index stored in VECTOR_STORE_DIR/{paper_id}/.
    """

    def __init__(self, store_dir: str):
        self.store_dir = Path(store_dir)
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self._indexes: Dict[str, faiss.Index] = {}
        self._metadata: Dict[str, List[Dict[str, Any]]] = {}

    def _paper_dir(self, paper_id: str) -> Path:
        d = self.store_dir / paper_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def index_exists(self, paper_id: str) -> bool:
        d = self._paper_dir(paper_id)
        return (d / "index.faiss").exists() and (d / "metadata.json").exists()

    def create_index(
        self,
        paper_id: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> None:
        """Build and persist FAISS index from chunks + embeddings."""
        if not embeddings:
            raise ValueError("No embeddings provided")

        dim = len(embeddings[0])
        vectors = np.array(embeddings, dtype=np.float32)
        # Normalize for cosine similarity
        faiss.normalize_L2(vectors)

        index = faiss.IndexFlatIP(dim)  # Inner product = cosine after L2 norm
        index.add(vectors)

        paper_dir = self._paper_dir(paper_id)
        faiss.write_index(index, str(paper_dir / "index.faiss"))

        # Store chunk metadata alongside
        with open(paper_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(chunks, f, ensure_ascii=False, indent=2)

        self._indexes[paper_id] = index
        self._metadata[paper_id] = chunks

    def _load_index(self, paper_id: str) -> None:
        """Load index from disk into memory."""
        paper_dir = self._paper_dir(paper_id)
        index = faiss.read_index(str(paper_dir / "index.faiss"))
        with open(paper_dir / "metadata.json", "r", encoding="utf-8") as f:
            metadata = json.load(f)
        self._indexes[paper_id] = index
        self._metadata[paper_id] = metadata

    def search(
        self,
        paper_id: str,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Return top-k most relevant chunks for query embedding."""
        if paper_id not in self._indexes:
            if self.index_exists(paper_id):
                self._load_index(paper_id)
            else:
                return []

        index = self._indexes[paper_id]
        metadata = self._metadata[paper_id]

        query = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(query)

        scores, indices = index.search(query, min(top_k, index.ntotal))

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(metadata):
                chunk = metadata[idx].copy()
                chunk["score"] = float(score)
                results.append(chunk)

        return results

    def delete_index(self, paper_id: str) -> None:
        """Remove a paper's vector store."""
        paper_dir = self._paper_dir(paper_id)
        for f in paper_dir.iterdir():
            f.unlink()
        paper_dir.rmdir()
        self._indexes.pop(paper_id, None)
        self._metadata.pop(paper_id, None)
