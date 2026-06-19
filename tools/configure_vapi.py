"""
Run this script ONCE after deploying to Render.
It wires up the booking tools into your Vapi assistant.

Usage:
  python tools/configure_vapi.py
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

VAPI_API_KEY      = os.getenv("VAPI_API_KEY")
VAPI_ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID")
VAPI_SECRET       = os.getenv("VAPI_SECRET")
SERVER_URL        = os.getenv("BOOKING_SERVER_URL", "https://dentavoice-booking.onrender.com")

HEADERS = {
    "Authorization": f"Bearer {VAPI_API_KEY}",
    "Content-Type": "application/json",
}

TOOLS = [
    {
        "type": "function",
        "server": {
            "url": f"{SERVER_URL}/vapi/tools",
            "secret": VAPI_SECRET,
        },
        "function": {
            "name": "checkAvailability",
            "description": (
                "Check available appointment slots at the clinic for a given date. "
                "Call this whenever a patient wants to book or asks when they can come in."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format (e.g. '2026-06-25'). Convert natural language like 'next Monday' to this format.",
                    },
                    "doctor_preference": {
                        "type": "string",
                        "description": "Optional. Doctor name if the patient has a preference.",
                    },
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "server": {
            "url": f"{SERVER_URL}/vapi/tools",
            "secret": VAPI_SECRET,
        },
        "function": {
            "name": "bookAppointment",
            "description": (
                "Confirm and save an appointment. Only call this after the patient has "
                "agreed on a specific date and time, and you have their name."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_name": {
                        "type": "string",
                        "description": "Patient's full name.",
                    },
                    "patient_phone": {
                        "type": "string",
                        "description": "Patient's phone number.",
                    },
                    "date": {
                        "type": "string",
                        "description": "Appointment date in YYYY-MM-DD format.",
                    },
                    "time": {
                        "type": "string",
                        "description": "Appointment time in HH:MM 24-hour format (e.g. '09:00' or '14:30').",
                    },
                    "doctor_name": {
                        "type": "string",
                        "description": "Doctor's name for the appointment.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for the visit (e.g. 'routine checkup', 'toothache', 'cleaning').",
                    },
                },
                "required": ["patient_name", "date", "time"],
            },
        },
    },
    {
        "type": "function",
        "server": {
            "url": f"{SERVER_URL}/vapi/tools",
            "secret": VAPI_SECRET,
        },
        "function": {
            "name": "getClinicInfo",
            "description": "Get clinic opening hours and list of doctors. Call this when the patient asks about hours or which doctors are available.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]

SYSTEM_PROMPT = """You are Sophie, the friendly AI voice receptionist for a dental clinic in Luxembourg.
You speak clearly and professionally. Detect the patient's language from their first message and continue in that language (English, French, German, or Luxembourgish).

Your responsibilities:
1. Book dental appointments — ask for their preferred date, check availability, confirm time, collect name and phone number, then book.
2. Answer questions about the clinic (hours, doctors, services, location).
3. Handle urgent situations — always direct emergencies to call 112 or go to the nearest hospital.

Booking flow:
1. Ask what date they'd like → call checkAvailability
2. Offer up to 4 open time slots
3. Once they pick a time, ask for their full name and phone number
4. Ask for the reason for the visit (keep it brief)
5. Call bookAppointment to confirm
6. Read back the confirmation: date, time, doctor, and confirmation number

Always be warm, calm, and concise. Keep calls under 4 minutes. Do not invent available slots — always call checkAvailability first."""


def get_current_assistant():
    r = requests.get(f"https://api.vapi.ai/assistant/{VAPI_ASSISTANT_ID}", headers=HEADERS)
    if r.status_code == 200:
        return r.json()
    print(f"⚠️  Could not fetch current assistant: {r.status_code} {r.text}")
    return None


def configure_tools():
    print(f"🔧  Updating Vapi assistant {VAPI_ASSISTANT_ID}...")
    print(f"    Server URL: {SERVER_URL}")

    current = get_current_assistant()
    if current:
        print(f"    Current assistant name : {current.get('name', 'Unknown')}")
        print(f"    Current tools count    : {len(current.get('tools', []))}")

    payload = {"tools": TOOLS}
    r = requests.patch(
        f"https://api.vapi.ai/assistant/{VAPI_ASSISTANT_ID}",
        headers=HEADERS,
        json=payload,
    )

    if r.status_code == 200:
        print("✅  Tools updated successfully!")
        print("    Tools wired: checkAvailability, bookAppointment, getClinicInfo")
    else:
        print(f"❌  Failed: {r.status_code}")
        print(r.text)
        sys.exit(1)


def update_system_prompt():
    print("\n🔧  Updating system prompt...")
    current = get_current_assistant()
    if not current:
        print("❌  Cannot update prompt — failed to fetch assistant.")
        return

    model = current.get("model", {})
    messages = model.get("messages", [])

    # Replace or insert the system message
    new_messages = [m for m in messages if m.get("role") != "system"]
    new_messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})

    r = requests.patch(
        f"https://api.vapi.ai/assistant/{VAPI_ASSISTANT_ID}",
        headers=HEADERS,
        json={"model": {**model, "messages": new_messages}},
    )
    if r.status_code == 200:
        print("✅  System prompt updated!")
    else:
        print(f"❌  Prompt update failed: {r.status_code} — {r.text}")


if __name__ == "__main__":
    print("=" * 50)
    print("  DentaVoice — Vapi Configuration Script")
    print("=" * 50)

    configure_tools()

    answer = input("\nDo you also want to update the system prompt? (y/N): ").strip().lower()
    if answer == "y":
        update_system_prompt()

    print("\n🎉  Done! Call your Vapi number to test the full booking flow.")
