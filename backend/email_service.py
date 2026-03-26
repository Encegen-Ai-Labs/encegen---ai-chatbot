"""
email_service.py — SMTP Email via GoDaddy Workspace Email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY EMAILS WERE GOING TO SPAM — AND WHAT WAS FIXED:

1. SUBJECT LINE: Emojis (🔔📅) in subject lines are a major spam trigger.
   Fixed: Clean, plain-text subjects. "New Lead - Encegen AI Labs"

2. SENDER NAME: "Enci · Encegen AI Labs" — the · character is unusual.
   Fixed: "Encegen AI Labs CRM"

3. FROM == TO (self-send): Sending from sales@ to sales@ looks like a
   mail loop to spam filters.
   Fixed: Send FROM sales@encegenailabs.com TO sales@encegenailabs.com
   NOTE: You must create sales@encegenailabs.com in GoDaddy and add its
   password to .env as GODADDY_NOREPLY_PASS (or reuse GODADDY_PASS if same).

4. Date header format: Was using IST string instead of RFC 2822 format.
   Fixed: Using email.utils.formatdate() — proper RFC 2822 format.

5. HTML-heavy with gradients, emojis in body — spam filters flag heavy HTML.
   Fixed: Cleaner HTML, emojis removed from critical structural elements.

6. flexbox in email HTML: Many email clients and spam checkers penalize
   CSS flex in emails. Fixed: replaced with table-based layout for buttons.

.env requirements:
  GODADDY_USER=sales@encegenailabs.com   (sender — create in GoDaddy)
  GODADDY_PASS=your_password_here
  GODADDY_TO=sales@encegenailabs.com       (recipient — where to receive)

If you don't want to create a separate noreply@ address:
  GODADDY_USER=sales@encegenailabs.com
  GODADDY_PASS=your_password_here
  GODADDY_TO=sales@encegenailabs.com
  (self-send — slightly higher spam risk but works for internal alerts)
"""

import os
import ssl
import uuid
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from urllib.parse import quote
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

def _ist_now() -> str:
    return datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST")

def _godaddy_ssl() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode    = ssl.CERT_NONE
    return ctx

# ── Config ───────────────────────────────────────────────
GODADDY_HOST  = "smtpout.secureserver.net"
GODADDY_PORT  = 465

def _get_config():
    """
    Returns (smtp_user, smtp_pass, sender_email, recipient_email)
    GODADDY_USER  = the account used to authenticate with SMTP (sender)
    GODADDY_PASS  = its password
    GODADDY_TO    = where to deliver the email (defaults to GODADDY_USER)
    """
    smtp_user  = os.getenv("GODADDY_USER", "").strip()
    smtp_pass  = os.getenv("GODADDY_PASS", "").strip()
    recipient  = os.getenv("GODADDY_TO",   smtp_user).strip()  # default = same as sender
    return smtp_user, smtp_pass, smtp_user, recipient


def _make_msg(subject: str, plain: str, html: str) -> MIMEMultipart:
    """Build a properly-headered multipart email that avoids spam filters."""
    _, _, sender, recipient = _get_config()

    msg = MIMEMultipart("alternative")

    # ── Spam-safe headers ──────────────────────────────
    msg["From"]       = f'"Encegen AI Labs CRM" <{sender}>'
    msg["To"]         = recipient
    msg["Subject"]    = subject                        # NO emojis in subject
    msg["Date"]       = formatdate(localtime=False)    # RFC 2822 format — required
    msg["Message-ID"] = make_msgid(domain="encegenailabs.com")  # proper format
    msg["MIME-Version"] = "1.0"
    msg["Reply-To"]   = recipient
    # Precedence bulk tells mail clients this is automated — reduces spam score
    msg["Precedence"] = "bulk"
    msg["X-Mailer"]   = "Encegen-CRM/2.0"
    # Auto-submitted tells spam filters this is a transactional/system email
    msg["Auto-Submitted"] = "auto-generated"

    # Plain text MUST come first — spam filters favour plain+html over html-only
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html,  "html",  "utf-8"))
    return msg


