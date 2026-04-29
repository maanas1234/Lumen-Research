"""
Text chunking strategies for RAG pipeline.
"""
from typing import List, Dict, Any
import re


def chunk_text(
    full_text: str,
    page_texts: List[Dict[str, Any]],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[Dict[str, Any]]:
    """
    Split document text into overlapping chunks with page attribution.
    Returns list of {text, page, chunk_index}.
    """
    chunks: List[Dict[str, Any]] = []

    # Build a flat list of (page_num, sentence/paragraph) pairs
    segments: List[tuple] = []
    for page_info in page_texts:
        page_num = page_info["page"]
        # Split by double newline (paragraphs) then by sentence boundaries
        paragraphs = re.split(r"\n{2,}", page_info["text"])
        for para in paragraphs:
            para = para.strip()
            if len(para) > 20:
                segments.append((page_num, para))

    # Sliding window chunking over segments
    current_text = ""
    current_page = 1
    chunk_index = 0

    for page_num, seg in segments:
        if len(current_text) + len(seg) <= chunk_size:
            current_text += (" " if current_text else "") + seg
            current_page = page_num
        else:
            if current_text:
                chunks.append({
                    "text": current_text.strip(),
                    "page": current_page,
                    "chunk_index": chunk_index,
                })
                chunk_index += 1
                # Overlap: keep last `chunk_overlap` chars
                overlap_text = current_text[-chunk_overlap:] if len(current_text) > chunk_overlap else current_text
                current_text = overlap_text + " " + seg
                current_page = page_num
            else:
                current_text = seg
                current_page = page_num

    # Flush last chunk
    if current_text.strip():
        chunks.append({
            "text": current_text.strip(),
            "page": current_page,
            "chunk_index": chunk_index,
        })

    return chunks
