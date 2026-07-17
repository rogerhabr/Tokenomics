"""Persistent memory: human feedback, historic steps/questions/answers."""

import json
import time
from pathlib import Path
from dataclasses import dataclass, field, asdict

_MEMORY_FILE = Path(".memory.json")


@dataclass
class MemoryStore:
    human_feedbacks: list[dict] = field(default_factory=list)
    historic_steps: list[dict] = field(default_factory=list)
    historic_questions: list[str] = field(default_factory=list)
    historic_answers: list[dict] = field(default_factory=list)

    @classmethod
    def load(cls) -> "MemoryStore":
        if _MEMORY_FILE.exists():
            data = json.loads(_MEMORY_FILE.read_text())
            return cls(**data)
        return cls()

    def save(self) -> None:
        _MEMORY_FILE.write_text(json.dumps(asdict(self), indent=2))

    def add_turn(self, question: str, steps: list[str], answer: str, feedback: str | None = None) -> None:
        ts = time.time()
        self.historic_questions.append(question)
        self.historic_steps.append({"question": question, "steps": steps, "ts": ts})
        self.historic_answers.append({"question": question, "answer": answer, "ts": ts})
        if feedback:
            self.human_feedbacks.append({"question": question, "feedback": feedback, "ts": ts})
        self.save()

    def recent_context(self, n: int = 5) -> str:
        pairs = list(zip(self.historic_questions[-n:], self.historic_answers[-n:]))
        lines = []
        for q, a in pairs:
            lines.append(f"Q: {q}\nA: {a['answer']}")
        return "\n---\n".join(lines)

    def feedback_summary(self) -> str:
        if not self.human_feedbacks:
            return "No feedback yet."
        return "\n".join(f"- {f['feedback']}" for f in self.human_feedbacks[-10:])
