# Email Setup Guide — GoDaddy SMTP + Inbox Delivery

## Why Emails Were Going to Spam (and What Was Fixed)

| # | Problem | Fix Applied |
|---|---------|------------|
| 1 | **Emojis in subject line** (🔔📅) | Removed — subjects are now plain text |
| 2 | **Self-send** (sales@ → sales@) looks like a mail loop | Use noreply@ to send TO sales@ |
| 3 | **CSS flexbox in HTML** email body | Replaced with table-based layout (email-safe) |
| 4 | **Wrong Date header format** | Now uses RFC 2822 standard format |
| 5 | **No plain-text version** | Every email now has plain text + HTML |
| 6 | **Heavy gradient HTML** | Cleaned up to minimal, spam-safe HTML |

---

## Best Setup: Create a noreply@ Address (Recommended)

This is the single most effective fix for inbox delivery.

**Why:** When sales@ sends email TO sales@, spam filters see it as a mail loop.
When noreply@ sends TO sales@, it looks like a normal internal notification.

### Step 1 — Create noreply@encegenailabs.com in GoDaddy

1. Log in to GoDaddy → **My Products** → **Email & Office**
2. Click **Manage** next to your Workspace Email plan
3. Click **Create Email Address**
4. Create: `noreply@encegenailabs.com` with any password

### Step 2 — Update your .env file

```env
GROQ_API_KEY=gsk_your_key_here

GODADDY_USER=noreply@encegenailabs.com    ← SMTP login (sender)
GODADDY_PASS=NoreplyPassword              ← noreply account password
GODADDY_TO=sales@encegenailabs.com        ← where YOU receive alerts
```

### Step 3 — Mark as "Not Spam" once

When the first email arrives in sales@ inbox (or spam):
1. Open it
2. Click **"Not spam"** or **"Move to inbox"**
3. Right-click sender → **"Always trust sender"** or add to contacts

This trains your mail client to trust future emails.

---

## Simple Setup (If You Don't Create noreply@)

```env
GODADDY_USER=sales@encegenailabs.com
GODADDY_PASS=YourGoDaddyPassword
GODADDY_TO=sales@encegenailabs.com
```

This is a self-send (sales@ → sales@). It works but has slightly higher spam risk.
If emails still go to spam, add `sales@encegenailabs.com` to your own contacts.

---

## GoDaddy SMTP Reference

| Setting | Value |
|---------|-------|
| SMTP Server | `smtpout.secureserver.net` |
| Port | `465` (SSL) |
| Username | Your GoDaddy email address |
| Password | Your GoDaddy email password |

---

## SPF / DKIM / DMARC (Advanced — Best Long-Term Fix)

If emails continue going to spam after the above steps, set up email authentication
records in your GoDaddy DNS. GoDaddy usually does this automatically for their own
email, but verify:

1. GoDaddy → **DNS** → Check for SPF record:
   `v=spf1 include:secureserver.net ~all`

2. Check for DKIM record (GoDaddy adds this automatically for Workspace Email)

3. Optionally add DMARC:
   `v=DMARC1; p=none; rua=mailto:sales@encegenailabs.com`

If SPF/DKIM are already there (they usually are with GoDaddy Workspace),
the noreply@ approach above should be sufficient.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Still going to spam | Add sender to contacts + click "Not Spam" on first email |
| `Authentication failed` | Wrong password in GODADDY_PASS |
| `Connection refused on 465` | Try port 587: change `GODADDY_PORT = 587` and `use_tls=False, start_tls=True` in email_service.py |
| No email at all | Check backend logs for `[EMAIL] Failed:` line — error message explains why |
