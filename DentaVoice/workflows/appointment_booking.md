# Workflow: Appointment Booking via DentaVoice AI

## Objective
Handle inbound patient calls end-to-end: answer, check availability, book the appointment on Google Calendar, log it to Google Sheets, and confirm with the patient — all without human involvement.

## Architecture
```
Patient calls Twilio number
        ↓
   Vapi AI (Sophie)
        ↓ tool call
Booking Server (Render.com)
        ↓              ↓
Google Calendar    Google Sheets
  (appointment)     (log row)
        ↓
  Vapi confirms back to patient
```

## Inputs Required per Clinic
- Calendar ID (Google Calendar shared with service account)
- Google Sheet ID (shared with service account)
- Business hours (days + start/end times)
- Doctor names
- Appointment slot duration (default: 30 min)
- Timezone (default: Europe/Luxembourg)

## Tools Used
- `tools/booking_server/main.py` — FastAPI server, deployed on Render.com
- `tools/booking_server/calendar_utils.py` — Google Calendar read/write
- `tools/booking_server/sheets_utils.py` — Google Sheets logging
- `tools/configure_vapi.py` — One-time Vapi wiring script

## Tool Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Keep-warm ping (UptimeRobot monitors this) |
| `/vapi/tools` | POST | All Vapi function calls |

## Vapi Functions Registered
| Function | Trigger | What it does |
|---|---|---|
| `checkAvailability` | Patient asks when they can come | Returns open time slots for a date |
| `bookAppointment` | Patient confirms date/time/name | Creates calendar event + logs to sheet |
| `getClinicInfo` | Patient asks about hours/doctors | Returns clinic details |

## Deployment Steps (one-time setup)
1. Push code to GitHub
2. Connect repo to Render.com → New Web Service
3. Set env vars in Render dashboard (copy from `.env`)
4. Get the Render URL (e.g. `https://dentavoice-booking.onrender.com`)
5. Update `BOOKING_SERVER_URL` in `.env`
6. Run `python tools/configure_vapi.py` to wire tools into Vapi
7. Set up UptimeRobot to ping `/health` every 5 minutes (keeps Render warm)

## Keep-Warm Setup (UptimeRobot — free)
- Go to uptimerobot.com → create free account
- Add monitor: HTTP(s), URL = `https://dentavoice-booking.onrender.com/health`, interval = 5 min
- This prevents the 30-second cold start that would break voice calls

## Per-Clinic Configuration
Each new clinic needs:
1. A new Google Calendar → share it with `sophie-bot@dentavoice-499010.iam.gserviceaccount.com` (Editor)
2. A new Google Sheet → share with same service account (Editor)
3. Update `CLINIC_CONFIG` in `config.py` with their hours and doctors
4. A Twilio phone number assigned to their Vapi assistant

## Known Issues & Fixes
- **Cold start breaks calls**: Fixed by UptimeRobot keep-warm ping
- **Time format variations**: Handled in `main.py` `_dispatch()` — normalizes "9:00", "900", "9.00"
- **Past slots shown**: Filtered in `calendar_utils.py` — only slots after `now` are returned
- **Calendar not shared**: Service account email must be added as Editor to the clinic calendar

## Testing
Call the Vapi demo number and say:
> "Hi, I'd like to book an appointment for next Tuesday"

Expected flow: Sophie greets → asks for preferred time → checks availability → offers slots → collects name/phone → books → confirms with a confirmation number.

Check:
- Google Calendar: new event appears
- Google Sheet: new row logged
