from datetime import datetime, timezone
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from config import get_google_credentials, BOOKINGS_SHEET_ID

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
HEADER = [
    "Timestamp (UTC)", "Confirmation ID", "Patient Name", "Patient Phone",
    "Date", "Time", "Doctor", "Reason", "Status",
]


def _service():
    creds = Credentials.from_service_account_info(get_google_credentials(), scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def ensure_header():
    svc = _service()
    result = svc.spreadsheets().values().get(
        spreadsheetId=BOOKINGS_SHEET_ID, range="Sheet1!A1:I1"
    ).execute()
    if not result.get("values"):
        svc.spreadsheets().values().update(
            spreadsheetId=BOOKINGS_SHEET_ID,
            range="Sheet1!A1:I1",
            valueInputOption="USER_ENTERED",
            body={"values": [HEADER]},
        ).execute()


def log_booking(data: dict):
    row = [
        datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        data.get("confirmation_id", ""),
        data.get("patient_name", ""),
        data.get("patient_phone", ""),
        data.get("date", ""),
        data.get("time", ""),
        data.get("doctor", ""),
        data.get("reason", ""),
        "Confirmed",
    ]
    _service().spreadsheets().values().append(
        spreadsheetId=BOOKINGS_SHEET_ID,
        range="Sheet1!A:I",
        valueInputOption="USER_ENTERED",
        body={"values": [row]},
    ).execute()
