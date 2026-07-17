"""Analytics agent — derives metrics, comparisons, and summaries."""

import os
import anthropic
from data_pipeline.embedder import query_text, query_tables

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
_MODEL = os.environ.get("AGENT_MODEL", "claude-sonnet-5")

SYSTEM = """You are a data center analytics agent. You perform calculations, comparisons, trend analysis,
and summaries over data center documents. You have access to both structured tables and unstructured text.
Show your reasoning step by step. Produce numeric outputs where possible (capacity utilisation,
cost per MW, PUE, etc.). Always cite sources."""


def query(question: str) -> str:
    text_chunks = query_text(question, n=5)
    table_chunks = query_tables(question, n=4)

    all_chunks = text_chunks + table_chunks
    if not all_chunks:
        return "No data found to perform analytics on this question."

    context = "\n\n".join(
        f"[{c['source']} | {'table' if 'table' in c.get('source','') else 'text'}]\n{c['text']}"
        for c in all_chunks
    )

    msg = _client.messages.create(
        model=_MODEL,
        max_tokens=2000,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Source data:\n{context}\n\nAnalytics question: {question}",
            }
        ],
    )
    return msg.content[0].text
