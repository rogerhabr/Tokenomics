#!/usr/bin/env python3
"""Pull files from OneDrive 'data centers' folder, extract, and index them."""

import sys
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import track

load_dotenv()

from connectors.onedrive import OneDriveConnector
from data_pipeline.processor import extract
from data_pipeline.embedder import ingest

console = Console()


def main() -> None:
    console.print("[bold cyan]DataCenter Intelligence — Ingestion[/bold cyan]\n")

    connector = OneDriveConnector()

    console.print(f"Connecting to OneDrive for [bold]{connector.user_email}[/bold]...")
    files = connector.list_files()
    console.print(f"Found [bold]{len(files)}[/bold] files in '{connector.folder_name}'\n")

    if not files:
        console.print("[yellow]No files found. Check ONEDRIVE_FOLDER_NAME in .env[/yellow]")
        sys.exit(1)

    total_chunks = 0
    total_tables = 0

    for item in track(files, description="Processing files…"):
        name = item["name"]
        try:
            raw = connector.download_file(item["id"])
            doc = extract(name, raw)
            chunks, tables = ingest(doc)
            total_chunks += chunks
            total_tables += tables
            console.print(f"  ✓ [green]{name}[/green] → {chunks} chunks, {tables} tables")
        except Exception as e:
            console.print(f"  ✗ [red]{name}[/red]: {e}")

    console.print(
        f"\n[bold green]Done.[/bold green] "
        f"{total_chunks} text chunks + {total_tables} tables indexed."
    )


if __name__ == "__main__":
    main()
