"""Chunk text, embed, and upsert into ChromaDB."""

import hashlib
from typing import Iterable

import chromadb
from sentence_transformers import SentenceTransformer

from data_pipeline.processor import ExtractedDocument

_CHUNK_SIZE = 800
_CHUNK_OVERLAP = 100

_model: SentenceTransformer | None = None
_client: chromadb.Client | None = None

TEXT_COLLECTION = "datacenter_docs"
TABLE_COLLECTION = "datacenter_tables"


def _embed_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _chroma() -> chromadb.Client:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=".chroma")
    return _client


def _chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = start + _CHUNK_SIZE
        chunks.append(" ".join(words[start:end]))
        start += _CHUNK_SIZE - _CHUNK_OVERLAP
    return [c for c in chunks if c.strip()]


def _doc_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def ingest(doc: ExtractedDocument) -> tuple[int, int]:
    """Return (chunks_added, tables_added)."""
    model = _embed_model()
    db = _chroma()

    text_col = db.get_or_create_collection(TEXT_COLLECTION)
    table_col = db.get_or_create_collection(TABLE_COLLECTION)

    # Text chunks
    all_chunks, ids, metas = [], [], []
    for chunk in (c for raw in doc.text_chunks for c in _chunk_text(raw)):
        chunk_id = _doc_id(chunk)
        all_chunks.append(chunk)
        ids.append(chunk_id)
        metas.append({"source": doc.name, "type": doc.file_type})

    if all_chunks:
        embeddings = model.encode(all_chunks, show_progress_bar=False).tolist()
        text_col.upsert(ids=ids, embeddings=embeddings, documents=all_chunks, metadatas=metas)

    # Tables (stored as pipe-delimited text)
    t_chunks, t_ids, t_metas = [], [], []
    for i, table in enumerate(doc.tables):
        rendered = "\n".join(" | ".join(row) for row in table)
        t_id = _doc_id(f"{doc.name}:table{i}:{rendered[:200]}")
        t_chunks.append(rendered)
        t_ids.append(t_id)
        t_metas.append({"source": doc.name, "table_index": i, "type": "table"})

    if t_chunks:
        t_embeddings = model.encode(t_chunks, show_progress_bar=False).tolist()
        table_col.upsert(ids=t_ids, embeddings=t_embeddings, documents=t_chunks, metadatas=t_metas)

    return len(all_chunks), len(t_chunks)


def query_text(question: str, n: int = 6) -> list[dict]:
    model = _embed_model()
    db = _chroma()
    col = db.get_or_create_collection(TEXT_COLLECTION)
    embedding = model.encode([question], show_progress_bar=False).tolist()
    results = col.query(query_embeddings=embedding, n_results=n)
    return [
        {"text": doc, "source": meta["source"], "score": dist}
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]


def query_tables(question: str, n: int = 4) -> list[dict]:
    model = _embed_model()
    db = _chroma()
    col = db.get_or_create_collection(TABLE_COLLECTION)
    embedding = model.encode([question], show_progress_bar=False).tolist()
    results = col.query(query_embeddings=embedding, n_results=n)
    return [
        {"text": doc, "source": meta["source"], "score": dist}
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]
