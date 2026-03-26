# Enci Chatbot — Integration Guide

This package contains **only the chatbot widget** — no demo page, no landing page.
The widget renders as a fixed floating button in the bottom-right corner of any page.
It does not affect your existing layout or styles.

---

## 📁 What's in this package

```
encegen-project/
├── backend/                  ← Python FastAPI server (runs on your server)
│   ├── main.py               ← API: /api/chat, /api/leads, /api/stats
│   ├── database.py           ← SQLite lead storage
│   ├── email_service.py      ← Email notifications (optional)
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                 ← React widget (build once, embed anywhere)
    ├── src/
    │   ├── components/
    │   │   └── EncegenChatWidget.jsx   ← The entire chatbot widget
    │   ├── lib/
    │   │   └── api.js                  ← Backend API client
    │   ├── App.jsx                     ← Mounts widget only
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Setup — Step by Step

### Step 1: Start the backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env → add your GROQ_API_KEY
uvicorn main:app --host 0.0.0.0 --port 8000
```

Your `.env` needs at minimum:
```
GROQ_API_KEY=gsk_your_key_here
```

---

### Step 2: Build the frontend widget

```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder with the compiled widget files.

---

## 🔌 Option A — Embed in an existing HTML/website (Recommended)

After building (`npm run build`), copy these files from `frontend/dist/` to your website's server:

```
dist/assets/index-[hash].js
dist/assets/index-[hash].css
```

Then add to your website's HTML, just before `</body>`:

```html
<!-- Encegen Enci Chat Widget -->
<div id="enci-root"></div>
<link  rel="stylesheet" href="/assets/index-[hash].css" />
<script type="module"   src="/assets/index-[hash].js"></script>
```

> **Note:** Replace `[hash]` with the actual filename shown after building.
> The widget auto-mounts and floats in the bottom-right — no other changes needed.

---

## 🔌 Option B — Embed in a React website

If your website is already a React app, you can import the widget directly:

```bash
# Copy these two files into your project:
# src/components/EncegenChatWidget.jsx
# src/lib/api.js
```

Then in your root component (e.g. `App.jsx` or `Layout.jsx`):

```jsx
import EncegenChatWidget from "./components/EncegenChatWidget";

export default function App() {
  return (
    <>
      {/* Your existing website content */}
      <YourNavbar />
      <YourRoutes />

      {/* Drop the widget anywhere — it renders fixed/floating, no layout impact */}
      <EncegenChatWidget />
    </>
  );
}
```

---

## 🔌 Option C — Run as standalone widget server (for testing)

```bash
cd frontend
npm run dev      # starts on http://localhost:5173
```

This shows a blank page with the floating chat button — useful for testing.

---

## ⚙️ Configuration

### Backend URL
By default the frontend calls `/api/*` (same origin).
If your backend is on a different domain, create `frontend/.env`:

```
VITE_API_URL=https://api.yourdomain.com
```

Then rebuild: `npm run build`

### Admin panel
The lead capture admin dashboard is available at:
```
http://your-backend:8000/admin
```

---

## 🛡️ Production checklist

- [ ] Set `GROQ_API_KEY` in backend `.env`
- [ ] Set `VITE_API_URL` if backend is on a separate domain
- [ ] Run backend behind nginx/caddy with HTTPS
- [ ] Configure CORS in `backend/main.py` → `allow_origins` to your domain
- [ ] Set `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `.env` for email lead notifications (optional)

---

## 📞 Support

**Encegen AI Labs** · sales@encegenailabs.com · +91 7030555120
