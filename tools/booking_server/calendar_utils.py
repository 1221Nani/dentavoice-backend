from datetime import datetime, timedelta, time as dtime
import pytz
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from config import get_google_credentials, CLINIC_CALENDAR_ID, CLINIC_TIMEZONE, CLINIC_CONFIG

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _service():
    creds = Credentials.from_service_account_info(get_google_credentials(), scopes=SCOPES)
    return build("calendar", "v3", credentials=creds)


def get_available_slots(date_str: str, doctor_preference: str = None) -> list:
    tz = pytz.timezone(CLINIC_TIMEZONE)

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return []

    day_name = target_date.strftime("%A").lower()
    hours = CLINIC_CONFIG["business_hours"].get(day_name)
    if not hours:
        return []

    sh, sm = map(int, hours["start"].split(":"))
    eh, em = map(int, hours["end"].split(":"))
    slot_len = CLINIC_CONFIG["slot_duration_minutes"]

    day_start = tz.localize(datetime.combine(target_date, dtime(sh, sm)))
    day_end   = tz.localize(datetime.combine(target_date, dtime(eh, em)))
    now       = datetime.now(tz)

    # Build all possible slots
    all_slots, cursor = [], day_start
    while cursor + timedelta(minutes=slot_len) <= day_end:
        all_slots.append(cursor)
        cursor += timedelta(minutes=slot_len)

    # Fetch existing calendar events
    result = _service().events().list(
        calendarId=CLINIC_CALENDAR_ID,
        timeMin=day_start.isoformat(),
        timeMax=day_end.isoformat(),
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    busy = []
    for ev in result.get("items", []):
        s = ev["start"].get("dateTime")
        e = ev["end"].get("dateTime")
        if s and e:
            busy.append((datetime.fromisoformat(s), datetime.fromisoformat(e)))

    available = []
    for slot in all_slots:
        if slot <= now:
            continue
        slot_end = slot + timedelta(minutes=slot_len)
        if not any(slot < be and slot_end > bs for bs, be in busy):
            available.append(slot.strftime("%H:%M"))

    return available


def book_appointment(
    patient_name: str,
    patient_phone: str,
    date_str: str,
    time_str: str,
    doctor_name: str,
    reason: str,
) -> dict:
    tz = pytz.timezone(CLINIC_TIMEZONE)
    slot_len = CLINIC_CONFIG["slot_duration_minutes"]

    start_dt = tz.localize(datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M"))
    end_dt   = start_dt + timedelta(minutes=slot_len)

    event = {
        "summary": f"[DentaVoice] {patient_name} — {reason or 'Dental Appointment'}",
        "description": (
            f"Patient: {patient_name}\n"
            f"Phone: {patient_phone or 'Not provided'}\n"
            f"Doctor: {doctor_name or 'First available'}\n"
            f"Reason: {reason or 'General checkup'}\n"
            f"Booked via: DentaVoice AI"
        ),
        "start": {"dateTime": start_dt.isoformat(), "timeZone": CLINIC_TIMEZONE},
        "end":   {"dateTime": end_dt.isoformat(),   "timeZone": CLINIC_TIMEZONE},
    }

    created = _service().events().insert(calendarId=CLINIC_CALENDAR_ID, body=event).execute()

    return {
        "confirmation_id": created["id"][:8].upper(),
        "date": start_dt.strftime("%A, %d %B %Y"),
        "date_iso": date_str,  # YYYY-MM-DD — used for sheet storage and reminder parsing
        "time": start_dt.strftime("%H:%M"),
        "doctor": doctor_name or "First available doctor",
        "duration_minutes": slot_len,
    }
