"""
Runs every 15 minutes. Finds appointments 2 hours away (floor 7:30 AM local time)
and sends an SMS reminder via Twilio.
"""
import logging
from datetime import datetime, timedelta
import pytz
from sheets_utils import get_unreminded_appointments, mark_reminder_sent
from sms_utils import send_reminder
from config import CLINIC_TIMEZONE

log = logging.getLogger(__name__)

REMINDER_WINDOW_MINUTES = 120   # send when appointment is this many minutes away
REMINDER_TOLERANCE_MINUTES = 15  # scheduler runs every 15 min, so match that window
REMINDER_FLOOR_HOUR = 7
REMINDER_FLOOR_MINUTE = 30       # never send before 07:30 local time


def check_and_send_reminders():
    tz = pytz.timezone(CLINIC_TIMEZONE)
    now = datetime.now(tz)
    log.info(f"Reminder check at {now.strftime('%Y-%m-%d %H:%M %Z')}")

    appointments = get_unreminded_appointments()
    log.info(f"Found {len(appointments)} unreminded confirmed appointments")

    for appt in appointments:
        try:
            appt_dt = datetime.strptime(
                f"{appt['date']} {appt['time']}", "%Y-%m-%d %H:%M"
            )
            appt_dt = tz.localize(appt_dt)
        except ValueError:
            log.warning(f"Could not parse datetime for {appt['confirmation_id']}: {appt['date']} {appt['time']}")
            continue

        minutes_until = (appt_dt - now).total_seconds() / 60

        # Ideal send time = appointment - REMINDER_WINDOW_MINUTES, floored at 07:30
        ideal_send = appt_dt - timedelta(minutes=REMINDER_WINDOW_MINUTES)
        floor_time = appt_dt.replace(
            hour=REMINDER_FLOOR_HOUR, minute=REMINDER_FLOOR_MINUTE, second=0, microsecond=0
        )
        if ideal_send < floor_time:
            ideal_send = floor_time

        # Send if we're within one scheduler cycle of the ideal send time
        minutes_since_ideal = (now - ideal_send).total_seconds() / 60
        should_send = 0 <= minutes_since_ideal < REMINDER_TOLERANCE_MINUTES

        log.debug(
            f"{appt['confirmation_id']}: {minutes_until:.0f} min away, "
            f"ideal send was {minutes_since_ideal:.0f} min ago, send={should_send}"
        )

        if should_send:
            sent = send_reminder(appt["patient_phone"], appt)
            if sent:
                mark_reminder_sent(appt["sheet_row"])
