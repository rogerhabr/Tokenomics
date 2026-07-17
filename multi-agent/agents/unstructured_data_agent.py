"""Agent that queries unstructured text (PDFs, Word, PPT)."""

import os
import anthropic
from data_pipeline.embedder import query_text

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
_MODEL = os.environ.get("AGENT_MODEL", "claude-sonnet-5")

SYSTEM = """You are a document research agent. You receive text passages retrieved from a data centers
document repository (PDFs, Word docs, presentations). Answer the question using only the provided
passages. Quote directly when helpful. Always cite the source document name.
If the passages don't contain the answer, say so clearly."""


def query(question: str) -> str:
    chunks = query_text(question, n=6)
    if not chunks:
        return "No document text found relevant to this question."

    context = "\n\n".join(
        f"[{c['source']}]\n{c['text']}" for c in chunks
    )

    msg = _client.messages.create(
        model=_MODEL,
        max_tokens=1500,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Passages:\n{context}\n\nQuestion: {question}",
            }
        ],
    )
    return msg.content[0].text
