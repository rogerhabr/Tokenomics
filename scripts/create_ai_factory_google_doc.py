import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
]


def authenticate_google():
    """Handles OAuth2 authentication and returns API service objects."""
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open("token.json", "w") as token:
            token.write(creds.to_json())

    docs_service = build("docs", "v1", credentials=creds)
    return docs_service


def create_ai_factory_google_doc():
    docs_service = authenticate_google()

    # Step 1: Create an empty Google Doc
    doc_title = (
        "NVIDIA Vera Rubin NVL72 AI Factory — Abu Dhabi Infrastructure"
        " Blueprint"
    )
    doc = (
        docs_service.documents()
        .create(body={"title": doc_title})
        .execute()
    )
    document_id = doc.get("documentId")
    print(f"Created Document ID: {document_id}")
    print(
        "Document URL:"
        f" https://docs.google.com/document/d/{document_id}/edit"
    )

    # Step 2: Build the document text and structure
    body_text = (
        "NVIDIA Vera Rubin NVL72 AI Factory — Abu Dhabi\n"
        "Master Operational, Environmental & Financial Baseline Document\n\n"
        "1. Operational & Technical Baseline\n"
        "• Location: Abu Dhabi, UAE (ASHRAE Climate Zone 1A)\n"
        "• Extreme Conditions: 50.0°C Dry-Bulb / 30.0°C Coincident Wet-Bulb\n"
        "• Infrastructure Scope: 32x NVL72 Racks (227 kW/rack) + 1.0 MW"
        " Air-Cooled Load (7,264 kW IT Peak)\n"
        "• Thermal Architecture: S45 Direct-to-Chip Liquid Loop (45°C FWS /"
        " 55°C FWR)\n"
        "• Target PUE / MLC: 1.08 Annualized PUE | 0.078 Peak MLC (vs. ASHRAE"
        " 90.4 Limit of 0.260)\n\n"
        "2. Financial & Fiscal Structure\n"
        "• Initial CapEx: $139.5M turnkey deployment\n"
        "• Capital Structure: 80% Senior Debt Facility ($111.6M) at 6.5%"
        " interest (5-year tenor) | 20% Equity ($27.9M)\n"
        "• Power Tariff: $0.06/kWh (Abu Dhabi Industrial Baseline)\n"
        "• Tax Environment: 9% Statutory UAE Corporate Tax with GIDLR interest"
        " deduction limits applied (30% EBITDA cap)\n"
        "• Annual Revenue Model: $84.0M Total (70% Capacity Leases / 30%"
        " Dynamic API Token Market)\n\n"
        "3. 5-Year Financial Summary\n"
    )

    requests = [{"insertText": {"location": {"index": 1}, "text": body_text}}]

    # Execute text insertion first
    docs_service.documents().batchUpdate(
        documentId=document_id, body={"requests": requests}
    ).execute()

    # Step 3: Insert the Financial Summary Table at the end of the document
    doc_state = (
        docs_service.documents().get(documentId=document_id).execute()
    )
    end_index = doc_state.get("body").get("content")[-1].get("endIndex") - 1

    table_requests = [
        {"insertTable": {"rows": 7, "columns": 7, "location": {"index": end_index}}}
    ]

    docs_service.documents().batchUpdate(
        documentId=document_id, body={"requests": table_requests}
    ).execute()

    # Step 4: Populate the Table Data
    table_data = [
        [
            "Metric",
            "Year 0",
            "Year 1",
            "Year 2",
            "Year 3",
            "Year 4",
            "Year 5",
        ],
        [
            "Gross Revenue",
            "—",
            "$84,000,000",
            "$84,000,000",
            "$84,000,000",
            "$84,000,000",
            "$84,000,000",
        ],
        [
            "Total OpEx",
            "—",
            "$14,950,200",
            "$14,950,200",
            "$14,950,200",
            "$14,950,200",
            "$14,950,200",
        ],
        [
            "EBITDA",
            "—",
            "$69,049,800",
            "$69,049,800",
            "$69,049,800",
            "$69,049,800",
            "$69,049,800",
        ],
        [
            "Debt Service (P+I)",
            "—",
            "$26,854,202",
            "$26,854,202",
            "$26,854,202",
            "$26,854,202",
            "$26,854,202",
        ],
        [
            "Leveraged FCFE",
            "-$27,900,000",
            "$38,446,014",
            "$38,707,026",
            "$38,985,029",
            "$39,281,042",
            "$39,596,791",
        ],
        ["DSCR", "—", "2.57x", "2.57x", "2.57x", "2.57x", "2.57x"],
    ]

    # Fetch updated doc state to locate table cell start indices
    doc_state = (
        docs_service.documents().get(documentId=document_id).execute()
    )
    table_element = None
    for content in doc_state.get("body").get("content"):
        if "table" in content:
            table_element = content.get("table")
            break

    if table_element:
        cell_requests = []
        # Populate in reverse order to keep index offsets accurate
        for row_idx in range(len(table_data) - 1, -1, -1):
            for col_idx in range(len(table_data[row_idx]) - 1, -1, -1):
                cell_value = table_data[row_idx][col_idx]
                cell = table_element["tableRows"][row_idx]["tableCells"][
                    col_idx
                ]
                start_idx = cell["startIndex"] + 1
                cell_requests.append(
                    {
                        "insertText": {
                            "location": {"index": start_idx},
                            "text": cell_value,
                        }
                    }
                )

        docs_service.documents().batchUpdate(
            documentId=document_id, body={"requests": cell_requests}
        ).execute()

    print("Google Doc successfully created and populated!")


if __name__ == "__main__":
    create_ai_factory_google_doc()
