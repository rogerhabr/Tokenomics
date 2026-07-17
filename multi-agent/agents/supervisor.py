"""Supervisor agent — routes, orchestrates sub-agents, reflects, and synthesises."""

import os
import json
import anthropic
from memory.store import MemoryStore

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
_MODEL = os.environ.get("SUPERVISOR_MODEL", "claude-opus-4-8")

TOOLS = [
    {
        "name": "query_structured_data",
        "description": (
            "Query structured/tabular data (Excel, CSV) from data center files. "
            "Use for: capacity numbers, costs, PUE values, equipment lists, specs in table form."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "Precise question about the tabular data."}
            },
            "required": ["question"],
        },
    },
    {
        "name": "query_unstructured_data",
        "description": (
            "Query text from PDFs, Word docs, and presentations in the data centers folder. "
            "Use for: descriptions, policies, technical specs written in prose, meeting notes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "Precise question to answer from documents."}
            },
            "required": ["question"],
        },
    },
    {
        "name": "run_analytics",
        "description": (
            "Derive metrics, comparisons, and summaries combining both structured and unstructured data. "
            "Use for: trend analysis, cost-per-unit calculations, capacity utilisation, PUE benchmarking."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "Analytics question to answer."}
            },
            "required": ["question"],
        },
    },
]

SYSTEM = """You are a Supervisor Agent for a data center intelligence system. The user asks questions
about data center documents stored in OneDrive. You have three specialist sub-agents:

1. query_structured_data — tables, numbers, specs (Excel, CSV)
2. query_unstructured_data — text (PDF, Word, PPT)
3. run_analytics — cross-data metrics and analysis

Strategy:
- Route each sub-question to the most appropriate agent
- You may call multiple agents in sequence if the question spans data types
- After receiving all agent responses, REFLECT: are the answers consistent? Are there gaps?
- Synthesise a final, coherent answer. Be concise but complete.
- If agents returned insufficient data, say so honestly."""


def _dispatch_tool(name: str, inputs: dict) -> str:
    from agents.structured_data_agent import query as sq
    from agents.unstructured_data_agent import query as uq
    from agents.analytics_agent import query as aq

    if name == "query_structured_data":
        return sq(inputs["question"])
    if name == "query_unstructured_data":
        return uq(inputs["question"])
    if name == "run_analytics":
        return aq(inputs["question"])
    return f"Unknown tool: {name}"


def run(question: str, memory: MemoryStore) -> tuple[str, list[str]]:
    """Run supervisor loop. Returns (final_answer, steps)."""
    steps: list[str] = []

    recent_ctx = memory.recent_context(n=3)
    feedback_ctx = memory.feedback_summary()

    system_with_memory = (
        SYSTEM
        + (f"\n\nRecent conversation:\n{recent_ctx}" if recent_ctx else "")
        + (f"\n\nUser feedback history:\n{feedback_ctx}" if feedback_ctx != "No feedback yet." else "")
    )

    messages = [{"role": "user", "content": question}]

    while True:
        response = _client.messages.create(
            model=_MODEL,
            max_tokens=4096,
            system=system_with_memory,
            tools=TOOLS,
            messages=messages,
        )

        # Collect any text reasoning before tool calls
        for block in response.content:
            if block.type == "text" and block.text.strip():
                steps.append(f"[supervisor] {block.text.strip()[:300]}")

        if response.stop_reason == "end_turn":
            final = next(
                (b.text for b in response.content if b.type == "text"),
                "No answer generated.",
            )
            return final, steps

        if response.stop_reason != "tool_use":
            return "Unexpected stop reason: " + response.stop_reason, steps

        # Execute all tool calls
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            steps.append(f"[{block.name}] {json.dumps(block.input)[:200]}")
            result = _dispatch_tool(block.name, block.input)
            steps.append(f"[{block.name} result] {result[:300]}…")
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })
        messages.append({"role": "user", "content": tool_results})
