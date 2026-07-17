#!/usr/bin/env python3
"""Interactive CLI — ask questions about your data center documents."""

from dotenv import load_dotenv
load_dotenv()

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt

from agents.supervisor import run
from memory.store import MemoryStore

console = Console()


def main() -> None:
    console.print(Panel.fit(
        "[bold cyan]DataCenter Intelligence[/bold cyan]\n"
        "Powered by Anthropic Claude + your OneDrive files\n"
        "[dim]Type 'quit' to exit | 'feedback: <text>' to give feedback[/dim]",
        border_style="cyan",
    ))

    memory = MemoryStore.load()
    console.print(f"[dim]Memory: {len(memory.historic_questions)} prior turns loaded[/dim]\n")

    while True:
        try:
            question = Prompt.ask("[bold yellow]You[/bold yellow]")
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Goodbye.[/dim]")
            break

        if not question.strip():
            continue

        if question.strip().lower() in ("quit", "exit"):
            console.print("[dim]Goodbye.[/dim]")
            break

        feedback = None
        if question.lower().startswith("feedback:"):
            feedback = question[len("feedback:"):].strip()
            if memory.historic_questions:
                memory.add_turn(
                    memory.historic_questions[-1],
                    [],
                    memory.historic_answers[-1]["answer"] if memory.historic_answers else "",
                    feedback=feedback,
                )
                console.print("[green]Feedback recorded.[/green]")
            continue

        console.print("[dim]Thinking…[/dim]")

        try:
            answer, steps = run(question, memory)
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")
            continue

        # Show reasoning steps in collapsed form
        if steps:
            with console.status(""):
                pass
            console.print(f"[dim]Agent steps ({len(steps)}):[/dim]")
            for step in steps[:6]:
                console.print(f"  [dim]• {step[:120]}[/dim]")

        console.print("\n[bold green]Answer:[/bold green]")
        console.print(Markdown(answer))
        console.print()

        memory.add_turn(question, steps, answer, feedback)


if __name__ == "__main__":
    main()
