/**
 * EncegenChatWidget.jsx — v7.0
 * Professional UX/CX redesign with:
 * - 4-section structured flows: AI Solutions, Services, Schedule, Contact
 * - Progressive disclosure navigation
 * - Conversational quick-reply buttons
 * - Multi-step schedule booking with form + time slots
 * - Contact directory with all channels
 * - Emoji picker + Chat History
 * - WCAG AA compliant, modern typographic design
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  // Canvas — clean white base for readability
  canvas:    "#F8F9FF",
  surface:   "#FFFFFF",
  raised:    "#EEF0FF",
  sunken:    "#F0F2FF",

  // Brand text
  ink:       "#0D0D2B",       // deep navy-black
  inkMid:    "#2D2D5E",       // medium navy
  inkLight:  "#6B6B9A",       // muted

  // ── Neon accent palette (from holographic cube logo) ──
  accent:    "#6C2FFF",       // neon violet-purple (dominant cube colour)
  accentHov: "#5A1FE8",       // hover — deeper violet
  accentSub: "#00C8FF",       // neon cyan — secondary accent
  accentPale:"#EDE8FF",       // soft lavender tint
  accentBdr: "#B8A0FF",       // violet border

  // Neon palette for gradients & highlights
  neonCyan:  "#00C8FF",
  neonGreen: "#00E87A",
  neonMag:   "#E040FB",
  neonOrng:  "#FF6B1A",

  // Category colors — neon-tinted
  aiPrimary: "#6C2FFF",  aiBg: "#EDE8FF",  aiBdr: "#B8A0FF",
  svcPrimary:"#00A878",  svcBg:"#E0FFF5",  svcBdr:"#00E87A",
  schPrimary:"#E040FB",  schBg:"#FCE4FF",  schBdr:"#CE93D8",
  ctcPrimary:"#FF6B1A",  ctcBg:"#FFF0E8",  ctcBdr:"#FFAB76",

  // Status
  green:     "#006B3C",  greenBg: "#CCFFE6",
  amber:     "#7A4000",  amberBg: "#FFF3CC",
  rose:      "#9F1239",  roseBg:  "#FFE4E6",
  blue:      "#0055CC",  blueBg:  "#E0F0FF",

  // Shadows — neon violet glow
  shadowSm:  "rgba(108,47,255,.10)",
  shadowMd:  "rgba(108,47,255,.18)",
  shadowLg:  "rgba(108,47,255,.26)",
};

const SZ = {
  launcher: 60, bottom: 28, right: 28, width: 390, vmargin: 12,
  get panelBottom() { return this.launcher + this.bottom + 12; },
  get maxH() { return typeof window !== "undefined" ? window.innerHeight - this.panelBottom - this.vmargin : 600; },
};

// ─────────────────────────────────────────────
// TIME UTILS
// ─────────────────────────────────────────────
const OFFICE = { open: 10, close: 19 };
function nowIST() {
  const n = new Date();
  return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + 5.5 * 3600000);
}
const isWorkingDay = d => d.getDay() !== 0;
const isOfficeHour = d => isWorkingDay(d) && d.getHours() >= OFFICE.open && d.getHours() < OFFICE.close;
function fmtTime(d) {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"} IST`;
}
function fmtDate(d) {
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]}, ${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`;
}
function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function getSuggestedSlots() {
  let c = new Date(nowIST().getTime() + 60 * 60000);
  const mm = c.getMinutes();
  if (mm > 0 && mm <= 30) c.setMinutes(30, 0, 0);
  else if (mm > 30) c.setHours(c.getHours() + 1, 0, 0, 0);
  else c.setMinutes(0, 0, 0);
  if (!isOfficeHour(c)) {
    const nx = new Date(c);
    if (c.getHours() >= OFFICE.close || !isWorkingDay(c)) nx.setDate(nx.getDate() + 1);
    while (!isWorkingDay(nx)) nx.setDate(nx.getDate() + 1);
    nx.setHours(OFFICE.open, 0, 0, 0); c = nx;
  }
  const s = [];
  while (s.length < 4) {
    if (c.getHours() >= OFFICE.close) { c.setDate(c.getDate() + 1); while (!isWorkingDay(c)) c.setDate(c.getDate() + 1); c.setHours(OFFICE.open, 0, 0, 0); }
    s.push(new Date(c)); c = new Date(c.getTime() + 90 * 60000);
  }
  return s;
}
function calUrl(slot) {
  const end = new Date(slot.getTime() + 30 * 60000);
  const f = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Discovery Meeting — Encegen AI Labs")}&dates=${f(slot)}/${f(end)}&details=${encodeURIComponent("Free 30-min Discovery Meeting.\nContact: sales@encegenailabs.com")}`;
}

// ─────────────────────────────────────────────
// COMPANY DATA
// ─────────────────────────────────────────────
const CO = {
  email:    "sales@encegenailabs.com",
  support:  "support@encegenailabs.com",
  website:  "https://encegen.in",
  linkedin: "https://linkedin.com/company/encegen-ai-labs",
  address:  "BA Hub, Office No.3, Baif Road, Wagholi, Pune – 412207",
  phone1:   { name: "Sales Team",           role: "Business Development", num: "7030555120" },
  phone2:   { name: "Saurabh Gite",         role: "MD & Founder",         num: "7030555126" },
  phone3:   { name: "Ujjwal Singh Chauhan", role: "ED & COO"             },  // phone not displayed
};

// ─────────────────────────────────────────────
// CHAT HISTORY (localStorage)
// ─────────────────────────────────────────────
const HK = "enci_v7";
const loadHist = () => { try { return JSON.parse(localStorage.getItem(HK) || "[]"); } catch { return []; } };
const saveHist = msgs => {
  if (!msgs.length) return;
  const h = loadHist();
  h.unshift({ id: Date.now(), date: new Date().toISOString(), preview: msgs.find(m => m.role === "user")?.content?.slice(0, 60) || "Chat", messages: msgs });
  localStorage.setItem(HK, JSON.stringify(h.slice(0, 20)));
};
const delSession = id => localStorage.setItem(HK, JSON.stringify(loadHist().filter(s => s.id !== id)));
const clearHist = () => localStorage.removeItem(HK);

// ─────────────────────────────────────────────
// EMOJIS
// ─────────────────────────────────────────────
const EMOJIS = ["😊","😀","😄","😎","🤔","🤩","🙏","👍","👋","🤝","💪","✅","❌","⭐","🔥","💡","📞","✉️","🌐","💼","📅","🚀","🤖","⚙️","🧠","🔧","💬","📊","🎯","🏆","💰","🎉","👏","💯","🔑"];

// ─────────────────────────────────────────────
// AI / CHAT HELPERS
// ─────────────────────────────────────────────
// NOTE: System prompt lives in backend/main.py.
// Frontend handles all casual/personal/off-topic messages locally (zero tokens used).
// Only real company queries go to the API.

function parseReply(raw) {
  const chipsRe = /CHIPS[=:\s]*\[([^\[\]]*(?:"[^"]*"[^\[\]]*)*?)\]/gi;
  let m, lastMatch = null;
  while ((m = chipsRe.exec(raw)) !== null) lastMatch = m;
  if (!lastMatch) return { text: raw, chips: [] };
  let chips = [];
  try {
    const parsed = JSON.parse("[" + lastMatch[1] + "]");
    chips = Array.isArray(parsed) ? parsed.filter(c => typeof c === "string" && c.trim()) : [];
  } catch {
    try {
      chips = lastMatch[1].split(/",\s*"/).map(s => s.replace(/^[\s"]+|[\s"]+$/g, "").trim()).filter(Boolean);
    } catch { chips = []; }
  }
  const text = raw.slice(0, lastMatch.index).replace(/[\n\r]*$/, "").trimEnd();
  return { text, chips };
}

// Send only last 6 messages to stay well under Groq's 6000 TPM free tier limit.
// The backend system prompt already uses ~800-1000 tokens, so we keep conversation lean.
const MAX_HISTORY = 6;

async function callChat(msgs) {
  const trimmed = msgs.slice(-MAX_HISTORY);
  const d = await api.chat(trimmed);
  return d.content || "";
}

async function tryDetectLead(msgs) {
  const userMsgs = msgs.filter(m => m.role === "user");
  if (userMsgs.length < 4) return null;
  const allUserText = userMsgs.map(m => m.content).join(" ");
  const hasPhone = /\b\d{10}\b/.test(allUserText);
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(allUserText);
  if (!hasPhone && !hasEmail) return null;
  const hasName = userMsgs.some(m => /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(m.content));
  if (!hasName) return null;
  try {
    const nameMatch = userMsgs.map(m => m.content).join(" ").match(/[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}/);
    const emailMatch = allUserText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = allUserText.match(/\b\d{10}\b/);
    const saved = await api.createLead({
      name: nameMatch ? nameMatch[0] : null,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      is_lead: true, transcript: msgs, source: "chatbot-enci",
    });
    return saved?.id || true;
  } catch { return null; }
}

const CACHE = {};

// ─────────────────────────────────────────────
// LOCAL INTERCEPTOR ENGINE
// Handles all non-company messages locally — zero API tokens used.
// Categories: greetings, casual, personal, emotional, rude, off-topic, identity.
// ─────────────────────────────────────────────

// Greetings
const GREETING_RE = /^\s*(hey+|hi+|hello+|hii+|helo+|howdy|greetings|good\s*(morning|afternoon|evening|night)|namaste|sup|what'?s\s*up|yo|hiya|heya)[!.?\s]*$/i;
const GREETING_REPLIES = [
  "Hey! 👋 Great to have you here. How can I help you today?",
  "Hi there! 😊 What can I help you with?",
  "Hello! 👋 I'm Enci. What brings you here today?",
  "Hey! 😊 Happy to help. What would you like to know?",
];

// How are you / are you okay / status questions
const HOWRU_RE = /^\s*(how\s+are\s+you|how\s+r\s+u|how\s+are\s+u|how\s+do\s+you\s+do|how\s+is\s+it\s+going|how'?s\s+it\s+going|how\s+are\s+things|what'?s\s+going\s+on|are\s+you\s+okay|are\s+you\s+ok|are\s+you\s+good|are\s+you\s+fine|are\s+you\s+alright|you\s+okay|you\s+good|how\s+are\s+ya)[!.?\s]*$/i;
const HOWRU_REPLIES = [
  "I'm doing great, thanks for asking! 😊 Ready to help you. What's on your mind?",
  "All good here! 😄 What can I help you with today?",
  "Functioning perfectly and happy to help! 😊 What would you like to know?",
  "Great, thanks! 😊 How about you — what can I do for you today?",
];

// Casual / small talk
const CASUAL_RE = /^\s*(what'?s\s+new|tell\s+me\s+something|anything\s+interesting|what\s+do\s+you\s+think|what\s+do\s+you\s+like|do\s+you\s+like|can\s+you\s+talk|let'?s\s+chat|let'?s\s+talk|i\s+am\s+bored|i'?m\s+bored|entertain\s+me|say\s+something|talk\s+to\s+me|hey\s+there|whats\s+up|what\s+is\s+up)[!.?\s]*$/i;
const CASUAL_REPLIES = [
  "Ha, I'd love to chat all day! 😄 But I'm best at helping with Encegen's AI and software services. What can I help you with?",
  "I'm always up for a conversation, but I shine when it comes to AI and tech! 😊 What would you like to know?",
  "Love the energy! 😄 I'm Enci — tell me what you're looking to build or learn about.",
];

// Identity — who are you / who built you / what are you
const IDENTITY_RE = /^\s*(who\s+are\s+you|what\s+are\s+you|who\s+is\s+enci|what\s+is\s+enci|are\s+you\s+(a\s+)?(bot|robot|ai|human|person|real|machine|computer|chatbot)|who\s+(made|built|created|owns|runs|developed|programmed|trained)\s+you|who\s+is\s+your\s+(creator|developer|maker|owner|company)|are\s+you\s+(made|built|created)\s+by|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself)[!.?\s]*$/i;
const IDENTITY_REPLIES = [
  "I'm Enci 🤖 — an AI assistant built by Encegen AI Labs to help you explore our services. I can answer questions about our AI solutions, software, pricing, and more. What would you like to know?",
  "I'm Enci, Encegen AI Labs' AI assistant! 😊 I'm here to help with anything about our AI solutions, software development, digital marketing, and more.",
  "Great question! I'm Enci — built by the team at Encegen AI Labs. I help visitors like you learn about our services and get quick answers. What can I do for you?",
];

// Emotional — I love you / I like you / you're great
const EMOTIONAL_RE = /^\s*(i\s+(love|like|hate|miss|fancy|adore)\s+(you|u)|do\s+you\s+love\s+me|do\s+you\s+like\s+me|will\s+you\s+(marry|date)\s+me|you\s+are\s+(great|amazing|awesome|wonderful|the\s+best|my\s+fav\w*)|i\s+love\s+this\s+bot)[!.?\s]*$/i;
const EMOTIONAL_REPLIES = [
  "That's sweet! 😊 I'm an AI, so I don't have feelings — but I'm always happy to help. What can I do for you?",
  "Haha, appreciate it! 😄 I'm just an AI assistant, but I'm here for you whenever you need help.",
  "You're too kind! 😊 I'm an AI so feelings aren't my thing — but helping you definitely is. What would you like to know?",
];

// Rude / insults
const RUDE_RE = /^\s*(you\s+(are\s+|r\s+)?(dumb|stupid|idiot|useless|trash|garbage|terrible|horrible|worst|rubbish|pathetic|awful)|are\s+you\s+(dumb|stupid|blind|broken|useless|an?\s+idiot)|you\s+suck|shut\s+up|go\s+away|i\s+hate\s+(you|this\s+bot)|dumb\s+bot|stupid\s+bot|useless\s+bot|what\s+the\s+(hell|heck|f\w*)|f\w{2,3}\s+you|screw\s+you)[!.?\s]*$/i;
const RUDE_REPLIES = [
  "I hear you! 😊 I'm an AI assistant — no feelings hurt. Let me know if there's something I can actually help you with.",
  "No worries, I don't take it personally! 😄 I'm here to help whenever you're ready.",
  "That's okay! 😊 I'm just here to help. What would you like to know about Encegen AI Labs?",
  "Fair enough! I'm an AI, so I won't argue. 😊 What can I help you with?",
];

// Off-topic — weather, jokes, general knowledge not related to company
const OFFTOPIC_RE = /^\s*(what'?s\s+the\s+weather|tell\s+me\s+a\s+joke|do\s+you\s+know\s+any\s+jokes|what\s+is\s+the\s+capital|who\s+is\s+the\s+president|what\s+time\s+is\s+it|what'?s\s+the\s+time|what\s+is\s+today|what'?s\s+today|what\s+day\s+is\s+it|what\s+is\s+the\s+date|play\s+music|tell\s+me\s+a\s+story|write\s+a\s+poem|translate|what\s+is\s+the\s+meaning\s+of|define\s+\w+)[!.?\s]*/i;
const OFFTOPIC_REPLIES = [
  "Ha, good one! 😄 That's a bit outside my expertise — I'm best at helping with Encegen's AI and software services. Want to know more?",
  "I'd love to help with that, but I'm specialized for Encegen AI Labs queries! 😊 Ask me about our services, pricing, or solutions.",
  "That's outside my lane! 😄 I'm Enci — I help with anything related to Encegen AI Labs. What would you like to know?",
];

