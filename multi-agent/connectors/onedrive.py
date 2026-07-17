"""OneDrive connector via Microsoft Graph API (delegated/app auth)."""

import os
import io
from pathlib import Path
from typing import Generator

import msal
import httpx


GRAPH_BASE = "https://graph.microsoft.com/v1.0"
SCOPES = ["https://graph.microsoft.com/.default"]


class OneDriveConnector:
    def __init__(self):
        self.client_id = os.environ["AZURE_CLIENT_ID"]
        self.client_secret = os.environ["AZURE_CLIENT_SECRET"]
        self.tenant_id = os.environ["AZURE_TENANT_ID"]
        self.user_email = os.environ.get("ONEDRIVE_USER_EMAIL", "")
        self.folder_name = os.environ.get("ONEDRIVE_FOLDER_NAME", "data centers")
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=f"https://login.microsoftonline.com/{self.tenant_id}",
            client_credential=self.client_secret,
        )
        result = app.acquire_token_for_client(scopes=SCOPES)
        if "access_token" not in result:
            raise RuntimeError(f"MSAL auth failed: {result.get('error_description')}")
        self._token = result["access_token"]
        return self._token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_token()}"}

    def _get_folder_id(self) -> str:
        """Resolve the 'data centers' folder id for the target user."""
        url = (
            f"{GRAPH_BASE}/users/{self.user_email}"
            f"/drive/root:/{self.folder_name}"
        )
        resp = httpx.get(url, headers=self._headers(), timeout=30)
        resp.raise_for_status()
        return resp.json()["id"]

    def list_files(self) -> list[dict]:
        """List all files in the data centers folder (recursive)."""
        folder_id = self._get_folder_id()
        url = (
            f"{GRAPH_BASE}/users/{self.user_email}"
            f"/drive/items/{folder_id}/children"
            f"?$select=id,name,size,file,lastModifiedDateTime"
            f"&$top=200"
        )
        files: list[dict] = []
        while url:
            resp = httpx.get(url, headers=self._headers(), timeout=30)
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("value", []):
                if "file" in item:  # skip sub-folders at top level
                    files.append(item)
            url = data.get("@odata.nextLink")
        return files

    def download_file(self, item_id: str) -> bytes:
        url = (
            f"{GRAPH_BASE}/users/{self.user_email}"
            f"/drive/items/{item_id}/content"
        )
        resp = httpx.get(url, headers=self._headers(), timeout=120, follow_redirects=True)
        resp.raise_for_status()
        return resp.content

    def iter_files(self) -> Generator[tuple[dict, bytes], None, None]:
        """Yield (metadata, raw_bytes) for each file."""
        for item in self.list_files():
            content = self.download_file(item["id"])
            yield item, content
