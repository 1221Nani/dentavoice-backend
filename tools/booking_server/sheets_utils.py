import logging
from datetime import datetime, timezone
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from config import get_google_credentials, BOOKINGS_SHEET_ID

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
HEADER = [
    "Timestamp (UTC)", "Confirmation ID", "Patient Name", "Patient Phone",
    "Date", "Time", "Doctor", "Reason", "Status", "Reminder Sent",
]
# Column indices (0-based)
COL_CONFIRMATION = 1
COL_PATIENT_NAME = 2
COL_PATIENT_PHONE = 3
COL_DATE = 4
COL_TIME = 5
COL_DOCTOR = 6
COL_REASON = 7
COL_STATUS = 8
COL_REMINDER_SENT = 9  # column J


def _service():
    creds = Credentials.from_service_account_info(get_google_credentials(), scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def ensure_header():
    try:
        svc = _service()
        result = svc.spreadsheets().values().get(
            spreadsheetId=BOOKINGS_SHEET_ID, range="A1:J1"
        ).execute()
        if not result.get("values"):
            svc.spreadsheets().values().update(
                spreadsheetId=BOOKINGS_SHEET_ID,
                range="A1:J1",
                valueInputOption="USER_ENTERED",
                body={"values": [HEADER]},
            ).execute()
            log.info("Sheets header written")
    except Exception as e:
        log.error(f"ensure_header failed: {e}")


def log_booking(data: dict):
    row = [
        datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        data.get("confirmation_id", ""),
        data.get("patient_name", ""),
        data.get("patient_phone", ""),
        data.get("date_iso", data.get("date", "")),
        data.get("time", ""),
        data.get("doctor", ""),
        data.get("reason", ""),
        "Confirmed",
        "",  # Reminder Sent — blank until sent
    ]
    _service().spreadsheets().values().append(
        spreadsheetId=BOOKINGS_SHEET_ID,
        range="A:J",
        valueInputOption="USER_ENTERED",
        body={"values": [row]},
    ).execute()
    log.info(f"Booking logged to Sheets: {data.get('confirmation_id')}")


def get_unreminded_appointments() -> list[dict]:
    """Return confirmed appointments that haven't had a reminder sent yet."""
    try:
        svc = _service()
        result = svc.spreadsheets().values().get(
            spreadsheetId=BOOKINGS_SHEET_ID, range="A:J"
        ).execute()
        rows = result.get("values", [])
        if len(rows) < 2:
            return []

        appointments = []
        for i, row in enumerate(rows[1:], start=2):  # row index for Sheets API (1-based, skip header)
            # Pad short rows
            while len(row) < 10:
                row.append("")

            if row[COL_STATUS] != "Confirmed":
                continue
            if row[COL_REMINDER_SENT]:
                continue

            appointments.append({
                "sheet_row": i,
                "confirmation_id": row[COL_CONFIRMATION],
                "patient_name": row[COL_PATIENT_NAME],
                "patient_phone": row[COL_PATIENT_PHONE],
                "date": row[COL_DATE],
                "time": row[COL_TIME],
                "doctor": row[COL_DOCTOR],
                "reason": row[COL_REASON],
            })
        return appointments
    except Exception as e:
        log.error(f"get_unreminded_appointments failed: {e}")
        return []


def mark_reminder_sent(sheet_row: int):
    """Write the reminder timestamp into column J for the given row."""
    try:
        svc = _service()
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        svc.spreadsheets().values().update(
            spreadsheetId=BOOKINGS_SHEET_ID,
            range=f"J{sheet_row}",
            valueInputOption="USER_ENTERED",
            body={"values": [[timestamp]]},
        ).execute()
        log.info(f"Reminder marked sent for row {sheet_row}")
    except Exception as e:
        log.error(f"mark_reminder_sent failed for row {sheet_row}: {e}")
