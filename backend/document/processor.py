"""
Document processor: PDF text and metadata extraction using PyMuPDF.
"""
import fitz  # PyMuPDF
from pathlib import Path
from typing import List, Dict, Any


def extract_text_and_metadata(pdf_path: str) -> Dict[str, Any]:
    """
    Extract full text, page text, and metadata from a PDF.
    Returns a dict with: title, author, pages, full_text, page_texts, math_regions.
    """
    doc = fitz.open(pdf_path)
    metadata = doc.metadata or {}

    page_texts: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []
    math_regions: List[Dict[str, Any]] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        blocks = page.get_text("blocks")  # list of (x0,y0,x1,y1,text,block_no,block_type)

        page_texts.append({
            "page": page_num + 1,
            "text": text,
            "char_count": len(text),
        })
        full_text_parts.append(f"[Page {page_num + 1}]\n{text}")

        # Detect likely math regions (lines with many special chars)
        for block in blocks:
            block_text = block[4]
            if _is_likely_math(block_text):
                math_regions.append({
                    "page": page_num + 1,
                    "text": block_text.strip(),
                    "bbox": block[:4],
                })

    doc.close()

    return {
        "title": metadata.get("title", Path(pdf_path).stem),
        "author": metadata.get("author", "Unknown"),
        "total_pages": len(page_texts),
        "full_text": "\n\n".join(full_text_parts),
        "page_texts": page_texts,
        "math_regions": math_regions,
    }


def _is_likely_math(text: str) -> bool:
    """Heuristic: text block is likely math if it has many special math characters."""
    if not text or len(text.strip()) < 3:
        return False
    math_chars = set("∑∏∫∂∇αβγδεζηθλμνξπρστφχψωΩ∞≈≤≥≠±×÷√∈∉⊂⊃∪∩")
    special_ascii = set("=+-*/^{}[]|_")
    text_chars = set(text)
    math_hits = len(text_chars & math_chars)
    ascii_hits = len(text_chars & special_ascii)
    return math_hits >= 1 or ascii_hits >= 3