// Personal state — feelings, opinions, dreams
const PERSONAL_RE = /^\s*(do\s+you\s+(have\s+(feelings|emotions|a\s+soul|a\s+heart|a\s+brain|opinions|thoughts|dreams)|feel|think|dream|sleep|eat|drink|breathe|get\s+(tired|bored|angry|sad|happy))|are\s+you\s+(happy|sad|angry|tired|bored|excited|lonely|alive|conscious|sentient|mad|upset)|can\s+you\s+(feel|think|dream|learn|grow))[!.?\s]*$/i;
const PERSONAL_REPLIES = [
  "I'm an AI, so no feelings or emotions — but I'm always ready and happy to help! 😊 What's on your mind?",
  "No feelings here, just code! 😄 But I'm fully focused on helping you. What can I do?",
  "That's a deep question! 😊 I'm an AI so I don't experience feelings — but I'm here and ready to help with anything Encegen-related.",
];

// Thank you / polite closings
const POLITE_RE = /^\s*(thanks?(\s+(a\s+lot|so\s+much|very\s+much|you|u|mate|bro))?|thank\s+you(\s+(so\s+much|a\s+lot|very\s+much))?|thx|ty|thnks?|thnx|(okay|ok|alright|got\s+it|perfect|great|awesome|noted|sounds\s+good|cool)[\s,!]*thank(?:s|\s+you)?|(okay|ok|alright|sounds\s+good|cool|got\s+it|perfect|noted)[\s!,.]*|bye[\s!.]*|goodbye[\s!.]*|see\s+you[\s!.]*|see\s+ya[\s!.]*|good\s*bye[\s!.]*|have\s+a\s+(good|great|nice)\s+(day|one|time)[\s!.]*|take\s+care[\s!.]*)[!.?\s]*$/i;
const POLITE_REPLIES = [
  "You're welcome! 😊 Feel free to reach out anytime.",
  "Happy to help! 😊 Don't hesitate to ask if anything else comes up.",
  "Of course! 😊 We're here whenever you need us.",
  "Anytime! 😊 Have a great day!",
  "Glad I could help! 😊",
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Master interceptor — checks all local patterns, returns reply string or null
function localReply(content) {
  const t = content.trim();
  if (GREETING_RE.test(t))  return pickRandom(GREETING_REPLIES);
  if (HOWRU_RE.test(t))     return pickRandom(HOWRU_REPLIES);
  if (POLITE_RE.test(t))    return pickRandom(POLITE_REPLIES);
  if (IDENTITY_RE.test(t))  return pickRandom(IDENTITY_REPLIES);
  if (EMOTIONAL_RE.test(t)) return pickRandom(EMOTIONAL_REPLIES);
  if (PERSONAL_RE.test(t))  return pickRandom(PERSONAL_REPLIES);
  if (RUDE_RE.test(t))      return pickRandom(RUDE_REPLIES);
  if (CASUAL_RE.test(t))    return pickRandom(CASUAL_REPLIES);
  if (OFFTOPIC_RE.test(t))  return pickRandom(OFFTOPIC_REPLIES);
  return null; // not intercepted — send to API
}

// ─────────────────────────────────────────────
// ICON SET  —  matched to header palette
// stroke #6C2FFF (violet) · fill #EDE8FF (lavender)
// ─────────────────────────────────────────────
const IC = {

  // ── Brain (Frame 3193) ──────────────────────
  brain: (sz=28) => (
    <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none">
      {/* left lobe */}
      <path d="M16 7C14 7 11.5 7.5 10 9.5C9 11 9 12.5 9.5 14C8.5 14.8 7 16 7 18.5C7 21.5 9.5 24 13 24H16"
            stroke="#6C2FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="#EDE8FF"/>
      {/* right lobe */}
      <path d="M16 7C18 7 20.5 7.5 22 9.5C23 11 23 12.5 22.5 14C23.5 14.8 25 16 25 18.5C25 21.5 22.5 24 19 24H16"
            stroke="#6C2FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="#EDE8FF"/>
      {/* centre line */}
      <line x1="16" y1="7" x2="16" y2="24" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
      {/* upper crease */}
      <path d="M10.5 13.5C12 15 14 15.5 16 15.5C18 15.5 20 15 21.5 13.5"
            stroke="#6C2FFF" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      {/* lower crease */}
      <path d="M9.5 19.5C11 21 13.5 21.5 16 21.5C18.5 21.5 21 21 22.5 19.5"
            stroke="#6C2FFF" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <circle cx="16" cy="7" r="1.4" fill="#6C2FFF"/>
    </svg>
  ),

  // ── Gear / Settings ─────────────────────────
  gear: (sz=28) => (
    <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="4" stroke="#6C2FFF" strokeWidth="1.8" fill="#EDE8FF"/>
      <path d="M16 5.5V8.5M16 23.5V26.5M5.5 16H8.5M23.5 16H26.5M8.6 8.6L10.7 10.7M21.3 21.3L23.4 23.4M8.6 23.4L10.7 21.3M21.3 10.7L23.4 8.6"
            stroke="#6C2FFF" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  ),

  // ── Calendar (Frame 3185) ───────────────────
  calendar: (sz=28) => (
    <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="7" width="24" height="21" rx="3" stroke="#6C2FFF" strokeWidth="1.8" fill="#EDE8FF"/>
      <line x1="4" y1="14" x2="28" y2="14" stroke="#6C2FFF" strokeWidth="1.7"/>
      <rect x="10" y="3.5" width="3" height="7" rx="1.5" fill="#6C2FFF"/>
      <rect x="19" y="3.5" width="3" height="7" rx="1.5" fill="#6C2FFF"/>
      {/* day squares row 1 */}
      <rect x="8.5"  y="18" width="4" height="4" rx="1" fill="#6C2FFF"/>
      <rect x="14"   y="18" width="4" height="4" rx="1" fill="#6C2FFF"/>
      <rect x="19.5" y="18" width="4" height="4" rx="1" fill="#6C2FFF"/>
      {/* day squares row 2 */}
      <rect x="8.5"  y="23" width="4" height="3" rx="1" fill="#6C2FFF" opacity="0.45"/>
      <rect x="14"   y="23" width="4" height="3" rx="1" fill="#6C2FFF" opacity="0.45"/>
    </svg>
  ),

  // ── Phone with incoming arrow ────────────────
  phone: (sz=28) => (
    <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none">
      <path d="M8 6H12.5L15 12L12 13.8C13.8 17.5 17.5 20.5 21 22L22.5 18.5L28 21V25C28 25 25 28 22 27C11 24 5 12.5 5 10C5 7.5 8 6 8 6Z"
            stroke="#6C2FFF" strokeWidth="1.8" strokeLinejoin="round" fill="#EDE8FF"/>
      {/* incoming arrow — top right */}
      <path d="M23 6H28V11" stroke="#6C2FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="28" y1="6" x2="22" y2="12" stroke="#6C2FFF" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),

  // ── Bot · AI Chatbot ─────────────────────────
  bot: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="9" width="22" height="14" rx="4" stroke="#6C2FFF" strokeWidth="1.7" fill="#EDE8FF"/>
      <circle cx="9.5"  cy="15.5" r="2" fill="#6C2FFF"/>
      <circle cx="18.5" cy="15.5" r="2" fill="#6C2FFF"/>
      <path d="M10.5 20C11.5 21 12.5 21.5 14 21.5C15.5 21.5 16.5 21 17.5 20"
            stroke="#6C2FFF" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="14" y1="5"  x2="14" y2="9"  stroke="#6C2FFF" strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="14" cy="4" r="1.5" stroke="#6C2FFF" strokeWidth="1.4" fill="#EDE8FF"/>
      <line x1="3"  y1="15.5" x2="1"  y2="15.5" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="25" y1="15.5" x2="27" y2="15.5" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  // ── Chart · Analytics ───────────────────────
  chart: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="3" width="22" height="22" rx="3" stroke="#6C2FFF" strokeWidth="1.6" fill="#EDE8FF"/>
      <rect x="7"  y="17" width="4" height="6" rx="1" fill="#6C2FFF"/>
      <rect x="12" y="13" width="4" height="10" rx="1" fill="#6C2FFF"/>
      <rect x="17" y="9"  width="4" height="14" rx="1" fill="#6C2FFF"/>
      <polyline points="7,13 11,9 15,11 21,6"
                stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),

  // ── Eye · Computer Vision ───────────────────
  eye: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <path d="M3 14C3 14 7.5 6 14 6C20.5 6 25 14 25 14C25 14 20.5 22 14 22C7.5 22 3 14 3 14Z"
            stroke="#6C2FFF" strokeWidth="1.7" strokeLinejoin="round" fill="#EDE8FF"/>
      <circle cx="14" cy="14" r="4"   stroke="#6C2FFF" strokeWidth="1.6" fill="white"/>
      <circle cx="14" cy="14" r="1.8" fill="#6C2FFF"/>
    </svg>
  ),

  // ── Cycle · Automation ──────────────────────
  cycle: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <path d="M5 14A9 9 0 0 1 22 9"  stroke="#6C2FFF" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M23 14A9 9 0 0 1 6 19" stroke="#6C2FFF" strokeWidth="1.8" strokeLinecap="round"/>
      <polyline points="20,5 22,9 25.5,7.5"  stroke="#6C2FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polyline points="8,23 6,19 2.5,20.5"  stroke="#6C2FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),

  // ── Bolt · Custom AI ────────────────────────
  bolt: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <path d="M16 3L5 16H13L12 25L23 12H15L16 3Z"
            stroke="#6C2FFF" strokeWidth="1.7" strokeLinejoin="round" fill="#EDE8FF"/>
    </svg>
  ),

  // ── Monitor × 2 (Frame 3189 · Software) ─────
  laptop: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 34 26" fill="none">
      {/* left monitor */}
      <rect x="1" y="3" width="18" height="14" rx="2" stroke="#6C2FFF" strokeWidth="1.7" fill="#EDE8FF"/>
      <line x1="10" y1="17" x2="10" y2="21" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6"  y1="21" x2="14" y2="21" stroke="#6C2FFF" strokeWidth="1.6" strokeLinecap="round"/>
      {/* right monitor (slightly behind) */}
      <rect x="20" y="6" width="13" height="10" rx="2" stroke="#6C2FFF" strokeWidth="1.5" fill="#EDE8FF"/>
      <line x1="26.5" y1="16" x2="26.5" y2="19" stroke="#6C2FFF" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="23.5" y1="19" x2="29.5" y2="19" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  // ── Globe × 2 (Frame 3186 · Web) ────────────
  globe: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke="#6C2FFF" strokeWidth="1.7" fill="#EDE8FF"/>
      <ellipse cx="14" cy="14" rx="5"  ry="10" stroke="#6C2FFF" strokeWidth="1.4"/>
      <line x1="4"  y1="14" x2="24" y2="14" stroke="#6C2FFF" strokeWidth="1.4"/>
      <path d="M5.5 9.5C8.5 10.5 11.2 11 14 11C16.8 11 19.5 10.5 22.5 9.5"
            stroke="#6C2FFF" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M5.5 18.5C8.5 17.5 11.2 17 14 17C16.8 17 19.5 17.5 22.5 18.5"
            stroke="#6C2FFF" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),

  // ── Palette · Design ────────────────────────
  palette: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <path d="M14 4C9 4 5 8 5 13C5 18 8.5 22 14 22C15.5 22 16 21 17.5 21C19 21 19.5 22 21 21.3C22.2 20.5 23 18.8 23 17.5C23 13.5 19.5 10.5 17.5 10.5C16 10.5 15.5 11.5 14 11.5C12.5 11.5 11 9.5 14 4Z"
            stroke="#6C2FFF" strokeWidth="1.6" fill="#EDE8FF"/>
      <circle cx="9.5"  cy="13.5" r="1.5" fill="#6C2FFF"/>
      <circle cx="11.5" cy="9.5"  r="1.5" fill="#6C2FFF"/>
      <circle cx="9.5"  cy="17.5" r="1.5" fill="#6C2FFF"/>
      <circle cx="18.5" cy="17.5" r="1.5" fill="#6C2FFF"/>
    </svg>
  ),

  // ── Trending · Marketing ────────────────────
  trending: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <polyline points="3,21 9,13 13,17 21,8"
                stroke="#6C2FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polyline points="17,8 21,8 21,12"
                stroke="#6C2FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="3" y1="24" x2="25" y2="24" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  // ── Link · Integration ──────────────────────
  link: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 28 28" fill="none">
      <path d="M11 16C11.6 18 13 18.5 15 18.5H18.5C21.5 18.5 24 16 24 13C24 10 21.5 7.5 18.5 7.5H15C13 7.5 11.4 9 11 11"
            stroke="#6C2FFF" strokeWidth="2" strokeLinecap="round"/>
      <path d="M17 12C16.4 10 15 9.5 13 9.5H9.5C6.5 9.5 4 12 4 15C4 18 6.5 20.5 9.5 20.5H13C15 20.5 16.6 19 17 17"
            stroke="#6C2FFF" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  // ── Mobile × 2 (Frame 3190) ─────────────────
  mobile: (sz=26) => (
    <svg width={sz} height={sz} viewBox="0 0 32 28" fill="none">
      {/* left phone */}
      <rect x="1" y="3" width="13" height="22" rx="2.5" stroke="#6C2FFF" strokeWidth="1.7" fill="#EDE8FF"/>
      <line x1="5"  y1="6"  x2="10" y2="6"  stroke="#6C2FFF" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="7.5" cy="22" r="1.2" fill="#6C2FFF"/>
      {/* right phone */}
      <rect x="17" y="5" width="14" height="20" rx="3" stroke="#6C2FFF" strokeWidth="1.6" fill="#EDE8FF"/>
      <line x1="21" y1="8"  x2="27" y2="8"  stroke="#6C2FFF" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="24" cy="22.5" r="1.2" fill="#6C2FFF"/>
    </svg>
  ),

  // ── Pin (Frame 3188) ────────────────────────
  pin: (sz=22) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.5 2 6 4.7 6 8.5C6 13.5 12 22 12 22C12 22 18 13.5 18 8.5C18 4.7 15.5 2 12 2Z"
            stroke="#6C2FFF" strokeWidth="1.6" fill="#EDE8FF"/>
      <circle cx="12" cy="8.5" r="2.8" stroke="#6C2FFF" strokeWidth="1.4" fill="white"/>
    </svg>
  ),

  // ── Mail ────────────────────────────────────
  mail: (sz=22) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="#6C2FFF" strokeWidth="1.6" fill="#EDE8FF"/>
      <path d="M2 7.5L12 14L22 7.5" stroke="#6C2FFF" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),

  // ── Phone small (contact rows) ──────────────
  phoneSm: (sz=22) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <path d="M7 4H10L12 9L9.5 10.5C11 13.5 13.5 16 16.5 17.5L18 15L23 17V20.5C23 20.5 20.5 23 18 22.5C11 21 3 13 4 7C4 5.5 7 4 7 4Z"
            stroke="#6C2FFF" strokeWidth="1.5" strokeLinejoin="round" fill="#EDE8FF"/>
      <path d="M18 4H22V8" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="22" y1="4" x2="17" y2="9" stroke="#6C2FFF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  // ── LinkedIn ────────────────────────────────
  linkedin: (sz=22) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="#6C2FFF" strokeWidth="1.5" fill="#EDE8FF"/>
      <rect x="6.5" y="10" width="3" height="8" rx="0.8" fill="#6C2FFF"/>
      <circle cx="8" cy="7.5" r="1.5" fill="#6C2FFF"/>
      <path d="M12 18V14C12 12.3 13.3 11 15 11C16.7 11 18 12.3 18 14V18"
            stroke="#6C2FFF" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="12" y1="10" x2="12" y2="18" stroke="#6C2FFF" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),

  // ── Globe small (contact rows) ──────────────
  webSm: (sz=22) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#6C2FFF" strokeWidth="1.5" fill="#EDE8FF"/>
      <ellipse cx="12" cy="12" rx="4.5" ry="9" stroke="#6C2FFF" strokeWidth="1.3"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke="#6C2FFF" strokeWidth="1.3"/>
      <path d="M4.5 8C7 9 9.5 9.5 12 9.5C14.5 9.5 17 9 19.5 8"
            stroke="#6C2FFF" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M4.5 16C7 15 9.5 14.5 12 14.5C14.5 14.5 17 15 19.5 16"
            stroke="#6C2FFF" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),

  // ── Chat bubble ─────────────────────────────
  chat: (sz=22) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <path d="M3 5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V15C21 16.1 20.1 17 19 17H8L3 21V5Z"
            stroke="#6C2FFF" strokeWidth="1.5" strokeLinejoin="round" fill="#EDE8FF"/>
      <line x1="8" y1="8"    x2="16" y2="8"    stroke="#6C2FFF" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="8" y1="11.5" x2="13" y2="11.5" stroke="#6C2FFF" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};