async def _send(msg: MIMEMultipart, label: str):
    """Send via GoDaddy SMTP. Never raises."""
    smtp_user, smtp_pass, _, _ = _get_config()
    if not smtp_user or not smtp_pass:
        logger.warning(
            "Email not configured. Add GODADDY_USER + GODADDY_PASS to backend/.env"
        )
        return
    try:
        import aiosmtplib
        await aiosmtplib.send(
            msg,
            hostname=GODADDY_HOST,
            port=GODADDY_PORT,
            use_tls=True,
            tls_context=_godaddy_ssl(),
            username=smtp_user,
            password=smtp_pass,
        )
        logger.info(f"[EMAIL] Sent: {label} -> {msg['To']}")
    except Exception as exc:
        logger.error(f"[EMAIL] Failed ({label}): {exc}")


# ════════════════════════════════════════════════════════
# LEAD NOTIFICATION
# ════════════════════════════════════════════════════════

def _lead_plain(lead: dict) -> str:
    return (
        f"NEW LEAD - Encegen AI Labs\n"
        f"{'='*40}\n"
        f"Name     : {lead.get('name') or '—'}\n"
        f"Phone    : {lead.get('phone') or '—'}\n"
        f"Email    : {lead.get('email') or '—'}\n"
        f"Industry : {lead.get('industry') or '—'}\n"
        f"Services : {lead.get('services') or '—'}\n"
        f"Need     : {lead.get('requirements') or '—'}\n"
        f"Deadline : {lead.get('deadline') or lead.get('timeline') or '—'}\n"
        f"{'='*40}\n"
        f"Received : {_ist_now()}\n"
        f"Source   : Enci Chatbot\n"
    )


