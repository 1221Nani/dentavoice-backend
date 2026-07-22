import logging
from twilio.rest import Client
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM, OWNER_PHONE

log = logging.getLogger(__name__)


def _client():
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def _format_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone
    return phone


def _send_sms(to: str, body: str) -> bool:
    try:
        _client().messages.create(to=to, from_=TWILIO_FROM_NUMBER, body=body)
        log.info(f"SMS sent to {to}")
        return True
    except Exception as e:
        log.error(f"SMS failed to {to}: {e}")
        return False


def _send_whatsapp(to: str, body: str) -> bool:
    if not TWILIO_WHATSAPP_FROM:
        log.warning("TWILIO_WHATSAPP_FROM not set — skipping WhatsApp")
        return False
    try:
        _client().messages.create(
            to=f"whatsapp:{to}",
            from_=f"whatsapp:{TWILIO_WHATSAPP_FROM}",
            body=body,
        )
        log.info(f"WhatsApp sent to {to}")
        return True
    except Exception as e:
        log.error(f"WhatsApp failed to {to}: {e}")
        return False


def send_booking_confirmation(patient_phone: str, booking: dict):
    if not patient_phone:
        log.warning("No patient phone — skipping confirmation")
        return

    to = _format_phone(patient_phone)
    body = (
        f"Hi {booking.get('patient_name', 'there')}! ✅ Your appointment at Bright Smiles Dental "
        f"is confirmed:\n\n"
        f"📅 {booking.get('date')} at {booking.get('time')}\n"
        f"👨‍⚕️ {booking.get('doctor', 'our dentist')}\n"
        f"🔖 Ref: {booking.get('confirmation_id')}\n\n"
        "Reply STOP to opt out of reminders."
    )
    _send_sms(to, body)
    _send_whatsapp(to, body)


def send_lead_notification(lead: dict):
    if not OWNER_PHONE:
        log.warning("OWNER_PHONE not set — skipping lead notification")
        return

    to = _format_phone(OWNER_PHONE)
    name = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or "Someone"
    clinic = lead.get("clinic_name", "Unknown clinic")
    email = lead.get("email", "N/A")
    phone = lead.get("phone", "N/A")
    volume = lead.get("call_volume", "N/A")
    challenge = lead.get("challenge", "")

    body = (
        f"🔥 NEW LEAD — DentaVoice AI\n\n"
        f"👤 {name}\n"
        f"🏥 {clinic}\n"
        f"📧 {email}\n"
        f"📞 {phone}\n"
        f"📊 {volume}\n"
        + (f"💬 \"{challenge}\"\n" if challenge else "")
        + "\nCall or reply now! ⚡"
    )
    _send_sms(to, body)
    _send_whatsapp(to, body)


def send_owner_booking_alert(booking: dict):
    if not OWNER_PHONE:
        log.warning("OWNER_PHONE not set — skipping booking alert")
        return

    to = _format_phone(OWNER_PHONE)
    body = (
        f"📅 NEW BOOKING — DentaVoice AI\n\n"
        f"👤 {booking.get('patient_name', 'Unknown patient')}\n"
        f"📞 {booking.get('patient_phone', 'N/A')}\n"
        f"🗓️ {booking.get('date')} at {booking.get('time')}\n"
        f"👨‍⚕️ {booking.get('doctor', 'our dentist')}\n"
        f"🔖 Ref: {booking.get('confirmation_id')}\n"
        + (f"💬 {booking.get('reason')}\n" if booking.get('reason') else "")
        + "\nThe patient has also been sent a confirmation."
    )
    _send_sms(to, body)
    _send_whatsapp(to, body)


def send_reminder(patient_phone: str, booking: dict) -> bool:
    if not patient_phone:
        log.warning("No patient phone — skipping reminder")
        return False

    to = _format_phone(patient_phone)
    body = (
        f"⏰ Reminder: {booking.get('patient_name', 'Hi')}, your appointment at "
        f"Bright Smiles Dental is in ~2 hours!\n\n"
        f"🕐 Today at {booking.get('time')}\n"
        f"👨‍⚕️ {booking.get('doctor', 'our dentist')}\n"
        f"📍 12 Ave de la Liberté, Luxembourg City\n\n"
        "See you soon! 🦷"
    )
    sms_ok = _send_sms(to, body)
    _send_whatsapp(to, body)
    return sms_ok