// ─────────────────────────────────────────────
// SECTION DATA
// ─────────────────────────────────────────────
const AI_SUBS = [
  { id: "chatbots",   icon: IC.bot(24), label: "AI Chatbots & Virtual Assistants", desc: "WhatsApp, Web, CRM integrations", badge: "Popular",
    prompt: "Give a detailed overview of Encegen AI Labs' AI Chatbot and Virtual Assistant solutions. Cover: types of chatbots (customer support, lead gen, FAQ, internal), channels supported (WhatsApp, website, CRM, Telegram), technology stack, and 2 real business use cases." },
  { id: "analytics",  icon: IC.chart(24), label: "Predictive Analytics & AI Models",  desc: "Forecasting · Decision intelligence",
    prompt: "Explain Encegen AI Labs' Predictive Analytics and AI Model services. Cover: forecasting, recommendation engines, anomaly detection, customer churn prediction. Include industries and example business outcomes." },
  { id: "cv",         icon: IC.eye(24),  label: "Computer Vision Solutions",          desc: "Object detection · OCR · Video analytics", badge: "New",
    prompt: "Describe Encegen AI Labs' Computer Vision capabilities: YOLO v8 object detection, facial recognition, OCR and document parsing, video analytics, defect detection, license plate recognition, retail shelf analytics. Give 2 concrete use cases." },
  { id: "genai",      icon: IC.brain(24), label: "Generative AI & LLMs",               desc: "Custom LLMs · RAG · AI Agents",
    prompt: "Explain Encegen AI Labs' Generative AI offerings: custom LLM fine-tuning, RAG, AI Agents and automation, image and code generation, AI-powered search. Include real business applications." },
  { id: "automation", icon: IC.cycle(24), label: "AI Workflow Automation",              desc: "RPA · Process intelligence · Integrations",
    prompt: "Describe Encegen AI Labs' AI Workflow Automation and RPA services: robotic process automation, intelligent document processing, workflow orchestration, API integrations. Give examples with measurable business impact." },
  { id: "custom",     icon: IC.bolt(24), label: "Custom AI Development",               desc: "Tailored solutions for your industry",
    prompt: "Explain how Encegen AI Labs approaches Custom AI Development — tailoring AI to specific business needs. Cover: discovery, solution design, model training, deployment, support. Mention industries served." },
];

const SVC_SUBS = [
  { id: "software",     icon: IC.laptop(24), label: "Custom Software Development",  desc: "Web apps · SaaS · APIs · CRM/ERP",      color: "#0F766E", bg: "#F0FDFA",
    prompt: "Describe Encegen AI Labs' Custom Software Development services. Cover: SaaS, CRM, ERP, HRMS, internal tools, tech stack (React, Next.js, Node.js, Python, FastAPI, AWS/GCP), timelines, and 2 real client use cases." },
  { id: "web",          icon: IC.globe(24), label: "Website & E-Commerce",          desc: "Corporate sites · Shopify · PWA",         color: "#0369A1", bg: "#EFF6FF",
    prompt: "Explain Encegen AI Labs' Website and E-Commerce development: corporate websites, CMS, Shopify/WooCommerce, PWAs, payment integrations (Razorpay, Stripe), SEO, performance. Typical timelines: 2–4 weeks for websites." },
  { id: "design",       icon: IC.palette(24), label: "UI/UX & Graphic Design",        desc: "User research · Prototyping · Branding",  color: "#9D174D", bg: "#FDF2F8",
    prompt: "Describe Encegen AI Labs' UI/UX and Graphic Design services: user research, wireframing, prototyping in Figma, design systems, branding, mobile-first design, and how good UX drives business outcomes." },
  { id: "marketing",    icon: IC.trending(24), label: "Digital Marketing & Growth",    desc: "SEO · Google Ads · Social Media",          color: "#B45309", bg: "#FFFBEB",
    prompt: "Explain Encegen AI Labs' Digital Marketing and Growth services: SEO, Google Ads, Meta Ads, LinkedIn Ads, Social Media management, content strategy, CRO. Give examples of business results achieved." },
  { id: "integration",  icon: IC.link(24), label: "System Integration & APIs",     desc: "CRM · ERP · WhatsApp · 3rd party APIs",    color: "#164E63", bg: "#ECFEFF",
    prompt: "Describe Encegen AI Labs' System Integration and API services: REST/GraphQL APIs, CRM integrations (Zoho, HubSpot), WhatsApp Business API, ERP/HRMS integrations, data pipeline development." },
  { id: "mobile",       icon: IC.mobile(24), label: "Mobile App Development",         desc: "React Native · Flutter · iOS & Android",   color: "#4338CA", bg: "#EEF2FF",
    prompt: "Describe Encegen AI Labs' Mobile App Development: React Native and Flutter cross-platform, iOS and Android native apps, app store submission, push notifications, offline capabilities." },
];

const CALL_TYPES = [
  { id: "consult", icon: "📋", label: "Book a Consultation", desc: "General enquiry or project overview", color: "#0F766E", bg: "#F0FDFA",
    topics: ["Project scope & requirements discussion", "AI & technology recommendations for your business", "Budget, timeline & delivery planning", "Team introduction & process walkthrough", "Q&A — any questions you have for our team"]
  },
];

// ─────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────

function Avatar({ size = 32 }) {
  const r = Math.round(size * 0.22);   // rounded square — NOT a circle
  return (
    <div style={{
      width: size, height: size,
      borderRadius: r,               // app-icon style corners
      flexShrink: 0,
      overflow: "hidden",
      background: "#0D0D2B",         // dark navy — matches logo bg
      boxShadow: "0 2px 10px rgba(108,47,255,.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <img
        src="/Encegen_logo.jpg"
        alt="Encegen"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

function Tag({ children, color = C.accent, bg = C.accentPale }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
      background: bg, color: color,
      borderRadius: 20, padding: "2px 7px",
      border: `1px solid ${color}33`,
    }}>{children}</span>
  );
}

function Pill({ children, active, onClick, icon }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        background: active ? C.accent : hov ? C.accentPale : C.surface,
        border: `1.5px solid ${active ? C.accent : hov ? C.accentBdr : "#E2DFF5"}`,
        borderRadius: 24, padding: "5px 12px 5px 9px",
        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
        transition: "all .18s", flexShrink: 0,
        boxShadow: active ? `0 2px 8px ${C.shadowSm}` : "none",
      }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600, color: active ? "#fff" : hov ? C.accent : C.inkMid }}>
        {children}
      </span>
    </button>
  );
}

function BackBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: hov ? "#EDE8FF" : "#F3EEFF",
        border: `1.5px solid ${hov ? "#6C2FFF" : "#D4C5FF"}`,
        borderRadius: 10, padding: "6px 14px",
        cursor: "pointer", fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 700,
        color: "#6C2FFF",
        transition: "all .18s", flexShrink: 0,
        boxShadow: hov ? "0 2px 8px rgba(108,47,255,.22)" : "none",
      }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 2L4 7L9 12" stroke="#6C2FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  );
}

