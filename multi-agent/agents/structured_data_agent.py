"""Agent that queries structured data (tables from Excel/CSV)."""

import os
import anthropic
from data_pipeline.embedder import query_tables

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
_MODEL = os.environ.get("AGENT_MODEL", "claude-sonnet-5")

SYSTEM = """You are a structured data analyst agent. You receive tabular data (from Excel/CSV files)
extracted from a data centers document repository. Your job is to answer the question precisely
using only the data provided. Cite the source file and column names.
If the data is insufficient, say so — do not guess."""


def query(question: str) -> str:
    chunks = query_tables(question, n=5)
    if not chunks:
        return "No structured/tabular data found relevant to this question."

    context = "\n\n".join(
        f"[{c['source']}]\n{c['text']}" for c in chunks
    )

    msg = _client.messages.create(
        model=_MODEL,
        max_tokens=1024,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Data:\n{context}\n\nQuestion: {question}",
            }
        ],
    )
    return msg.content[0].text