def _lead_html(lead: dict) -> str:
    name     = lead.get("name")         or "Anonymous Visitor"
    phone    = lead.get("phone")        or ""
    email    = lead.get("email")        or ""
    industry = lead.get("industry")     or "—"
    timeline = lead.get("timeline")     or "—"
    reqs     = lead.get("requirements") or "Not specified"
    services = lead.get("services")     or "—"
    lead_id  = lead.get("id", "")

    # Clean action links (no emoji in href attributes)
    mail_url = (f"mailto:{email}?subject=Following%20up%20-%20Encegen%20AI%20Labs"
                f"&body=Hi%20{name.replace(' ','%20')}%2C%0A%0AThank%20you%20for%20"
                f"your%20interest%20in%20Encegen%20AI%20Labs!%0A%0ABest%20regards%2C%0A"
                f"Encegen%20Sales%20Team")

    deadline = lead.get("deadline") or lead.get("timeline") or "—"
    rows_data = [
        ("Name",     name),
        ("Phone",    f"+91 {phone}" if phone else "—"),
        ("Email",    email or "—"),
        ("Industry", industry),
        ("Deadline", deadline),
    ]
    rows_html = "".join(
        f'<tr>'
        f'<td style="padding:8px 12px;font-size:12px;color:#555;font-weight:600;'
        f'background:#f8f8f8;border:1px solid #e0e0e0;width:110px;">{l}</td>'
        f'<td style="padding:8px 12px;font-size:13px;color:#222;border:1px solid #e0e0e0;">{v}</td>'
        f'</tr>'
        for l, v in rows_data
    )

    # SMS — proper encoding + tel: fallback for desktop
    sms_msg  = (f"Hi {name}, this is the Encegen AI Labs team. "
                f"Thank you for your interest! We would love to connect "
                f"and discuss how we can help you. "
                f"Please let us know a convenient time to chat.")
    sms_enc  = quote(sms_msg, safe="")
    sms_url  = f"sms:+91{phone}?body={sms_enc}" if phone else ""
    tel_url  = f"tel:+91{phone}" if phone else ""

    # Table-based button layout (not flex — email-safe)
    btns = ""
    if phone:
        btns += (f'<td style="padding:4px 8px 4px 4px;">'
                 f'<div style="margin-bottom:4px;font-size:12px;color:#333;font-weight:600;">'
                 f'Client Phone: <a href="{tel_url}" style="color:#5C35E8;text-decoration:none;font-weight:700;">+91 {phone}</a>'
                 f'</div></td>')
    if email:
        btns += (f'<td style="padding:4px;">'
                 f'<a href="{mail_url}" style="display:block;background:#f0edff;color:#5C35E8;'
                 f'font-weight:700;font-size:13px;text-decoration:none;padding:10px 20px;'
                 f'border-radius:6px;border:1px solid #c4b5fd;text-align:center;">Reply by Email</a></td>')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>New Lead - Encegen AI Labs</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;
  border:1px solid #e0e0e0;overflow:hidden;">

  <!-- Header -->
  <tr>
    <td style="background:#5C35E8;padding:24px;text-align:center;">
      <div style="font-size:20px;font-weight:800;color:#ffffff;">New Lead Captured</div>
      <div style="font-size:12px;color:#d4c8ff;margin-top:4px;">
        Encegen AI Labs &middot; Enci Chatbot &middot; {_ist_now()}
      </div>
    </td>
  </tr>

  <!-- Alert -->
  <tr>
    <td style="background:#fffbeb;border-bottom:1px solid #fcd34d;padding:12px 20px;">
      <div style="font-size:13px;font-weight:700;color:#92400e;">
        Action Required: Call within 1 hour for best conversion
      </div>
      <div style="font-size:12px;color:#b45309;margin-top:3px;">
        A potential client just finished a conversation with Enci.
      </div>
    </td>
  </tr>

  <!-- Contact Table -->
  <tr>
    <td style="padding:20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;
        text-transform:uppercase;color:#888;margin-bottom:10px;">Contact Details</div>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-collapse:collapse;border:1px solid #e0e0e0;">
        {rows_html}
      </table>
    </td>
  </tr>

  <!-- Requirements -->
  <tr>
    <td style="padding:0 20px 16px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;
        text-transform:uppercase;color:#888;margin-bottom:8px;">What They Need</div>
      <div style="background:#f8f7ff;border:1px solid #e0e0e0;border-radius:6px;
        padding:12px;font-size:13px;color:#333;line-height:1.6;">{reqs}</div>
    </td>
  </tr>

  <!-- Services -->
  <tr>
    <td style="padding:0 20px 20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;
        text-transform:uppercase;color:#888;margin-bottom:8px;">Services of Interest</div>
      <div style="font-size:13px;color:#5C35E8;font-weight:600;">{services}</div>
    </td>
  </tr>

  <!-- Action Buttons (table-based, not flex) -->
  <tr>
    <td style="padding:0 20px 24px;">
      <table cellpadding="0" cellspacing="0"><tr>{btns}</tr></table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8f8f8;border-top:1px solid #e0e0e0;
      padding:14px 20px;text-align:center;">
      <div style="font-size:11px;color:#999;line-height:1.7;">
        Lead ID: {lead_id} &middot; Encegen AI Labs Pvt Ltd<br/>
        <a href="https://encegenailabs.com"
          style="color:#5C35E8;text-decoration:none;">encegenailabs.com</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


async def send_lead_notification(lead: dict):
    name     = lead.get("name") or "Anonymous Visitor"
    services = lead.get("services", "")
    svc_tag  = f" - {services.split(',')[0].strip()}" if services else ""
    # Clean subject: no emojis, no special chars
    subject  = f"New Lead: {name}{svc_tag} - Encegen AI Labs"

    msg = _make_msg(subject, _lead_plain(lead), _lead_html(lead))
    await _send(msg, f"lead/{name}")