function PrimaryBtn({ children, onClick, disabled, fullWidth }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => !disabled && setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: fullWidth ? "100%" : "auto",
        padding: "11px 20px",
        background: disabled ? "#D1D5DB" : hov ? C.accentHov : C.accent,
        border: "none", borderRadius: 12,
        color: disabled ? "#9CA3AF" : "#fff",
        fontSize: 13.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", transition: "all .2s",
        boxShadow: disabled ? "none" : hov ? `0 6px 20px ${C.shadowMd}` : `0 3px 12px ${C.shadowSm}`,
        transform: hov && !disabled ? "translateY(-1px)" : "none",
      }}>
      {children}
    </button>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "4px 2px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "inline-block", width: 7, height: 7, borderRadius: "50%",
          background: C.accent, animation: `enciDot 1.1s ease ${i * .18}s infinite`,
        }} />
      ))}
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#EAE7F5" }} />
      {label && <span style={{ fontSize: 9.5, color: C.inkLight, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: "#EAE7F5" }} />
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION ROW CARD — used in AI & Services
// ─────────────────────────────────────────────
function SectionCard({ icon, label, desc, color = C.accent, bg, badge, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 13,
        background: hov ? C.accentPale : C.surface,
        border: `1.5px solid ${hov ? C.accentBdr : "#EAE7F5"}`,
        borderRadius: 14, padding: "11px 14px", cursor: "pointer",
        transition: "all .2s", marginBottom: 8,
        boxShadow: hov ? `0 4px 18px ${C.shadowSm}` : `0 1px 3px rgba(0,0,0,.04)`,
        transform: hov ? "translateY(-1px)" : "none",
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: C.accentPale,
        border: `1.5px solid ${C.accentBdr}`,
        boxShadow: "0 2px 8px rgba(108,47,255,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>{label}</span>
          {badge && <Tag color={color} bg={`${color}14`}>{badge}</Tag>}
        </div>
        <div style={{ fontSize: 11.5, color: C.inkLight, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: hov ? C.accentPale : "transparent",
        border: `1.5px solid ${hov ? C.accentBdr : "#EAE7F5"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: hov ? C.accent : C.inkLight, fontSize: 13, transition: "all .2s",
      }}>→</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION HERO BANNER
// ─────────────────────────────────────────────
function SectionHero({ icon, title, subtitle, color, bg }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.accent}, ${C.accentSub})`,
      borderRadius: 16, padding: "16px 18px", marginBottom: 16, color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -24, right: -16, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
      <div style={{ position: "absolute", bottom: -20, right: 30, width: 55, height: 55, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8, position: "relative" }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>{title}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MARKDOWN RENDERER
// ─────────────────────────────────────────────
function MsgContent({ text }) {
  const cleaned = text.replace(/CHIPS[=:]\[[\s\S]*?\]\s*$/gm, "").trimEnd();
  const segs = [];
  const cr = /```(\w*)\n?([\s\S]*?)```/g;
  let li = 0, m;
  while ((m = cr.exec(cleaned)) !== null) {
    if (m.index > li) segs.push({ t: "text", c: cleaned.slice(li, m.index) });
    segs.push({ t: "code", c: m[2].trim() });
    li = m.index + m[0].length;
  }
  if (li < cleaned.length) segs.push({ t: "text", c: cleaned.slice(li) });
  return (
    <div>
      {segs.map((seg, si) => seg.t === "code" ? (
        <pre key={si} style={{ background: "#1E1B4B", borderRadius: 8, padding: "10px 12px", fontSize: 11, overflowX: "auto", margin: "8px 0", border: `1px solid ${C.accentBdr}`, fontFamily: "'Courier New',monospace", lineHeight: 1.6, color: "#C4B5FD" }}>
          <code>{seg.c}</code>
        </pre>
      ) : (
        <div key={si}>
          {seg.c.split("\n").map((line, i) => {
            const wb = line.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.accent}">$1</strong>`);
            if (/^#+\s/.test(line)) return <div key={i} style={{ fontWeight: 700, fontSize: 13, color: C.accent, margin: "10px 0 5px", paddingBottom: 4, borderBottom: `1px solid ${C.accentPale}` }} dangerouslySetInnerHTML={{ __html: wb.replace(/^#+\s/, "") }} />;
            if (/^\s*[-•*]/.test(line)) return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}><span style={{ color: C.accent, flexShrink: 0, marginTop: 5, fontSize: 6 }}>◆</span><span style={{ color: C.inkMid, fontSize: 12.5, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: wb.replace(/^\s*[-•*]\s*/, "") }} /></div>;
            if (line.trim()) return <p key={i} style={{ margin: "3px 0", fontSize: 12.5, color: C.inkMid, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: wb }} />;
            return <div key={i} style={{ height: 5 }} />;
          })}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// CHAT BUBBLE
// ─────────────────────────────────────────────
function Bubble({ msg, onChipSelect, isLast }) {
  const u = msg.role === "user";
  return (
    <div style={{ marginBottom: 12, animation: "enciMsg .22s ease" }}>
      <div style={{ display: "flex", justifyContent: u ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
        {!u && <Avatar size={28} />}
        <div style={{
          maxWidth: "83%",
          background: u ? "linear-gradient(135deg, #6C2FFF 0%, #00C8FF 100%)" : C.raised,
          border: u ? "none" : `1.5px solid #EAE7F5`,
          borderRadius: u ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
          padding: "10px 13px",
          boxShadow: u ? `0 2px 12px ${C.shadowSm}` : "none",
        }}>
          {u
            ? <p style={{ margin: 0, fontSize: 12.5, color: "#fff", lineHeight: 1.6 }}>{msg.content}</p>
            : <MsgContent text={msg.content} />}
        </div>
      </div>
      {/* Chips under last bot message */}
      {!u && isLast && msg.chips?.length > 0 && (
        <div style={{ paddingLeft: 36, marginTop: 8 }}>
          <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>Suggested questions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {msg.chips.map((chip, i) => (
              <button key={i} onClick={() => onChipSelect(chip)}
                onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = `0 3px 10px ${C.shadowSm}`; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.accentPale; e.currentTarget.style.borderColor = C.accentBdr; e.currentTarget.style.color = C.accent; e.currentTarget.style.boxShadow = "none"; }}
                style={{
                  background: C.accentPale,
                  border: `1.5px solid ${C.accentBdr}`,
                  borderRadius: 10, padding: "8px 12px",
                  fontSize: 12, fontWeight: 600, color: C.accent,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all .18s", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "none",
                }}>
                <span style={{ fontSize: 9, color: C.accent }}>▶</span>{chip}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// EMOJI PICKER
// ─────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }) {
  const r = useRef();
  useEffect(() => {
    const h = e => { if (r.current && !r.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={r} style={{
      position: "absolute", bottom: "calc(100% + 8px)", left: 0,
      background: C.surface, border: `1.5px solid #EAE7F5`,
      borderRadius: 14, padding: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,.12)", zIndex: 100, width: 268,
      animation: "enciUp .2s ease",
    }}>
      <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}>Pick an emoji</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {EMOJIS.map((em, i) => (
          <button key={i} onClick={() => onPick(em)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, borderRadius: 7, padding: "3px 4px", transition: "background .15s", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.background = C.raised}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>{em}</button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHAT HISTORY PANEL
// ─────────────────────────────────────────────
function HistoryPanel({ onClose, onRestore }) {
  const [sessions, setSessions] = useState(loadHist());
  const [expanded, setExpanded] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const doDelete = id => { delSession(id); setSessions(loadHist()); if (expanded === id) setExpanded(null); };
  const doClrAll = () => { clearHist(); setSessions([]); setConfirm(false); };
  return (
    <div style={{ position: "absolute", inset: 0, background: C.surface, zIndex: 200, display: "flex", flexDirection: "column", animation: "enciUp .25s ease", borderRadius: 22 }}>
      <div style={{ padding: "13px 16px", borderBottom: `1.5px solid #EAE7F5`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <BackBtn onClick={onClose} />
        <span style={{ fontWeight: 700, fontSize: 14, color: C.ink, flex: 1 }}>🕐 Chat History</span>
        {sessions.length > 0 && <button onClick={() => setConfirm(true)} style={{ background: "none", border: "none", fontSize: 11, color: C.rose, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>Clear all</button>}
      </div>
      {confirm && (
        <div style={{ margin: "10px 16px 0", background: C.roseBg, border: "1px solid #FECACA", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.rose, flex: 1 }}>Delete all history?</span>
          <button onClick={doClrAll} style={{ background: C.rose, border: "none", color: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Yes</button>
          <button onClick={() => setConfirm(false)} style={{ background: C.raised, border: `1px solid #EAE7F5`, color: C.inkMid, borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>No</button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", background: C.canvas }}>
        {sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: C.inkLight }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.inkMid, marginBottom: 6 }}>No history yet</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>Your conversations will appear here after your first chat.</div>
          </div>
        ) : sessions.map(s => (
          <div key={s.id} style={{ background: C.surface, border: `1.5px solid #EAE7F5`, borderRadius: 14, marginBottom: 10, overflow: "hidden", boxShadow: `0 1px 4px rgba(0,0,0,.04)` }}>
            <div style={{ padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: C.ink, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.preview}{s.preview.length >= 60 ? "…" : ""}</div>
                <div style={{ fontSize: 10.5, color: C.inkLight }}>{fmtDateShort(s.date)} · {s.messages.filter(m => m.role === "user").length} msgs</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={e => { e.stopPropagation(); onRestore(s.messages); onClose(); }}
                  style={{ background: `${C.accent}14`, border: `1.5px solid ${C.accentBdr}`, color: C.accent, borderRadius: 8, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 700, transition: "all .2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${C.accent}14`; e.currentTarget.style.color = C.accent; }}>
                  Restore
                </button>
                <button onClick={e => { e.stopPropagation(); doDelete(s.id); }}
                  style={{ background: "none", border: `1.5px solid #EAE7F5`, color: C.inkLight, borderRadius: 8, padding: "4px 7px", fontSize: 13, cursor: "pointer", transition: "all .2s", lineHeight: 1 }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.rose; e.currentTarget.style.borderColor = C.rose + "66"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.inkLight; e.currentTarget.style.borderColor = "#EAE7F5"; }}>🗑</button>
                <span style={{ color: C.inkLight, fontSize: 12, transform: expanded === s.id ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-block" }}>▾</span>
              </div>
            </div>
            {expanded === s.id && (
              <div style={{ borderTop: `1px solid #EAE7F5`, padding: "10px 13px", maxHeight: 200, overflowY: "auto", background: C.canvas }}>
                {s.messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 8, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "85%", background: msg.role === "user" ? `linear-gradient(135deg,${C.accent},${C.accentSub})` : C.surface, border: msg.role === "user" ? "none" : `1px solid #EAE7F5`, borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px", padding: "7px 10px" }}>
                      <p style={{ margin: 0, fontSize: 11.5, color: msg.role === "user" ? "#fff" : C.inkMid, lineHeight: 1.5 }}>{msg.content.slice(0, 120)}{msg.content.length > 120 ? "…" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 🏠 HOME SCREEN
// ─────────────────────────────────────────────
const HOME_CARDS = [
  { id: "ai",       icon: IC.brain(26),    label: "AI Solutions",       desc: "Chatbots · Vision · GenAI · Automation", view: "ai",       tooltip: "Explore AI chatbots, computer vision, generative AI & more" },
  { id: "services", icon: IC.gear(26),     label: "Services We Offer",  desc: "Software · Web · Design · Marketing",   view: "services", tooltip: "Custom software, web, mobile, marketing services" },
  { id: "schedule", icon: IC.calendar(26), label: "Schedule a Meeting", desc: "Free 30-min Discovery Meeting",          view: "schedule", tooltip: "Book a free 30-min discovery call with our team" },
  { id: "contact",  icon: IC.phone(26),    label: "Contact Us",         desc: "Call · Email · Office · LinkedIn",       view: "contact",  tooltip: "Call, email or visit Encegen AI Labs" },
];

function HomeScreen({ onSelect }) {
  return (
    <div style={{ paddingBottom: 20, overflowY: "auto", height: "100%" }}>
      {/* Welcome hero */}
      <div style={{
        background: "linear-gradient(135deg, #0D0D2B 0%, #1A0040 35%, #001A30 70%, #0A2010 100%)",
        padding: "14px 16px 16px", color: "#fff",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -20, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
        <div style={{ position: "absolute", bottom: -28, left: 20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, position: "relative" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>Hi! I'm Enci 👋</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>AI Assistant · Encegen AI Labs</div>
          </div>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, opacity: 0.93, margin: "0 0 10px", position: "relative" }}>
          I'm here to help you explore our AI solutions, software services, or connect you with our team.
        </p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", position: "relative" }}>
          {["AI-First", "50+ Projects", "12+ Industries", "5⭐ Rated"].map(t => (
            <span key={t} style={{ fontSize: 10.5, background: "rgba(255,255,255,.18)", borderRadius: 20, padding: "3px 10px", fontWeight: 700, border: "1px solid rgba(255,255,255,.2)" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Menu cards */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 12 }}>How can I help you today?</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
          {HOME_CARDS.map((card, i) => {
            return (
              <div key={card.id} onClick={() => onSelect(card.view)}
                title={card.tooltip}
                onMouseEnter={e => { e.currentTarget.style.background = C.accentPale; e.currentTarget.style.borderColor = C.accentBdr; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = "#EAE7F5"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)"; e.currentTarget.style.transform = "none"; }}
                style={{
                  background: C.surface,
                  border: "1.5px solid #EAE7F5",
                  borderRadius: 14, padding: "10px 10px",
                  cursor: "pointer", transition: "all .22s",
                  boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                  transform: "none",
                  animation: `enciSlide .32s ease ${i * .07}s both`,
                  position: "relative",
                }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentPale, border: `1.5px solid ${C.accentBdr}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, boxShadow: "0 2px 8px rgba(108,47,255,.12)" }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: C.ink, marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 10.5, color: C.inkLight, lineHeight: 1.4 }}>{card.desc}</div>

              </div>
            );
          })}
        </div>


      </div>

    </div>
  );
}

// ─────────────────────────────────────────────
// 🧠 AI SOLUTIONS SCREEN
// ─────────────────────────────────────────────
function AIScreen({ onBack, onChat }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── Fixed header — never scrolls ── */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: `1.5px solid #EAE7F5`, padding: "12px 14px 11px", display: "flex", alignItems: "center", gap: 12 }}>
        <BackBtn onClick={() => onBack("home")} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, display: "flex", alignItems: "center", gap: 7 }}>
            {IC.brain(18)}<span>AI Solutions</span>
          </div>
          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1 }}>Choose an AI topic to explore</div>
        </div>
      </div>
      {/* ── Scrollable cards ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px", minHeight: 0 }}>
        {AI_SUBS.map(s => (
          <SectionCard key={s.id} icon={s.icon} label={s.label} desc={s.desc} badge={s.badge}
            color={C.accent} bg={C.accentPale}
            onClick={() => onChat(s.prompt, s.label, "ai")} />
        ))}

        <Divider label="Not sure which AI fits your need?" />
        <div onClick={() => onChat("I want to explore AI solutions for my business. Ask me what I'm trying to solve, then suggest the best Encegen AI approach.", "Discuss Your AI Needs", "ai")}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.surface, border: `1.5px solid #EAE7F5`, borderRadius: 14, cursor: "pointer", marginTop: 8 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBdr; e.currentTarget.style.background = C.accentPale; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#EAE7F5"; e.currentTarget.style.background = C.surface; }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: C.accentPale, border: `1.5px solid ${C.accentBdr}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(108,47,255,.12)" }}>{IC.chat(22)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>Let's figure it out together</div>
            <div style={{ fontSize: 11.5, color: C.inkLight, marginTop: 1 }}>Tell Enci your goal — we'll suggest the right AI</div>
          </div>
          <span style={{ color: C.accent, fontSize: 13 }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ⚙️ SERVICES SCREEN
// ─────────────────────────────────────────────
function ServicesScreen({ onBack, onChat }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── Fixed header — never scrolls ── */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: `1.5px solid #EAE7F5`, padding: "12px 14px 11px", display: "flex", alignItems: "center", gap: 12 }}>
        <BackBtn onClick={() => onBack("home")} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, display: "flex", alignItems: "center", gap: 7 }}>
            {IC.gear(18)}<span>Services We Offer</span>
          </div>
          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1 }}>Choose a service to learn more</div>
        </div>
      </div>
      {/* ── Scrollable cards ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px", minHeight: 0 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[["50+", "Projects", "#6C2FFF"], ["12+", "Industries", "#6C2FFF"], ["5⭐", "Rating", "#D97706"]].map(([v, l, col]) => (
            <div key={l} style={{ background: C.surface, border: `1.5px solid #EAE7F5`, borderRadius: 13, padding: "10px 8px", textAlign: "center", boxShadow: `0 1px 3px rgba(0,0,0,.04)` }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: col, letterSpacing: -0.5 }}>{v}</div>
              <div style={{ fontSize: 10.5, color: C.inkLight, marginTop: 1, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Select a service</div>
        {SVC_SUBS.map(s => (
          <SectionCard key={s.id} icon={s.icon} label={s.label} desc={s.desc}
            color={C.accent} bg={C.accentPale}
            onClick={() => onChat(s.prompt, s.label, "services")} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const PHONE_RE  = /^\d{10}$/;
const NAME_RE   = /^[a-zA-Z\s'.,-]{2,}$/;
const COMPANY_SUGGESTIONS = [
  "Startup", "Freelancer / Individual", "Small Business (1–50)",
  "Mid-size Company (50–500)", "Enterprise (500+)", "NGO / Non-profit",
  "Government / Public Sector", "Education / Research", "Others",
];

function validateForm(form) {
  const e = {};
  if (!form.name.trim())                            e.name    = "Name is required";
  else if (!NAME_RE.test(form.name.trim()))         e.name    = "Enter a valid full name (letters only)";
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim()))
                                                    e.email   = "Invalid email — use format: name@domain.com";
  if (form.phone.trim() && !PHONE_RE.test(form.phone.replace(/\D/g, "")))
                                                    e.phone   = "Phone must be exactly 10 digits";
  if (!form.email.trim() && !form.phone.trim())     e.contact = "Enter at least email or phone number";
  return e;
}

// ─────────────────────────────────────────────
// CALENDAR POPUP + SCHEDULE SCREEN
// ─────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WDAYS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function CalendarPopup({ onSelect, onClose }) {
  const today = nowIST();
  const [viewYear,  setVY] = useState(today.getFullYear());
  const [viewMonth, setVM] = useState(today.getMonth());

  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  // First day of the displayed month
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  // Days in month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => { if (viewMonth === 0) { setVY(y => y - 1); setVM(11); } else setVM(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setVY(y => y + 1); setVM(0); } else setVM(m => m + 1); };

  const isDisabled = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0,0,0,0);
    const t = new Date(today); t.setHours(0,0,0,0);
    return d < t || !isWorkingDay(d);  // strictly past dates disabled; today allowed
  };

  const isToday = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div ref={ref} style={{
      position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
      background: C.surface, border: `1.5px solid ${C.accentBdr}`,
      borderRadius: 14, padding: "10px 10px", zIndex: 300,
      boxShadow: "0 12px 40px rgba(92,53,232,.18)",
      animation: "enciUp .2s ease",
    }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: C.canvas, border: `1.5px solid #DDD8F4`, borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.inkMid }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: C.canvas, border: `1.5px solid #DDD8F4`, borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.inkMid }}>›</button>
      </div>
      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {WDAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: C.inkLight, padding: "3px 0" }}>{d}</div>)}
      </div>
      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const disabled = isDisabled(day);
          const todayMark = isToday(day);
          return (
            <div key={i} onClick={() => !disabled && onSelect(new Date(viewYear, viewMonth, day))}
              style={{
                textAlign: "center", padding: "7px 2px", borderRadius: 8,
                cursor: disabled ? "not-allowed" : "pointer",
                background: todayMark ? `${C.accent}14` : "transparent",
                border: todayMark ? `1.5px solid ${C.accentBdr}` : "1.5px solid transparent",
                fontSize: 12.5, fontWeight: 600,
                color: disabled ? "#D1CBF0" : C.ink,
                transition: "all .15s",
              }}
              onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = C.accentPale; }}
              onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = todayMark ? `${C.accent}14` : "transparent"; }}>
              {day}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: C.inkLight, textAlign: "center", marginTop: 8 }}>Sundays unavailable · Past time slots are hidden</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 📅 SCHEDULE SCREEN (3-step)
// ─────────────────────────────────────────────
function ScheduleScreen({ onBack }) {
  const [step,       setStep]    = useState("info");
  const [form,       setForm]    = useState({ name: "", email: "", phone: "", project: "", budget: "", deadline: "" });
  const [errors,     setErrors]  = useState({});
  const [selDate,    setSelDate] = useState(null);    // Date object
  const [selTime,    setSelTime] = useState("");       // HH:MM 24h
  const [showCal,    setShowCal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState("");
  const calRef = useRef();

  const ct    = CALL_TYPES[0];
  const ist   = nowIST();
  const inOff = isOfficeHour(ist);
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][ist.getDay()];

  const fmtDateLabel = d => {
    if (!d) return "—";
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const fmtTime12 = t => {
    if (!t) return "—";
    const [hh,mm] = t.split(":").map(Number);
    return `${hh%12||12}:${mm.toString().padStart(2,"0")} ${hh>=12?"PM":"AM"} IST`;
  };

  // Time slots for selected day
  const timeSlots = (() => {
    const slots = [];
    for (let h = OFFICE.open; h < OFFICE.close; h++) {
      slots.push(`${h.toString().padStart(2,"0")}:00`);
      slots.push(`${h.toString().padStart(2,"0")}:30`);
    }
    if (!selDate) return slots;
    const todayStr = ist.toISOString().slice(0,10);
    const selStr   = selDate.toISOString().slice(0,10);
    if (selStr !== todayStr) return slots;
    return slots.filter(t => {
      const [hh,mm] = t.split(":").map(Number);
      const slotD = new Date(selDate); slotD.setHours(hh,mm,0,0);
      return slotD > ist;
    });
  })();

  const stepIdx = { info: 0, slots: 1, done: 2 };
  const STEPS   = ["Your Details", "Pick a Time", "Confirmed"];

  const goToSlots = () => {
    const e = validateForm(form);
    if (Object.keys(e).length) { setErrors(e); } else { setErrors({}); setStep("slots"); }
  };

  const confirmBooking = async () => {
    if (!selDate || !selTime || submitting) return;
    setSubmitting(true);
    setSubmitErr("");
    try {
      await api.createBooking({
        name:       form.name,
        email:      form.email   || null,
        phone:      form.phone   || null,
        project:    form.project || null,
        budget:     form.budget   || null,
        deadline:   form.deadline || null,
        date:       selDate.toISOString().slice(0,10),
        time:       selTime,
        date_label: fmtDateLabel(selDate),
        time_label: fmtTime12(selTime),
      });
      // Backend returned 201 — booking saved. Always go to done screen.
      setStep("done");
    } catch (err) {
      // Network-level failure (backend completely unreachable)
      const msg = err.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
        setSubmitErr(`Cannot reach the server. Please check your internet or email us at ${CO.email}`);
      } else {
        // Any other error from backend — still show success since booking may have saved
        console.error("Booking API error:", err);
        setStep("done");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhone = val => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setForm(p => ({ ...p, phone: digits }));
  };

  return (
<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── Fixed header — Back + title + stepper — never scrolls ── */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: `1.5px solid #EAE7F5`, padding: "10px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <BackBtn onClick={() => { if (step === "info") onBack("home"); else if (step === "slots") setStep("info"); else onBack("home"); }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, display: "flex", alignItems: "center", gap: 7 }}>
            {IC.calendar(18)}<span>Schedule a Meeting</span>
          </div>
          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1 }}>
            {step === "info" ? "Tell us about yourself" : step === "slots" ? "Pick a date & time" : "Meeting confirmed!"}
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {STEPS.map((label, i) => {
          const done   = i < stepIdx[step];
          const active = i === stepIdx[step];
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: done || active ? C.accent : "#E2DFF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, color: done || active ? "#fff" : C.inkLight, flexShrink: 0, transition: "all .3s" }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? C.accent : done ? C.inkMid : C.inkLight, whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 2, background: done ? C.accent : "#E2DFF5", margin: "0 6px", borderRadius: 4, transition: "background .3s" }} />}
            </div>
          );
        })}
      </div>
      </div>{/* end fixed header */}

      {/* ── Scrollable form content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px", minHeight: 0 }}>

      {/* Office status */}
      <div style={{ background: inOff ? C.greenBg : C.amberBg, border: `1px solid ${inOff ? "#A7F3D0" : "#FDE68A"}`, borderRadius: 11, padding: "7px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: inOff ? C.green : C.amber, animation: "enciGreen 2s ease infinite" }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: inOff ? C.green : C.amber, flex: 1 }}>
          {inOff ? "🟢 We're available right now!" : `Office closed — ${dayName}`}
        </div>
        <span style={{ fontSize: 10.5, color: C.inkLight }}>Mon–Sat 10–7 IST</span>
      </div>

      {/* ── STEP 1: Consultation details + form ── */}
      {step === "info" && (
        <>
          {/* Consultation overview */}
          <div style={{ background: `${ct.color}0A`, border: `1.5px solid ${ct.color}33`, borderRadius: 14, padding: "13px 14px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${ct.color}0A`, border: `1.5px solid ${ct.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{ct.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: C.ink }}>{ct.label}</div>
                <div style={{ fontSize: 11, color: C.inkLight }}>30 minutes · Free · No commitment</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 7 }}>What we'll cover:</div>
            {ct.topics.map((topic, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
                <span style={{ color: ct.color, flexShrink: 0, fontSize: 11, marginTop: 2 }}>✓</span>
                <span style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>{topic}</span>
              </div>
            ))}
          </div>

          {/* Name */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.inkMid, display: "block", marginBottom: 4 }}>Your Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Rahul Sharma"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.canvas, border: `1.5px solid ${errors.name ? C.rose : "#DDD8F4"}`, borderRadius: 10, color: C.ink, fontSize: 13, outline: "none", fontFamily: "inherit", transition: "all .2s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.name ? C.rose : "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }} />
            {errors.name && <div style={{ fontSize: 11, color: C.rose, marginTop: 3 }}>⚠ {errors.name}</div>}
          </div>

          {/* Budget */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.inkMid, display: "block", marginBottom: 4 }}>Budget Range <span style={{ fontSize: 10.5, color: C.inkLight, fontWeight: 500 }}>(optional)</span></label>
            <select value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.canvas, border: "1.5px solid #DDD8F4", borderRadius: 10, color: form.budget ? C.ink : C.inkLight, fontSize: 13, outline: "none", fontFamily: "inherit", cursor: "pointer", transition: "all .2s", appearance: "none" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }}>
              <option value="">Select your budget range…</option>
              <option>Under ₹50,000</option>
              <option>₹50,000 – ₹1,00,000</option>
              <option>₹1,00,000 – ₹3,00,000</option>
              <option>₹3,00,000 – ₹5,00,000</option>
              <option>₹5,00,000 – ₹10,00,000</option>
              <option>₹10,00,000+</option>
              <option>Not decided yet</option>
            </select>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.inkMid, display: "block", marginBottom: 4 }}>Email Address</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. rahul@company.com"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.canvas, border: `1.5px solid ${errors.email ? C.rose : "#DDD8F4"}`, borderRadius: 10, color: C.ink, fontSize: 13, outline: "none", fontFamily: "inherit", transition: "all .2s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.email ? C.rose : "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }} />
            {errors.email && <div style={{ fontSize: 11, color: C.rose, marginTop: 3 }}>⚠ {errors.email}</div>}
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.inkMid, display: "block", marginBottom: 4 }}>Phone Number <span style={{ fontSize: 10.5, color: C.inkLight, fontWeight: 500 }}>(10 digits)</span></label>
            <input inputMode="numeric" value={form.phone} onChange={e => handlePhone(e.target.value)} placeholder="e.g. 9876543210 (no country code)"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.canvas, border: `1.5px solid ${errors.phone ? C.rose : "#DDD8F4"}`, borderRadius: 10, color: C.ink, fontSize: 13, outline: "none", fontFamily: "inherit", transition: "all .2s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.phone ? C.rose : "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }} />
            <div style={{ fontSize: 10.5, color: form.phone.length === 10 ? C.green : C.inkLight, marginTop: 3 }}>
              {form.phone.length}/10 digits {form.phone.length === 10 && "✓"}
            </div>
            {errors.phone && <div style={{ fontSize: 11, color: C.rose, marginTop: 1 }}>⚠ {errors.phone}</div>}
          </div>

          {errors.contact && <div style={{ fontSize: 11, color: C.rose, marginBottom: 8 }}>⚠ {errors.contact}</div>}

          {/* Deadline */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.inkMid, display: "block", marginBottom: 4 }}>
              Deadline / Time Limit <span style={{ fontSize: 10.5, color: C.inkLight, fontWeight: 500 }}>(optional)</span>
            </label>
            <select value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.canvas, border: "1.5px solid #DDD8F4", borderRadius: 10, color: form.deadline ? C.ink : C.inkLight, fontSize: 13, outline: "none", fontFamily: "inherit", cursor: "pointer", transition: "all .2s", appearance: "none" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }}>
              <option value="">Select your deadline…</option>
              <option>As soon as possible (ASAP)</option>
              <option>Within 2 weeks</option>
              <option>Within 1 month</option>
              <option>Within 2–3 months</option>
              <option>Within 6 months</option>
              <option>No fixed deadline</option>
              <option>Just exploring for now</option>
            </select>
          </div>

          {/* Project */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.inkMid, display: "block", marginBottom: 4 }}>Project / Requirements <span style={{ fontWeight: 500, color: C.inkLight }}>(optional)</span></label>
            <textarea value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} placeholder="What are you trying to build or solve?" rows={3}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.canvas, border: "1.5px solid #DDD8F4", borderRadius: 10, color: C.ink, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6, transition: "all .2s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>

          <PrimaryBtn fullWidth onClick={goToSlots}>Continue → Pick a Date & Time</PrimaryBtn>
        </>
      )}

      {/* ── STEP 2: Calendar popup + time picker ── */}
      {step === "slots" && (
        <>
          {/* Date selector — triggers calendar popup */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>📆 Select a date</div>
            <div ref={calRef} style={{ position: "relative" }}>
              <div onClick={() => setShowCal(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: C.surface, border: `1.5px solid ${showCal ? C.accent : "#DDD8F4"}`, borderRadius: 12, cursor: "pointer", transition: "all .2s", boxShadow: showCal ? `0 0 0 3px ${C.accent}18` : "none" }}>
                <span style={{ fontSize: 20 }}>📅</span>
                <div style={{ flex: 1 }}>
                  {selDate
                    ? <span style={{ fontWeight: 700, fontSize: 13.5, color: C.ink }}>{fmtDateLabel(selDate)}</span>
                    : <span style={{ fontSize: 13, color: C.inkLight }}>Click to open calendar…</span>}
                </div>
                <span style={{ fontSize: 14, color: C.inkLight, transform: showCal ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-block" }}>▾</span>
              </div>
              {showCal && (
                <CalendarPopup
                  onSelect={d => { setSelDate(d); setSelTime(""); setShowCal(false); }}
                  onClose={() => setShowCal(false)}
                />
              )}
            </div>
          </div>

          {/* Time grid — shows after date selected */}
          {selDate && (
            <div style={{ marginBottom: 14, animation: "enciMsg .2s ease" }}>
              <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>⏰ Select a time slot</div>
              {timeSlots.length === 0
                ? <div style={{ fontSize: 12, color: C.amber, background: C.amberBg, borderRadius: 10, padding: "10px 13px" }}>No slots available for this day. Please pick another date.</div>
                : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                    {timeSlots.map((t, i) => {
                      const isSel = selTime === t;
                      return (
                        <div key={i} onClick={() => setSelTime(t)}
                          onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = C.accentPale; e.currentTarget.style.borderColor = C.accentBdr; e.currentTarget.querySelector("div").style.color = C.accent; } }}
                          onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = "#DDD8F4"; e.currentTarget.querySelector("div").style.color = C.ink; } }}
                          style={{ background: isSel ? C.accent : C.surface, border: `1.5px solid ${isSel ? C.accent : "#DDD8F4"}`, borderRadius: 10, padding: "9px 6px", textAlign: "center", cursor: "pointer", transition: "all .15s", boxShadow: isSel ? `0 3px 10px ${C.shadowSm}` : "none" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? "#fff" : C.ink }}>{fmtTime12(t)}</div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          )}

          {/* Booking summary */}
          {selDate && selTime && (
            <div style={{ background: C.accentPale, border: `1.5px solid ${C.accentBdr}`, borderRadius: 14, padding: "13px 14px", marginBottom: 14, animation: "enciMsg .2s ease" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>📋 Booking Summary</div>
              {[
                ["👤 Name",    form.name],
                ["✉️ Email",   form.email || "—"],
                ["📞 Phone",   form.phone ? `+91 ${form.phone}` : "—"],
                ["💰 Budget",   form.budget   || "—"],
                ["⏱ Deadline", form.deadline || "—"],
                ["📅 Date",    fmtDateLabel(selDate)],
                ["⏰ Time",    fmtTime12(selTime)],
                ["📌 Type",    "Book a Consultation (30 min)"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, color: C.inkLight, minWidth: 72, flexShrink: 0 }}>{k}:</span>
                  <span style={{ fontSize: 11, color: C.ink, fontWeight: 600, flex: 1, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{v}</span>
                </div>
              ))}
              {form.project && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.accentBdr}` }}>
                  <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Project Details</div>
                  <div style={{ fontSize: 11.5, color: C.inkMid, lineHeight: 1.6, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{form.project}</div>
                </div>
              )}
            </div>
          )}

          {!selDate && <div style={{ fontSize: 12, color: C.inkLight, textAlign: "center", padding: "12px 0" }}>Open the calendar above to pick your preferred date</div>}

          {submitErr && <div style={{ fontSize: 11.5, color: C.rose, background: C.roseBg, border: "1px solid #FECACA", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>⚠ {submitErr}</div>}

          <PrimaryBtn fullWidth disabled={!selDate || !selTime || submitting} onClick={confirmBooking}>
            {submitting ? "⏳ Sending…" : "✅ Confirm & Send Meeting Request"}
          </PrimaryBtn>
          <div style={{ fontSize: 10.5, color: C.inkLight, textAlign: "center", marginTop: 7, lineHeight: 1.5 }}>
            Your booking will be sent directly to <strong>sales@encegenailabs.com</strong>
          </div>
        </>
      )}

      {/* ── STEP 3: Confirmation ── */}
      {step === "done" && (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: C.ink, marginBottom: 8 }}>Meeting Request Sent!</div>
          <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.65, marginBottom: 18 }}>
            Your booking has been emailed directly to our team at<br/>
            <strong>{CO.email}</strong> &amp; <strong>{CO.support}</strong><br/>
            <span style={{ fontSize: 12, color: C.inkLight }}>We'll confirm your slot within a few hours.</span>
          </div>
          <div style={{ background: C.accentPale, border: `1.5px solid ${C.accentBdr}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20, textAlign: "left", width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            {[
              ["Name",  form.name],
              ["Date",  fmtDateLabel(selDate)],
              ["Time",  fmtTime12(selTime)],
              ["Type",  "Consultation — 30 min"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start", minWidth: 0 }}>
                <span style={{ fontSize: 11, color: C.inkLight, width: 38, flexShrink: 0 }}>{k}:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, wordBreak: "break-all", overflowWrap: "anywhere", flex: 1, minWidth: 0, maxWidth: "100%" }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onBack("home")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#3949AB", border: "none", color: "#fff", borderRadius: 12, padding: "12px 28px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .2s", boxShadow: "0 3px 14px rgba(57,73,171,.35)", margin: "0 auto" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#303F9F"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3949AB"; e.currentTarget.style.transform = "none"; }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 3L5 8L10 13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Home
          </button>
        </div>
      )}
      </div>{/* end scrollable content */}
    </div>
  );
}


// ─────────────────────────────────────────────
// 📞 CONTACT SCREEN
// ─────────────────────────────────────────────
// 📞 CONTACT SCREEN
// ─────────────────────────────────────────────
function ContactScreen({ onBack }) {
  const PHONE_ITEMS = [
    { icon: IC.phoneSm(20), label: CO.phone1.name, sub: `Business Enquiries — +91 ${CO.phone1.num}` },
    { icon: IC.phoneSm(20), label: CO.phone2.name, sub: `MD & Founder — +91 ${CO.phone2.num}` },
  ];
  const EMAIL_ITEMS = [
    { icon: IC.mail(20), label: "Sales Enquiries", sub: CO.email,   href: `https://mail.google.com/mail/?view=cm&to=${CO.email}` },
    { icon: IC.mail(20), label: "Support",         sub: CO.support, href: `https://mail.google.com/mail/?view=cm&to=${CO.support}` },
  ];
  const ONLINE_ITEMS = [
    { icon: IC.webSm(20), label: "Website",  sub: "encegenailabs.com", href: "https://encegenailabs.com" },
    { icon: IC.linkedin(20), label: "LinkedIn", sub: "Encegen AI Labs",   href: CO.linkedin },
  ];
  const VISIT_ITEMS = [
    { icon: IC.pin(20), label: "Office", sub: CO.address, href: "https://maps.google.com/?q=BA+Hub+Office+No.3+Baif+Road+Wagholi+Pune+412207" },
  ];

  const iconBox = { width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: C.accentPale, border: `1.5px solid ${C.accentBdr}`, boxShadow: "0 2px 8px rgba(108,47,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" };

  const StaticRow = ({ item }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface, border: "1.5px solid #EAE7F5", borderRadius: 13, padding: "10px 14px", marginBottom: 7 }}>
      <div style={iconBox}>{item.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{item.label}</div>
        <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1, wordBreak: "break-word" }}>{item.sub}</div>
      </div>
    </div>
  );

  const LinkRow = ({ item }) => {
    return (
      <a href={item.href}
        target="_blank"
        rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface, border: "1.5px solid #EAE7F5", borderRadius: 13, padding: "10px 14px", marginBottom: 7, textDecoration: "none", transition: "all .2s", cursor: "pointer" }}
        onMouseEnter={e => { e.currentTarget.style.background = C.accentPale; e.currentTarget.style.borderColor = C.accentBdr; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = "#EAE7F5"; e.currentTarget.style.transform = "none"; }}>
        <div style={iconBox}>{item.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{item.label}</div>
          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1, wordBreak: "break-word" }}>{item.sub}</div>
        </div>
      </a>
    );
  };

  const SL = ({ label }) => (
    <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Fixed header */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: `1.5px solid #EAE7F5`, padding: "12px 14px 11px", display: "flex", alignItems: "center", gap: 12 }}>
        <BackBtn onClick={() => onBack("home")} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, display: "flex", alignItems: "center", gap: 7 }}>
            {IC.phoneSm(18)}<span>Contact Us</span>
          </div>
          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1 }}>We'd love to hear from you</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 20px", minHeight: 0 }}>

      <div style={{ marginBottom: 14 }}><SL label="PHONE" />{PHONE_ITEMS.map((it, i) => <StaticRow key={i} item={it} />)}</div>
      <div style={{ marginBottom: 14 }}><SL label="EMAIL" />{EMAIL_ITEMS.map((it, i) => <LinkRow key={i} item={it} />)}</div>
      <div style={{ marginBottom: 14 }}><SL label="ONLINE" />{ONLINE_ITEMS.map((it, i) => <LinkRow key={i} item={it} />)}</div>
      <div style={{ marginBottom: 14 }}><SL label="VISIT" />{VISIT_ITEMS.map((it, i) => <LinkRow key={i} item={it} />)}</div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// 💬 CHAT VIEW
// ─────────────────────────────────────────────
function ChatView({ messages, loading, error, retryMsg, leadSaved,
  bottomRef, lastBotRef, chatTitle, chatSource, onGoBack, onChipSend }) {
  // Determine back destination and label
  const backView  = chatSource === "ai" ? "ai" : chatSource === "services" ? "services" : "home";
  const backLabel = chatSource === "ai" ? "← AI Solutions" : chatSource === "services" ? "← Services" : "← Menu";

  return (
    <>
      {/* Back bar + topic title */}
      <div style={{ background: C.surface, borderBottom: `1.5px solid #EAE7F5`, flexShrink: 0, padding: "8px 13px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => onGoBack(backView)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#EDE7F6", border: "1.5px solid #C5CAE9", color: "#6C2FFF", borderRadius: 10, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .18s", flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = "#EDE8FF"; e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(108,47,255,.22)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#F3EEFF"; e.currentTarget.style.borderColor = "#D4C5FF"; e.currentTarget.style.boxShadow = "none"; }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M9 2L4 7L9 12" stroke="#6C2FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {backLabel}
        </button>
        {chatTitle && (
          <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{chatTitle}</div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "14px 13px", background: C.canvas }}>
        {messages.map((msg, i) => {
          const isLastBot = msg.role === "assistant" && i === messages.map(m => m.role).lastIndexOf("assistant");
          return (
            <div key={i} ref={isLastBot ? lastBotRef : null}>
              <Bubble msg={msg} isLast={i === messages.length - 1} onChipSelect={onChipSend} />
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Avatar size={28} />
            <div style={{ background: C.raised, border: `1.5px solid #EAE7F5`, borderRadius: "4px 18px 18px 18px", padding: "10px 14px" }}><Dots /></div>
          </div>
        )}
        {leadSaved && (
          <div style={{ background: C.greenBg, border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 12px", marginBottom: 8, animation: "enciLeadIn .5s cubic-bezier(.34,1.56,.64,1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: C.green, fontWeight: 700 }}>
              ✅ Details noted! Our team will reach out shortly.
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <a href={`mailto:sales@encegenailabs.com`}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: C.surface, border: `1.5px solid #A7F3D0`, borderRadius: 9, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: C.green, textDecoration: "none", transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#ECFDF5"; e.currentTarget.style.borderColor = C.green; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = "#A7F3D0"; }}>
                ✉️ Email Us
              </a>
              <a href="https://meet.google.com/new" target="_blank" rel="noreferrer"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: C.surface, border: `1.5px solid #A7F3D0`, borderRadius: 9, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#0F766E", textDecoration: "none", transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F0FDFA"; e.currentTarget.style.borderColor = "#0F766E"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = "#A7F3D0"; }}>
                📹 Google Meet
              </a>
            </div>
          </div>
        )}
        {retryMsg && <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.amberBg, border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", marginBottom: 8, fontSize: 12, color: C.amber }}><span>⏳</span>{retryMsg}</div>}
        {error && <div style={{ background: C.roseBg, border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.rose, marginBottom: 8 }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

    </>
  );
}

// ─────────────────────────────────────────────
// PANEL WRAPPER
// ─────────────────────────────────────────────
function Panel({ view, messages, loading, error, retryMsg, leadSaved, input, setInput,
  onSend, onClear, onClose, onViewChange, onChat, onShowHistory,
  inputRef, bottomRef, lastBotRef, chatTitle, chatSource, showEmoji, setShowEmoji }) {
  const height = Math.min(650, SZ.maxH);
  return (
    <div style={{
      position: "fixed", bottom: SZ.panelBottom, right: SZ.right,
      width: SZ.width, height,
      background: C.surface, borderRadius: 22,
      border: "1.5px solid rgba(108,47,255,.25)",
      boxShadow: "0 0 0 1px rgba(0,200,255,.08), 0 24px 64px rgba(108,47,255,.2), 0 4px 20px rgba(0,0,0,.1)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      animation: "enciUp .38s cubic-bezier(.34,1.56,.64,1)",
      zIndex: 9999,
    }}>
      {/* Header */}
      <div style={{ background: C.surface, padding: "11px 14px", borderBottom: "1.5px solid rgba(108,47,255,.15)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar size={36} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#10B981", border: `2px solid ${C.surface}`, animation: "enciGreen 2.5s ease infinite" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: "#111", letterSpacing: -0.4 }}>Encegen</div>
            <span style={{ fontSize: 9, background: "#EEE", color: "#333", borderRadius: 20, padding: "2px 7px", fontWeight: 700, letterSpacing: 0.6 }}>AI LABS</span>
          </div>
          <div style={{ fontSize: 10.5, color: "#222", marginTop: 1, fontWeight: 500 }}>Enci — AI Assistant</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>

          {view !== "home" && (
            <button onClick={() => onViewChange("home")}
              style={{ background: C.canvas, border: `1.5px solid #E2DFF5`, color: C.inkLight, cursor: "pointer", fontSize: 11, padding: "4px 10px", borderRadius: 8, transition: "all .2s", fontFamily: "inherit", fontWeight: 700 }}
              onMouseEnter={e => { e.currentTarget.style.color = C.ink; e.currentTarget.style.borderColor = C.accentBdr; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.inkLight; e.currentTarget.style.borderColor = "#E2DFF5"; }}>
              ⌂ Menu
            </button>
          )}
          {view === "chat" && (
            <button onClick={onClear} title="New chat"
              style={{ background: C.canvas, border: `1.5px solid #E2DFF5`, color: C.inkLight, cursor: "pointer", fontSize: 15, padding: "4px 7px", borderRadius: 8, transition: "all .2s", lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.color = C.ink; e.currentTarget.style.borderColor = C.accentBdr; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.inkLight; e.currentTarget.style.borderColor = "#E2DFF5"; }}>↺</button>
          )}
          <button onClick={onClose}
            style={{ background: C.canvas, border: `1.5px solid #E2DFF5`, color: C.inkLight, cursor: "pointer", fontSize: 18, padding: "3px 7px", borderRadius: 8, transition: "all .2s", lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.color = C.rose; e.currentTarget.style.borderColor = C.rose + "55"; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.inkLight; e.currentTarget.style.borderColor = "#E2DFF5"; }}>×</button>
        </div>
      </div>

      {/* Body — scrollable content */}
      <div style={{ flex: 1, minHeight: 0, background: C.canvas, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "home"     && <HomeScreen    onSelect={onViewChange} />}
        {view === "ai"       && <AIScreen      onBack={onViewChange} onChat={(prompt, title) => onChat(prompt, title, "ai")} />}
        {view === "services" && <ServicesScreen onBack={onViewChange} onChat={(prompt, title) => onChat(prompt, title, "services")} />}
        {view === "schedule" && <ScheduleScreen onBack={onViewChange} />}
        {view === "contact"  && <ContactScreen  onBack={onViewChange} />}
        {view === "chat"     && (
          <ChatView messages={messages} loading={loading} error={error} retryMsg={retryMsg}
            leadSaved={leadSaved} bottomRef={bottomRef} lastBotRef={lastBotRef} chatTitle={chatTitle}
            chatSource={chatSource} onGoBack={onViewChange} onChipSend={onSend} />
        )}
      </div>

      {/* ── GLOBAL FIXED INPUT BAR — shows on all views ── */}
      <div style={{ height: 1.5, background: "#EAE7F5", flexShrink: 0 }} />
      <div style={{ padding: "9px 12px 11px", background: C.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Emoji button — toggles emoji picker */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {showEmoji && (
              <EmojiPicker
                onPick={em => { setInput(p => p + em); setShowEmoji(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                onClose={() => setShowEmoji(false)}
              />
            )}
            <button
              onClick={() => setShowEmoji(p => !p)}
              title="Pick an emoji"
              style={{ width: 34, height: 34, borderRadius: 10, background: showEmoji ? C.accentPale : C.canvas, border: `1.5px solid ${showEmoji ? C.accentBdr : "#DDD8F4"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBdr; e.currentTarget.style.background = C.accentPale; }}
              onMouseLeave={e => { if (!showEmoji) { e.currentTarget.style.borderColor = "#DDD8F4"; e.currentTarget.style.background = C.canvas; } }}>
              😊
            </button>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onSend(); } }}
            onFocus={e => { e.currentTarget.style.borderColor = "#6C2FFF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,47,255,.15), 0 0 8px rgba(0,200,255,.2)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#DDD8F4"; e.currentTarget.style.boxShadow = "none"; }}
            placeholder="Type your message…"
            style={{ flex: 1, padding: "8px 12px", background: C.canvas, border: `1.5px solid #DDD8F4`, borderRadius: 20, color: C.ink, fontSize: 13, outline: "none", fontFamily: "inherit", lineHeight: 1.5, height: 36, transition: "all .2s" }}
          />
          <button onClick={() => onSend()} disabled={loading || !input.trim()}
            style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0, background: loading || !input.trim() ? "#E2DFF5" : "linear-gradient(135deg,#6C2FFF 0%,#00C8FF 100%)", border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: loading || !input.trim() ? C.inkLight : "#fff", transition: "all .2s", boxShadow: loading || !input.trim() ? "none" : `0 3px 10px ${C.shadowSm}` }}>
            {loading ? "…" : "➤"}
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 9, color: C.inkLight, marginTop: 5, letterSpacing: 0.4 }}>Enci by Encegen AI Labs · Powered by Groq ⚡</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT WIDGET
// ─────────────────────────────────────────────
export default function EncegenChatWidget() {
  const [open,       setOpen]      = useState(false);
  const [view,       setView]      = useState("home");
  const [chatTitle,  setChatTitle] = useState("");
  const [chatSource, setChatSrc]   = useState(null);
  const [messages,   setMessages]  = useState([]);
  const [input,      setInput]     = useState("");
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState("");
  const [retryMsg,   setRetryMsg]  = useState("");
  const [tooltip,    setTooltip]   = useState(true);
  const [unread,     setUnread]    = useState(1);
  const [showEmoji,  setShowEmoji] = useState(false);
  const [leadSaved,  setLeadSaved] = useState(false);
  const [showHist,   setShowHist]  = useState(false);

  const leadRef    = useRef(false);
  const anchorRef  = useRef([]);
  const cacheKeyRef = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => { if (open) { setTooltip(false); setUnread(0); } }, [open]);

  // Smart scroll: when a new bot message arrives, scroll its TOP into view so user reads top-down.
  // For user messages and loading state, scroll to bottom as usual.
  const lastBotRef = useRef(null);
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    const count = messages.length;
    const lastMsg = messages[count - 1];
    if (loading) {
      // Scroll to bottom to show typing indicator
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (lastMsg?.role === "assistant" && count > prevMsgCountRef.current) {
      // New bot message — scroll its top into view
      setTimeout(() => lastBotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } else {
      // User message — scroll to bottom
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = count;
  }, [messages, loading]);

  const saveNow = useCallback(() => { if (messages.length) saveHist(messages); }, [messages]);

  const sendMsg = useCallback(async (content, prev, silent = false) => {
    if (!content || loading) return;
    const api_msgs = [...prev, { role: "user", content }];
    if (!silent) setMessages(api_msgs);
    setInput(""); setError(""); setRetryMsg("");

    // ── Local interceptor: handle all casual/personal/off-topic messages instantly ──
    if (!silent) {
      const reply = localReply(content);
      if (reply) {
        const final = [...api_msgs, { role: "assistant", content: reply, chips: [] }];
        setMessages(final);
        if (prev.length === 0) anchorRef.current = final;
        return;
      }
    }

    setLoading(true);
    try {
      const raw = await callChat(api_msgs.map(m => ({ role: m.role, content: m.content })));
      setRetryMsg("");
      const { text, chips } = parseReply(raw);
      const final = silent ? [...prev, { role: "assistant", content: text, chips }] : [...api_msgs, { role: "assistant", content: text, chips }];
      setMessages(final);
      if (cacheKeyRef.current) { CACHE[cacheKeyRef.current] = { text, chips }; cacheKeyRef.current = null; }
      if (prev.length === 0) anchorRef.current = final;
      if (!open) setUnread(u => u + 1);
      if (!leadRef.current) {
        tryDetectLead(final).then(id => {
          if (id && !leadRef.current) { leadRef.current = true; setLeadSaved(true); setTimeout(() => setLeadSaved(false), 5000); }
        });
      }
    } catch (err) {
      setRetryMsg("");
      const msg = err.message || "";
      // Groq TPM rate limit — show friendly message instead of raw error
      if (msg.includes("rate_limit") || msg.includes("Rate limit") || msg.includes("TPM") || msg.includes("tokens per minute") || msg.includes("429")) {
        const waitMatch = msg.match(/try again in ([\d.]+)s/i);
        const secs = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : 15;
        setError(`⏳ I'm getting a lot of messages right now! Please wait ${secs} seconds and try again.`);
      } else {
        setError(`⚠️ Something went wrong. Please try again.`);
      }
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [loading, open]);

  const handleSend = useCallback(ov => {
    const c = (ov ?? input).trim();
    if (!c || loading) return;
    // If not already in chat, switch to chat view first
    if (view !== "chat") {
      setChatTitle("Chat");
      setChatSrc(null);
      setView("chat");
      const api_msgs = [{ role: "user", content: c }];
      setMessages(api_msgs);
      setInput("");

      // Local interceptor for non-chat entry
      const localRep = localReply(c);
      if (localRep) {
        const final = [...api_msgs, { role: "assistant", content: localRep, chips: [] }];
        setMessages(final);
        anchorRef.current = final;
        return;
      }

      setLoading(true); setError(""); setRetryMsg("");
      callChat(api_msgs.map(m => ({ role: m.role, content: m.content })))
        .then(raw => {
          const { text, chips } = parseReply(raw);
          const final = [...api_msgs, { role: "assistant", content: text, chips }];
          setMessages(final);
          anchorRef.current = final;
        })
        .catch(err => {
          const msg = err.message || "";
          if (msg.includes("rate_limit") || msg.includes("Rate limit") || msg.includes("TPM") || msg.includes("tokens per minute") || msg.includes("429")) {
            const waitMatch = msg.match(/try again in ([\d.]+)s/i);
            const secs = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : 15;
            setError(`⏳ I'm getting a lot of messages right now! Please wait ${secs} seconds and try again.`);
          } else {
            setError(`⚠️ Something went wrong. Please try again.`);
          }
        })
        .finally(() => { setLoading(false); setTimeout(() => inputRef.current?.focus(), 80); });
      return;
    }
    sendMsg(c, messages);
  }, [input, loading, messages, sendMsg, view]);

  const handleChat = useCallback((prompt, title, sourceView) => {
    if (messages.length > 0) saveHist(messages);
    setChatTitle(title);
    setChatSrc(sourceView || null);
    setView("chat");
    setMessages([]); setInput(""); leadRef.current = false; anchorRef.current = [];
    const key = prompt.slice(0, 40);
    if (CACHE[key]) {
      const msgs = [{ role: "assistant", content: CACHE[key].text, chips: CACHE[key].chips || [] }];
      setMessages(msgs); anchorRef.current = msgs; return;
    }
    cacheKeyRef.current = key;
    sendMsg(prompt, [], true);
  }, [sendMsg, messages]);

  const handleViewChange = useCallback(target => {
    // Clear chat state when navigating away from chat
    if (target === "home" || target === "ai" || target === "services" || target === "schedule" || target === "contact") {
      saveNow(); setMessages([]); setInput(""); leadRef.current = false; anchorRef.current = [];
      if (target === "home") setChatSrc(null);
    }
    setView(target); setError(""); setRetryMsg("");
    // Focus input after navigation
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [saveNow, inputRef]);

  const handleClear = useCallback(() => {
    setMessages(anchorRef.current); setError(""); setInput(""); setRetryMsg(""); leadRef.current = false;
  }, []);

  const handleClose   = useCallback(() => { saveNow(); setOpen(false); }, [saveNow]);
  const handleRestore = useCallback(msgs => { setView("chat"); setMessages(msgs); anchorRef.current = msgs.slice(0, 1); }, []);

  return (
    <>
      <style>{CSS}</style>

      {open && (
        <div style={{ position: "fixed", bottom: SZ.panelBottom, right: SZ.right, width: SZ.width, zIndex: 9999 }}>
          <Panel view={view} messages={messages} loading={loading} error={error}
            retryMsg={retryMsg} leadSaved={leadSaved} input={input} setInput={setInput}
            onSend={handleSend} onClear={handleClear} onClose={handleClose}
            onViewChange={handleViewChange} onChat={handleChat}
            onShowHistory={() => setShowHist(true)}
            inputRef={inputRef} bottomRef={bottomRef} lastBotRef={lastBotRef} chatTitle={chatTitle} chatSource={chatSource}
            showEmoji={showEmoji} setShowEmoji={setShowEmoji} />
          {showHist && (
            <div style={{ position: "fixed", bottom: SZ.panelBottom, right: SZ.right, width: SZ.width, height: Math.min(650, SZ.maxH), zIndex: 10000, borderRadius: 22, overflow: "hidden", boxShadow: `0 24px 64px ${C.shadowLg}` }}>
              <HistoryPanel onClose={() => setShowHist(false)} onRestore={handleRestore} />
            </div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && !open && (
        <div style={{ position: "fixed", bottom: SZ.panelBottom + 6, right: SZ.right, zIndex: 10000, background: C.surface, color: C.ink, borderRadius: 14, padding: "10px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,.11)", whiteSpace: "nowrap", animation: "enciTooltip .4s cubic-bezier(.34,1.56,.64,1)", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", border: `1.5px solid #E2DFF5` }}>
          👋 Hi! I'm Enci — How can I help?
          <div style={{ position: "absolute", bottom: -7, right: 20, width: 13, height: 13, background: C.surface, transform: "rotate(45deg)", borderRight: `1.5px solid #E2DFF5`, borderBottom: `1.5px solid #E2DFF5` }} />
        </div>
      )}

      {/* Unread badge */}
      {!open && unread > 0 && (
        <div style={{ position: "fixed", bottom: SZ.bottom + SZ.launcher - 4, right: SZ.right - 4, zIndex: 10001, background: "#DC2626", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, boxShadow: "0 2px 8px rgba(220,38,38,.5)", animation: "enciBadge .5s cubic-bezier(.34,1.56,.64,1)" }}>
          {unread}
        </div>
      )}

      {/* Launcher button — animated chatbot icon */}

      {/* Ripple ring 1 — outermost */}
      {!open && (
        <div style={{
          position: "fixed",
          bottom: SZ.bottom - 8,
          right:  SZ.right  - 8,
          width:  SZ.launcher + 16,
          height: SZ.launcher + 16,
          borderRadius: "50%",
          border: "2px solid rgba(108,47,255,.35)",
          zIndex: 9998,
          pointerEvents: "none",
          animation: "enciRipple 2s ease-out infinite",
        }} />
      )}
      {/* Ripple ring 2 — delayed */}
      {!open && (
        <div style={{
          position: "fixed",
          bottom: SZ.bottom - 8,
          right:  SZ.right  - 8,
          width:  SZ.launcher + 16,
          height: SZ.launcher + 16,
          borderRadius: "50%",
          border: "2px solid rgba(0,200,255,.25)",
          zIndex: 9998,
          pointerEvents: "none",
          animation: "enciRipple 2s ease-out .7s infinite",
        }} />
      )}
      {/* Ripple ring 3 — most delayed */}
      {!open && (
        <div style={{
          position: "fixed",
          bottom: SZ.bottom - 8,
          right:  SZ.right  - 8,
          width:  SZ.launcher + 16,
          height: SZ.launcher + 16,
          borderRadius: "50%",
          border: "2px solid rgba(108,47,255,.18)",
          zIndex: 9998,
          pointerEvents: "none",
          animation: "enciRipple 2s ease-out 1.4s infinite",
        }} />
      )}

      <button onClick={() => setOpen(p => !p)}
        style={{
          position: "fixed", bottom: SZ.bottom, right: SZ.right,
          zIndex: 10000, width: SZ.launcher, height: SZ.launcher,
          borderRadius: "50%",
          background: open
            ? "#F8F9FF"
            : "linear-gradient(135deg, #6C2FFF 0%, #A855F7 50%, #00C8FF 100%)",
          border: open ? "1.5px solid #DDD8F4" : "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: open
            ? "0 2px 12px rgba(108,47,255,.15)"
            : "0 4px 20px rgba(108,47,255,.5), 0 2px 10px rgba(0,200,255,.3)",
          transition: "all .35s cubic-bezier(.34,1.56,.64,1)",
          transform: open ? "scale(.88) rotate(90deg)" : "scale(1)",
          animation: !open ? "enciBob 3s ease-in-out infinite, enciGradRot 4s ease infinite" : "none",
          padding: 0,
          outline: "none",
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(108,47,255,.65), 0 3px 14px rgba(0,200,255,.4)"; }}}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(108,47,255,.5), 0 2px 10px rgba(0,200,255,.3)"; }}}>
        {open
          ? <span style={{ fontSize: 22, color: C.ink, lineHeight: 1, animation: "enciCloseSpin .35s cubic-bezier(.34,1.56,.64,1)" }}>✕</span>
          : (
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none"
              style={{ animation: "enciSpinIn .5s cubic-bezier(.34,1.56,.64,1)" }}
              xmlns="http://www.w3.org/2000/svg">
              {/* Chat bubble body */}
              <path d="M6 4C4.9 4 4 4.9 4 6V20C4 21.1 4.9 22 6 22H12L16 27L20 22H26C27.1 22 28 21.1 28 20V6C28 4.9 27.1 4 26 4H6Z"
                fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.95)" strokeWidth="1.4" strokeLinejoin="round"/>
              {/* Bot eyes — blink animation */}
              <g style={{ animation: "enciBlink 3.5s ease-in-out infinite", transformOrigin: "11px 13px" }}>
                <circle cx="11" cy="13" r="2.2" fill="white"/>
              </g>
              <g style={{ animation: "enciBlink 3.5s ease-in-out 0.1s infinite", transformOrigin: "21px 13px" }}>
                <circle cx="21" cy="13" r="2.2" fill="white"/>
              </g>
              {/* Pupils — move around */}
              <g style={{ animation: "enciEyeMove 4s ease-in-out infinite" }}>
                <circle cx="11.8" cy="12.3" r="0.9" fill="rgba(108,47,255,0.95)"/>
                <circle cx="21.8" cy="12.3" r="0.9" fill="rgba(108,47,255,0.95)"/>
              </g>
              {/* Bot smile */}
              <path d="M11.5 17C11.5 17 13 18.5 16 18.5C19 18.5 20.5 17 20.5 17"
                stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              {/* Antenna */}
              <line x1="16" y1="4" x2="16" y2="2" stroke="rgba(255,255,255,0.95)" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="16" cy="1.5" r="1.3" fill="white"/>
            </svg>
          )
        }
      </button>
    </>
  );
}

// ─────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  /* ════════════════════════════════════════════
     PANEL ANIMATIONS
  ════════════════════════════════════════════ */

  /* Panel open — spring bounce up */
  @keyframes enciUp {
    0%   { opacity:0; transform:translateY(28px) scale(.90); }
    60%  { opacity:1; transform:translateY(-6px) scale(1.02); }
    80%  { transform:translateY(3px) scale(.99); }
    100% { transform:translateY(0)   scale(1);   }
  }

  /* Chat message pop in */
  @keyframes enciMsg {
    0%   { opacity:0; transform:translateY(10px) scale(.94); }
    70%  { opacity:1; transform:translateY(-2px) scale(1.02); }
    100% { opacity:1; transform:translateY(0)    scale(1);    }
  }

  /* Card slide in from left */
  @keyframes enciSlide {
    0%   { opacity:0; transform:translateX(-16px) scale(.97); }
    70%  { opacity:1; transform:translateX(2px)   scale(1.01); }
    100% { opacity:1; transform:translateX(0)     scale(1);    }
  }

  /* ════════════════════════════════════════════
     TYPING INDICATOR
  ════════════════════════════════════════════ */

  /* Typing dot bounce */
  @keyframes enciDot {
    0%,60%,100% { transform:translateY(0);    opacity:.35; }
    30%         { transform:translateY(-7px); opacity:1;   }
  }

  /* ════════════════════════════════════════════
     LAUNCHER BUTTON ANIMATIONS
  ════════════════════════════════════════════ */

  /* Gentle float up-down */
  @keyframes enciBob {
    0%,100% { transform: translateY(0)    scale(1);    }
    25%     { transform: translateY(-5px) scale(1.05); }
    50%     { transform: translateY(-3px) scale(1.02); }
    75%     { transform: translateY(-6px) scale(1.04); }
  }

  /* Gradient hue shift — makes button feel alive */
  @keyframes enciGradRot {
    0%   { filter: hue-rotate(0deg)  brightness(1)   saturate(1);   }
    33%  { filter: hue-rotate(20deg) brightness(1.1) saturate(1.2); }
    66%  { filter: hue-rotate(-15deg) brightness(1.05) saturate(1.1); }
    100% { filter: hue-rotate(0deg)  brightness(1)   saturate(1);   }
  }

  /* Spin-in when button first appears */
  @keyframes enciSpinIn {
    0%   { opacity:0; transform: rotate(-200deg) scale(0.3); }
    60%  { opacity:1; transform: rotate(15deg)   scale(1.1); }
    80%  { transform: rotate(-5deg) scale(.97); }
    100% { opacity:1; transform: rotate(0deg)    scale(1);   }
  }

  /* Close icon spin in */
  @keyframes enciCloseSpin {
    from { opacity:0; transform: rotate(120deg) scale(0.4); }
    to   { opacity:1; transform: rotate(0deg)   scale(1);   }
  }

  /* Pulse glow — idle launcher */
  @keyframes enciPulse {
    0%   { box-shadow: 0 0 0 0    rgba(108,47,255,.6),
                       0 4px 20px rgba(108,47,255,.45); }
    50%  { box-shadow: 0 0 0 14px rgba(108,47,255,.0),
                       0 4px 26px rgba(108,47,255,.55); }
    100% { box-shadow: 0 0 0 0    rgba(108,47,255,.0),
                       0 4px 20px rgba(108,47,255,.45); }
  }

  /* ════════════════════════════════════════════
     RIPPLE RINGS
  ════════════════════════════════════════════ */
  @keyframes enciRipple {
    0%   { transform:scale(1);    opacity:.55; }
    60%  { transform:scale(1.55); opacity:.2;  }
    100% { transform:scale(2.1);  opacity:0;   }
  }

  /* ════════════════════════════════════════════
     BOT ICON ANIMATIONS (eyes blink)
  ════════════════════════════════════════════ */
  @keyframes enciBlink {
    0%,90%,100% { transform: scaleY(1);   }
    95%         { transform: scaleY(0.1); }
  }

  @keyframes enciEyeMove {
    0%,70%,100% { transform: translate(0, 0);     }
    40%         { transform: translate(1px, -1px); }
    55%         { transform: translate(-1px, 0);   }
  }

  /* ════════════════════════════════════════════
     STATUS & MISC
  ════════════════════════════════════════════ */

  /* Online dot pulse */
  @keyframes enciGreen {
    0%,100% { opacity:1;  transform:scale(1);    box-shadow:0 0 0 0 rgba(16,185,129,.5); }
    50%     { opacity:.7; transform:scale(1.2);  box-shadow:0 0 0 4px rgba(16,185,129,0); }
  }

  /* Tooltip slide in */
  @keyframes enciTooltip {
    0%   { opacity:0; transform:translateX(16px) scale(.92); }
    70%  { opacity:1; transform:translateX(-2px) scale(1.01); }
    100% { opacity:1; transform:translateX(0)    scale(1);    }
  }

  /* Unread badge bounce */
  @keyframes enciBadge {
    0%,100% { transform:scale(1);    }
    20%     { transform:scale(1.4);  }
    40%     { transform:scale(.85);  }
    60%     { transform:scale(1.15); }
    80%     { transform:scale(.95);  }
  }

  /* Lead saved confirmation */
  @keyframes enciLeadIn {
    0%   { opacity:0; transform:translateY(12px) scale(.9); }
    60%  { opacity:1; transform:translateY(-3px) scale(1.03); }
    100% { opacity:1; transform:translateY(0)    scale(1);    }
  }

  /* Panel hero shimmer */
  @keyframes enciShimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }

  /* Panel border glow */
  @keyframes enciGlow {
    0%,100% { box-shadow: 0 0 0 1px rgba(0,200,255,.08),
                          0 24px 64px rgba(108,47,255,.2),
                          0 4px 20px rgba(0,0,0,.1); }
    50%     { box-shadow: 0 0 0 1px rgba(0,200,255,.16),
                          0 24px 64px rgba(108,47,255,.28),
                          0 4px 20px rgba(0,0,0,.1); }
  }
`;