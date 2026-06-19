import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse

from calendar_utils import get_available_slots, book_appointment
from sheets_utils import log_booking, ensure_header
from config import VAPI_SECRET, CLINIC_CONFIG

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_header()
    log.info("DentaVoice Booking API started")
    yield


app = FastAPI(title="DentaVoice Booking API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "service": "DentaVoice Booking API"}


@app.post("/vapi/tools")
async def vapi_tools(request: Request, x_vapi_secret: str = Header(None)):
    if x_vapi_secret != VAPI_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    body = await request.json()
    tool_calls = body.get("message", {}).get("toolCallList", [])
    log.info(f"Received {len(tool_calls)} tool call(s)")

    results = []
    for call in tool_calls:
        call_id   = call.get("id")
        func_name = call.get("function", {}).get("name", "")
        raw_args  = call.get("function", {}).get("arguments", "{}")

        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
        except json.JSONDecodeError:
            args = {}

        log.info(f"Tool: {func_name} | Args: {args}")
        result = _dispatch(func_name, args)
        results.append({"toolCallId": call_id, "result": result})

    return JSONResponse({"results": results})


def _dispatch(name: str, args: dict) -> str:
    if name == "checkAvailability":
        date = args.get("date", "").strip()
        if not date:
            return "I need a date to check availability. What date were you thinking?"

        slots = get_available_slots(date, args.get("doctor_preference"))
        if not slots:
            return (
                f"The clinic has no available slots on {date} — it may be closed or fully booked. "
                "Would you like to try a different date?"
            )

        shown = slots[:8]
        return f"On {date} we have these open times: {', '.join(shown)}. Which works best for you?"

    elif name == "bookAppointment":
        name_p  = args.get("patient_name", "").strip()
        phone   = args.get("patient_phone", "").strip()
        date    = args.get("date", "").strip()
        t       = args.get("time", "").strip()
        doctor  = args.get("doctor_name", "").strip()
        reason  = args.get("reason", "General checkup").strip()

        if not name_p:
            return "Could you please give me your full name so I can complete the booking?"
        if not date:
            return "Which date would you like the appointment?"
        if not t:
            return "What time works best for you?"

        # Normalize time: "9:00" → "09:00", "900" → "09:00"
        t = t.replace(".", ":").replace(" ", "")
        if ":" not in t:
            t = t.zfill(4)
            t = f"{t[:2]}:{t[2:]}"
        if len(t) == 4 and t[1] == ":":
            t = "0" + t

        try:
            booking = book_appointment(name_p, phone, date, t, doctor, reason)
            log_booking({**booking, "patient_name": name_p, "patient_phone": phone, "reason": reason})
            return (
                f"All booked! Your confirmation number is {booking['confirmation_id']}. "
                f"Appointment: {booking['date']} at {booking['time']} "
                f"with {booking['doctor']} ({booking['duration_minutes']} minutes). "
                "We look forward to seeing you — is there anything else I can help with?"
            )
        except Exception as e:
            log.error(f"Booking failed: {e}", exc_info=True)
            return (
                "I'm sorry, something went wrong while booking. "
                "Please call us directly and we'll sort it out right away."
            )

    elif name == "getClinicInfo":
        doctors = ", ".join(CLINIC_CONFIG["doctors"])
        open_days = []
        for day, hrs in CLINIC_CONFIG["business_hours"].items():
            if hrs:
                open_days.append(f"{day.capitalize()} {hrs['start']}–{hrs['end']}")
        return f"Our doctors are: {doctors}. Opening hours: {'; '.join(open_days)}."

    else:
        log.warning(f"Unknown tool called: {name}")
        return "I'm not sure how to handle that request. Let me transfer you to our reception team."