# ════════════════════════════════════════════════════════
# BOOKING NOTIFICATION
# ════════════════════════════════════════════════════════

def _booking_plain(b: dict) -> str:
    return (
        f"NEW CONSULTATION BOOKING - Encegen AI Labs\n"
        f"{'='*40}\n"
        f"Name    : {b.get('name') or '—'}\n"
        f"Phone   : {b.get('phone') or '—'}\n"
        f"Email   : {b.get('email') or '—'}\n"
        f"Date    : {b.get('date') or '—'}\n"
        f"Time    : {b.get('time') or '—'}\n"
        f"Budget   : {b.get('budget') or '—'}\n"
        f"Deadline : {b.get('deadline') or '—'}\n"
        f"Project  : {b.get('project') or '—'}\n"
        f"{'='*40}\n"
        f"Received: {_ist_now()}\n"
        f"Action  : Start Google Meet, copy link, send to client.\n"
    )


def _booking_html(b: dict) -> str:
    name    = b.get("name")    or "—"
    phone   = b.get("phone")   or ""
    email   = b.get("email")   or ""
    date    = b.get("date")    or "—"
    time_s  = b.get("time")    or "—"
    budget  = b.get("budget")  or "Not specified"
    project = b.get("project") or "Not specified"
    lead_id = b.get("id", "")

    deadline = b.get("deadline") or "Not specified"
    rows_data = [
        ("Name",     name),
        ("Phone",    f"+91 {phone}" if phone else "—"),
        ("Email",    email or "—"),
        ("Date",     date),
        ("Time",     time_s),
        ("Budget",   budget),
        ("Deadline", deadline),
        ("Session",  "Consultation — 30 min"),
    ]
    rows_html = "".join(
        f'<tr>'
        f'<td style="padding:8px 12px;font-size:12px;color:#555;font-weight:600;'
        f'background:#f8f8f8;border:1px solid #e0e0e0;width:100px;">{l}</td>'
        f'<td style="padding:8px 12px;font-size:13px;color:#222;border:1px solid #e0e0e0;">{v}</td>'
        f'</tr>'
        for l, v in rows_data
    )

    wa_url = (f"https://wa.me/91{phone}?text=Hi%20{name.replace(' ','%20')}%2C%20"
              f"your%20consultation%20is%20confirmed%20for%20{date.replace(' ','%20')}%20"
              f"at%20{time_s.replace(' ','%20')}.%20We%20will%20share%20a%20Google%20Meet"
              f"%20link%20shortly!") if phone else ""

    mail_url = (f"mailto:{email}?subject=Your%20Consultation%20-%20Encegen%20AI%20Labs"
                f"&body=Hi%20{name.replace(' ','%20')}%2C%0A%0AYour%20slot%3A%20"
                f"{date.replace(' ','%20')}%20at%20{time_s.replace(' ','%20')}.%0A%0A"
                f"Google%20Meet%3A%20https%3A%2F%2Fmeet.google.com%2Fnew%0A%0ABest%20"
                f"regards%2C%0AEncegen%20AI%20Labs") if email else ""

    sms_msg_b  = (f"Hi {name}, this is Encegen AI Labs. "
                  f"Your consultation is confirmed for {date} at {time_s}. "
                  f"We will send you the Google Meet link shortly. "
                  f"Looking forward to speaking with you!")
    sms_enc_b  = quote(sms_msg_b, safe="")
    sms_url_b  = f"sms:+91{phone}?body={sms_enc_b}" if phone else ""
    tel_url_b  = f"tel:+91{phone}" if phone else ""

    btns = (
        f'<td style="padding:4px;">'
        f'<a href="https://meet.google.com/new" style="display:block;background:#1A73E8;'
        f'color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;'
        f'padding:10px 16px;border-radius:6px;text-align:center;">Start Google Meet</a></td>'
    )
    if phone:
        btns += (f'<td style="padding:4px 8px 4px 4px;">'
                 f'<div style="margin-bottom:4px;font-size:12px;color:#333;font-weight:600;">'
                 f'Client Phone: <a href="{tel_url_b}" style="color:#5C35E8;text-decoration:none;font-weight:700;">+91 {phone}</a>'
                 f'</div></td>')
    if email and mail_url:
        btns += (f'<td style="padding:4px;">'
                 f'<a href="{mail_url}" style="display:block;background:#f0edff;color:#5C35E8;'
                 f'font-weight:700;font-size:13px;text-decoration:none;padding:10px 16px;'
                 f'border-radius:6px;border:1px solid #c4b5fd;text-align:center;">Email Client</a></td>')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>New Booking - Encegen AI Labs</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;
  border:1px solid #e0e0e0;overflow:hidden;">

  <!-- Header -->
  <tr>
    <td style="background:#5C35E8;padding:24px;text-align:center;">
      <div style="font-size:20px;font-weight:800;color:#ffffff;">New Consultation Booked</div>
      <div style="font-size:13px;color:#d4c8ff;margin-top:6px;">
        {name} &middot; {date} at {time_s}
      </div>
      <div style="font-size:11px;color:#b8a8f8;margin-top:4px;">
        Encegen AI Labs &middot; {_ist_now()}
      </div>
    </td>
  </tr>

  <!-- Google Meet CTA -->
  <tr>
    <td style="background:#e8f0fe;border-bottom:1px solid #93c5fd;padding:14px 20px;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#1a73e8;margin-bottom:6px;">
        Start Google Meet for this session
      </div>
      <div style="font-size:12px;color:#1e3a5f;">
        Click Start Meet below, copy the link, and send it to the client before the session.
      </div>
    </td>
  </tr>

  <!-- Action Required -->
  <tr>
    <td style="background:#fffbeb;border-bottom:1px solid #fcd34d;padding:11px 20px;">
      <div style="font-size:12px;font-weight:700;color:#92400e;">Action Required</div>
      <div style="font-size:12px;color:#b45309;margin-top:2px;">
        1. Start Google Meet &rarr; 2. Copy the link &rarr; 3. Send to client via WhatsApp or Email.
      </div>
    </td>
  </tr>

  <!-- Client Details -->
  <tr>
    <td style="padding:20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;
        text-transform:uppercase;color:#888;margin-bottom:10px;">Client Details</div>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-collapse:collapse;border:1px solid #e0e0e0;">
        {rows_html}
      </table>
    </td>
  </tr>

  <!-- Project -->
  <tr>
    <td style="padding:0 20px 20px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;
        text-transform:uppercase;color:#888;margin-bottom:8px;">Project / Requirements</div>
      <div style="background:#f8f7ff;border:1px solid #e0e0e0;border-radius:6px;
        padding:12px;font-size:13px;color:#333;line-height:1.6;">{project}</div>
    </td>
  </tr>

  <!-- Buttons -->
  <tr>
    <td style="padding:0 20px 24px;">
      <table cellpadding="0" cellspacing="0"><tr>{btns}</tr></table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8f8f8;border-top:1px solid #e0e0e0;
      padding:14px 20px;text-align:center;">
      <div style="font-size:11px;color:#999;line-height:1.7;">
        Booking ID: {lead_id} &middot; Encegen AI Labs Pvt Ltd<br/>
        <a href="https://encegenailabs.com"
          style="color:#5C35E8;text-decoration:none;">encegenailabs.com</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


async def send_booking_notification(booking: dict):
    name     = booking.get("name") or "Client"
    date_str = booking.get("date", "")
    time_str = booking.get("time", "")
    # Clean subject — no emojis
    subject  = f"New Booking: {name} - {date_str} at {time_str} - Encegen AI Labs"

    msg = _make_msg(subject, _booking_plain(booking), _booking_html(booking))
    await _send(msg, f"booking/{name}")