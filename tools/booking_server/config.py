import os
import json
import base64
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID")
VAPI_SECRET = os.getenv("VAPI_SECRET")
CLINIC_CALENDAR_ID = os.getenv("CLINIC_CALENDAR_ID")
BOOKINGS_SHEET_ID = os.getenv("BOOKINGS_SHEET_ID")
CLINIC_TIMEZONE = os.getenv("CLINIC_TIMEZONE", "Europe/Luxembourg")
BOOKING_SERVER_URL = os.getenv("BOOKING_SERVER_URL", "https://dentavoice-booking.onrender.com")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "+14155238886")
OWNER_PHONE = os.getenv("OWNER_PHONE")  # Your personal number to receive lead alerts


def get_google_credentials():
    b64 = os.getenv("GOOGLE_SERVICE_ACCOUNT_B64")
    if not b64:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_B64 is not set")
    return json.loads(base64.b64decode(b64).decode("utf-8"))


CLINIC_CONFIG = {
    "name": "DentaVoice Clinic",
    "timezone": CLINIC_TIMEZONE,
    "business_hours": {
        "monday":    {"start": "08:00", "end": "18:00"},
        "tuesday":   {"start": "08:00", "end": "18:00"},
        "wednesday": {"start": "08:00", "end": "18:00"},
        "thursday":  {"start": "08:00", "end": "18:00"},
        "friday":    {"start": "08:00", "end": "17:00"},
        "saturday":  {"start": "09:00", "end": "13:00"},
        "sunday":    None,
    },
    "slot_duration_minutes": 30,
    "doctors": ["Dr. Schmidt", "Dr. Müller"],
}
