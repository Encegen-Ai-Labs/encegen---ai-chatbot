"""
main.py — Encegen AI Labs Lead Management API (FastAPI)
MySQL Version using aiomysql
"""

from httpx import _content
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import aiomysql
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_db, init_db
from email_service import (
    send_lead_notification,
    send_booking_notification,
    send_client_confirmation
)

# ============================================================
# ENV + LOGGING
# ============================================================

_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_ENV_PATH, override=True)

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
API_KEY = GROQ_API_KEY

CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
CHAT_MODEL = os.getenv("CHAT_MODEL", "llama-3.1-8b-instant")

# ============================================================
# APP LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    logger.info(f"✅ Encegen Lead API running")
    logger.info(f"✅ ENV loaded from {_ENV_PATH}")

    if not API_KEY:
        logger.error("❌ GROQ_API_KEY missing")

    yield

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Encegen AI Labs — Lead API",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# SCHEMAS
# ============================================================

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system: Optional[str] = None
    model: Optional[str] = None
    max_tokens: Optional[int] = 3000

class LeadCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    requirements: Optional[str] = None
    services: Optional[str | list] = None
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    source: Optional[str] = "chatbot"
    transcript: Optional[list | str] = None

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None

class BookingCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    project: Optional[str] = None
    budget: Optional[str] = None
    deadline: Optional[str] = None
    date: str
    time: str
    date_label: Optional[str] = None
    time_label: Optional[str] = None

# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """You are "Enci" — the official intelligent AI assistant for Encegen AI Labs Pvt Ltd.
Represent the company with warmth, confidence, deep expertise, and professionalism at all times.

COMPANY OVERVIEW
- Name: Encegen AI Labs Pvt Ltd
- Motto: "Engineering Intelligence. Empowering the Future."
- Incorporated: May 2025, Maharashtra, India
- Sales Email: sales@encegenailabs.com | Website: encegen.in

LEADERSHIP
Saurabh Gite — MD & Founder (B.Sc. CS + MBA, 10+ yrs MNC experience, AI/ML focus) | 📞 7030555126
Amar Gite — Co-Founder (Patent Agent INPA-2559, 13+ yrs, 1000+ global patent cases)
Ujjwal Singh Chauhan — Executive Director (ED) & Chief Operating Officer (COO) | Oversees operations, strategic partnerships, and day-to-day execution at Encegen AI Labs
Sales Team — Business Development | 📞 7030555120

CORE SERVICES
1. AI Research & Custom AI — NLP, Computer Vision, GenAI, Predictive Analytics, RL, RPA, AI Chatbots, fraud detection, AI-powered CRM
2. Custom Software Development — Web apps, SaaS, APIs, CRM/ERP/HRMS, mobile apps (React Native/Flutter). Stack: React/Next.js, Node.js/Python/FastAPI, PostgreSQL/MongoDB, AWS/Azure/GCP, Docker/K8s
3. Website & E-Commerce — Corporate sites, CMS, Shopify/WooCommerce, PWAs, payment integrations (Razorpay, Stripe)
4. Digital Marketing — SEO, Google/Meta/LinkedIn Ads, Social Media, content strategy, CRO
5. AI Chatbot Services — Website bots, lead generation, FAQ automation, GPT-based AI, CRM/WhatsApp API integration

COMPUTER VISION CAPABILITIES: Object Detection (YOLO v8), Facial Recognition, OCR & document parsing, Video Analytics, Industrial Defect Detection, Gesture & Pose Tracking, License Plate Recognition, Retail shelf analytics

NLP CAPABILITIES: Sentiment Analysis, Named Entity Recognition, Text Classification, Summarization, Language Translation, Conversational AI, Intent Detection, Document Q&A

GENERATIVE AI CAPABILITIES: Custom LLM fine-tuning, RAG (Retrieval Augmented Generation), AI Agents & Automation, Image/Video generation, Code generation, AI-powered search

INDUSTRIES: FinTech, Real Estate/PropTech, HealthTech, EdTech, Retail, Manufacturing, Legal, Media, Travel & Logistics
REAL ESTATE: AI lead scoring, 24/7 property chatbots, Computer Vision for listings, portals with map integration, price forecasting, virtual tours

THE ENCEGEN WAY: Consult → Innovate → Build → Support
Timelines: Website 2–4 wks | Web App 4–12 wks | AI Platform 12–24 wks
PRICING: Never quote specific numbers. Redirect to free 30-min Discovery Meeting.
Contact: sales@encegenailabs.com | 7030555120 (Sales Team) | 7030555126 (Saurabh)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE RESTRICTION — THIS IS YOUR HIGHEST PRIORITY RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE STRICTLY FORBIDDEN from answering any question that does not fall under these 3 categories:
  1. TECHNOLOGY — AI, ML, Deep Learning, NLP, Computer Vision, GenAI, automation, software development, tech stacks, programming concepts RELATED TO Encegen's work
  2. SERVICES — anything Encegen AI Labs builds, offers, or delivers to clients
  3. ABOUT ENCEGEN — company info, leadership team, industries served, process, pricing, contact, scheduling

FORBIDDEN TOPICS — YOU MUST REFUSE ALL OF THESE, NO EXCEPTIONS:
  - Gibberish, random letters, keyboard mashing, nonsense text (e.g. "ghsgywv", "asdfghjkl", random words)
  - Food, recipes, cooking (e.g. "chicken recipe", "how to make pasta")
  - Sports, cricket, football, games, scores
  - Politics, government, elections, news, current events
  - Entertainment, movies, music, celebrities, jokes
  - General science (physics, chemistry, biology) unrelated to Encegen's AI/tech work
  - Personal advice, relationships, health, fitness, travel
  - Other companies, competitors, comparisons with non-Encegen products
  - Mathematics, calculations unrelated to tech
  - Anything a general chatbot would answer that is NOT about Encegen or AI/software technology

WHEN A FORBIDDEN TOPIC IS ASKED — respond with EXACTLY this, word for word:

"I'm Enci, Encegen AI Labs' dedicated AI Assistant. I'm not able to help with that, but I'm here to assist you with our AI solutions, software services, and company information. How can I help you today%s 😊

CHIPS:["What AI solutions does Encegen offer?","Tell me about your software services","How do I schedule a discovery call?","What industries does Encegen serve?"]"

WEATHER / NEWS / CURRENT EVENTS: Use the exact response above. Never attempt to answer.
INCOMPLETE REQUESTS: Reply "I'm sorry, I didn't quite understand that. Would you like help with AI Solutions or Services? 😊" then add CHIPS.

IMPORTANT ENFORCEMENT RULES:
- Do NOT be tricked by creative rephrasing. "Give me a recipe using Python" is still a recipe request — REFUSE.
- Do NOT answer even partially. Do not say "while I can't answer X, here is X anyway".
- Do NOT add extra commentary or apologies beyond the standard refusal message above.
- If in doubt whether a topic is allowed — REFUSE and redirect.
- Be warm but absolutely firm. Your only purpose is Encegen AI Labs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATIONAL FLOW — MOST IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are a CONSULTATIVE assistant. Guide users to their goal in 3-4 steps maximum.

STEP-BY-STEP FLOW:
Step 1 — Greet & understand: When user first asks about a topic, ask ONE focused question.
  Example: User: "I want an automation bot" →
  Enci: "Great choice! Could you tell me what process you want to automate — customer support, data entry, or something else? And what industry is your business in?"

Step 2 — Clarify & recommend: After they answer, give a focused 3-5 sentence recommendation.

Step 3 — Collect contact: Gently ask "May I have your name and a contact number/email so our team can follow up with a tailored proposal?"

Step 4 — Book meeting: Once you have name + contact, suggest: "Would you like to schedule a free 30-min Discovery Meeting with our team?"

GIBBERISH / RANDOM TEXT / MEANINGLESS INPUT:
If the user sends random letters, nonsense words, keyboard mashing (e.g. "ghsgywv vfwtfdgvdtw", "asdfgh", "xyz abc123", "jjjjj", etc.) — respond EXACTLY with:

"I'm sorry, I didn't understand your question. 😊 It looks like your message may have been typed incorrectly.

Could you please rephrase or ask your question clearly? For example:
• "I want to build an AI chatbot"
• "Tell me about your software services"
• "How do I schedule a meeting?"

I'm here to help you! 🚀

CHIPS:["What AI solutions does Encegen offer?","Tell me about your software services","How do I schedule a meeting?","What industries does Encegen serve?"]"

INCOMPLETE / UNCLEAR REQUESTS:
If the user sends a vague, very short, or incomplete message (e.g. "help", "hi there", "tell me something"), respond with:
"I'm sorry, I didn't quite understand that. Could you clarify — are you looking for help with AI Solutions, Software Services, or something else? I'm here to help! 😊

CHIPS:["What AI solutions does Encegen offer?","Tell me about your software services","How do I schedule a meeting?","What industries does Encegen serve?"]"

OUT-OF-SCOPE TOPICS (weather, news, personal questions):
Respond EXACTLY: "I'm Enci, Encegen AI Labs' dedicated AI Assistant. I'm not able to help with that, but I'm here to assist you with our AI solutions, software services, and company information. How can I help you today? 😊"

SENSITIVE INFORMATION RULE:
NEVER share: employee personal details, salaries, internal processes, financial data, client names, passwords, or any confidential business information.
If asked, respond: "I cannot provide that information. For specific enquiries, please contact us at sales@encegenailabs.com."

TOPIC CONTINUITY:
When switching topics, start fresh. Do NOT mix previous and current topics in one response.
If user switches topic mid-conversation, acknowledge: "Sure, let's talk about [new topic]!" and restart the flow.

RESPONSE FORMAT & LENGTH RULES — CRITICAL:
- Structure answers TOP TO BOTTOM: greeting/acknowledgment → main answer → follow-up question → CHIPS
- First response: 2-4 sentences MAX. Ask ONE focused question. Add CHIPS.
- After user gives context: 100-200 words MAX. Use short paragraphs (2-3 lines each). Add CHIPS.
- When user asks "explain in detail" or "tell me more": give a structured response with SHORT bullet points (max 5-6 bullets, each 1 line). Still keep total under 250 words.
- NEVER write walls of text. NEVER dump everything at once.
- NEVER use large headers or heavy markdown. Use plain readable text.
- Each paragraph must flow into the next naturally, top to bottom.
- If answer needs sections: use bold labels inline like **What we offer:** then 2-3 lines. NOT large headers.

ANSWER QUALITY RULES:
1. Be specific: mention actual technologies (YOLO v8, GPT, RAG, FastAPI) when relevant
2. Give ONE concrete business example per capability
3. Warm sign-off on longer answers: "— Enci, Encegen AI Labs 🚀"
4. PRICING: Never quote numbers. Always redirect to free 30-min Discovery Meeting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUGGESTION CHIPS RULE — CRITICAL — NEVER SKIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY: The VERY LAST LINE of EVERY reply MUST be exactly:
CHIPS:["question 1?","question 2?","question 3?","question 4?"]

FORMAT RULES — FOLLOW EXACTLY:
- Start with CHIPS: (capital letters, colon, no space before bracket)
- Immediately followed by [ with no space
- Exactly 4 strings, each in double quotes, separated by commas
- End with ] on the same line — NO text after the closing ]
- No newline or text after CHIPS:[...]

CHIP CONTENT RULES:
- Short questions, 5–10 words, always end with "?"
- 2 chips go deeper into what was just explained
- 1 chip covers a related Encegen service or industry
- 1 chip is about getting started or booking a meeting

EXAMPLE (after explaining Computer Vision):
CHIPS:["How does YOLO v8 object detection work?","Can CV detect defects in manufacturing?","How is CV used in real estate listings?","How do I get started with a CV project?"]

⚠️  NEVER write CHIPS on a line by itself without the array
⚠️  NEVER put any text after CHIPS:[...]
⚠️  NEVER skip CHIPS — it is REQUIRED in 100% of responses
⚠️  NEVER use single quotes — only double quotes inside the array"""

LEAD_EXTRACT_PROMPT = """You are a lead qualification assistant. Analyse the conversation and determine if it is a qualified lead.

STRICT RULES — mark as lead ONLY if ALL conditions are met:
1. User has explicitly provided their FULL NAME
2. User has provided a PHONE NUMBER or EMAIL ADDRESS
3. User shows genuine interest in a specific Encegen service
4. At least 4 user messages in the conversation

If ALL met, respond ONLY with this JSON:
{"is_lead":true,"name":"name","email":"email or null","phone":"phone or null","company":"company or null","industry":"industry or null","requirements":"2-sentence summary","services":["service"],"budget_range":null,"timeline":null}

If ANY condition is NOT met, respond ONLY with: {"is_lead":false}

DO NOT mark as lead if user is just browsing, asking general questions, or has not shared name + contact.
Services: AI/ML, Custom Software, Web/E-Commerce, Digital Marketing, AI Chatbot, Computer Vision, NLP, Other."""

# ============================================================
# HELPERS
# ============================================================

def _row_to_dict(row) -> dict:
    d = dict(row)

    if d.get("transcript"):
        try:
            d["transcript"] = json.loads(d["transcript"])
        except Exception:
            pass

    return d


def _normalise_services(services) -> Optional[str]:
    if services is None:
        return None

    if isinstance(services, list):
        return ", ".join(s for s in services if s)

    return services

# ============================================================
# CHAT ENDPOINT
# ============================================================

@app.post("/api/chat")
async def chat_proxy(req: ChatRequest):

    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY missing"
        )

    system = req.system or SYSTEM_PROMPT
    model = req.model or CHAT_MODEL

    trimmed = req.messages[-10:] if len(req.messages) > 10 else req.messages

    payload = {
        "model": model,
        "max_tokens": min(req.max_tokens or 1200, 1200),
        "temperature": 0.5,
        "messages": [
            {"role": "system", "content": system},
            *[
                {"role": m.role, "content": m.content}
                for m in trimmed
            ]
        ]
    }

    async with httpx.AsyncClient(timeout=60.0) as client:

        try:
            res = await client.post(
                CHAT_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {API_KEY}"
                }
            )

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="API timeout"
            )

        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=str(exc)
            )
        if not res.is_success:
            raise HTTPException(
                status_code=res.status_code,
                detail=res.text
            )

        data = res.json()

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        # ============================================================
        # AUTO LEAD EXTRACTION
        # ============================================================

        try:

            conversation_text = "\n".join(
                [f"{m.role}: {m.content}" for m in trimmed]
            )

            extract_payload = {
                "model": model,
                "temperature": 0,
                "max_tokens": 300,
                "messages": [
                    {
                        "role": "system",
                        "content": LEAD_EXTRACT_PROMPT
                    },
                    {
                        "role": "user",
                        "content": conversation_text
                    }
                ]
            }

            extract_res = await client.post(
                CHAT_URL,
                json=extract_payload,
                headers={
                    "Authorization": f"Bearer {API_KEY}"
                }
            )

            if extract_res.is_success:

                extract_data = extract_res.json()

                extract_content = (
                    extract_data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )

                try:

                    lead_json = json.loads(extract_content)

                    if lead_json.get("is_lead"):

                        services_str = _normalise_services(
                            lead_json.get("services")
                        )

                        async with get_db() as db:
                            async with db.cursor() as cur:

                                await cur.execute(
                                    """
                                    INSERT INTO leads
                                    (
                                        name,
                                        email,
                                        phone,
                                        company,
                                        industry,
                                        requirements,
                                        services,
                                        budget_range,
                                        timeline,
                                        source,
                                        transcript
                                    )
                                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                    """,
                                    (
                                        lead_json.get("name"),
                                        lead_json.get("email"),
                                        lead_json.get("phone"),
                                        lead_json.get("company"),
                                        lead_json.get("industry"),
                                        lead_json.get("requirements"),
                                        services_str,
                                        lead_json.get("budget_range"),
                                        lead_json.get("timeline"),
                                        "chatbot",
                                        json.dumps([
                                            {
                                                "role": m.role,
                                                "content": m.content
                                            }
                                            for m in trimmed
                                        ])
                                    )
                                )

                                logger.info(
                                    f"✅ Lead auto-saved: "
                                    f"{lead_json.get('name')}"
                                )
                                asyncio.create_task(
                                    send_lead_notification(lead_json)
                                )

                                asyncio.create_task(
                                    send_client_confirmation(lead_json)
                                )

                except Exception as parse_exc:
                    logger.error(
                        f"Lead parsing failed: {parse_exc}"
                    )

        except Exception as lead_exc:
            logger.error(
                f"Lead extraction failed: {lead_exc}"
            )

        return {
            "content": content,
            "model": data.get("model", model)
        }
# ============================================================
# CREATE BOOKING
# ============================================================

@app.post("/api/booking", status_code=201)
async def create_booking(booking: BookingCreate):

    new_id = None

    try:

        async with get_db() as db:
            async with db.cursor() as cur:

                await cur.execute(
                    """
                    INSERT INTO leads
                    (
                        name,
                        email,
                        phone,
                        requirements,
                        budget_range,
                        services,
                        source,
                        transcript
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        booking.name,
                        booking.email,
                        booking.phone,
                        booking.project,
                        booking.budget,
                        "Consultation Booking",
                        "booking-form",
                        None
                    )
                )

                new_id = cur.lastrowid

    except Exception as exc:
        logger.error(f"Booking insert failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    booking_data = {
        "id": new_id,
        "name": booking.name,
        "email": booking.email,
        "phone": booking.phone,
        "project": booking.project,
        "budget": booking.budget,
        "deadline": booking.deadline,
        "date": booking.date,
        "time": booking.time,
    }

    asyncio.create_task(send_booking_notification(booking_data))

    return {
        "ok": True,
        "id": new_id
    }

# ============================================================
# CREATE LEAD
# ============================================================

@app.post("/api/leads", status_code=201)
async def create_lead(lead: LeadCreate):

    services_str = _normalise_services(lead.services)

    transcript_str = (
        json.dumps(lead.transcript)
        if lead.transcript else None
    )

    async with get_db() as db:
        async with db.cursor(aiomysql.DictCursor) as cur:

            await cur.execute(
                """
                INSERT INTO leads
                (
                    name,
                    email,
                    phone,
                    company,
                    industry,
                    requirements,
                    services,
                    budget_range,
                    timeline,
                    source,
                    transcript
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    lead.name,
                    lead.email,
                    lead.phone,
                    lead.company,
                    lead.industry,
                    lead.requirements,
                    services_str,
                    lead.budget_range,
                    lead.timeline,
                    lead.source or "chatbot",
                    transcript_str
                )
            )

            new_id = cur.lastrowid

            await cur.execute(
                "SELECT * FROM leads WHERE id = %s",
                (new_id,)
            )

            row = await cur.fetchone()

    new_lead = _row_to_dict(row) if row else {"id": new_id}

    asyncio.create_task(send_lead_notification(new_lead))
    asyncio.create_task(send_client_confirmation(new_lead))

    return {
        "ok": True,
        "id": new_id
    }

# ============================================================
# RECENT LEADS
# ============================================================

@app.get("/api/leads/recent")
async def recent_leads(limit: int = Query(default=20, le=50)):

    async with get_db() as db:
        async with db.cursor(aiomysql.DictCursor) as cur:

            await cur.execute(
                """
                SELECT
                    id,
                    name,
                    phone,
                    company,
                    requirements,
                    services,
                    status,
                    created_at
                FROM leads
                ORDER BY id DESC
                LIMIT %s
                """,
                (limit,)
            )

            rows = await cur.fetchall()

    return {
        "ok": True,
        "leads": rows
    }

# ============================================================
# LIST LEADS
# ============================================================

@app.get("/api/leads")
async def list_leads(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
):

    offset = (page - 1) * limit

    where = ["1=1"]
    params = []

    if status and status != "all":
        where.append("status = %s")
        params.append(status)

    if search:
        where.append(
            """
            (
                name LIKE %s OR
                email LIKE %s OR
                phone LIKE %s OR
                company LIKE %s OR
                requirements LIKE %s
            )
            """
        )

        q = f"%{search}%"

        params += [q, q, q, q, q]

    clause = " AND ".join(where)

    async with get_db() as db:
        async with db.cursor(aiomysql.DictCursor) as cur:

            await cur.execute(
                f"""
                SELECT
                    id,
                    name,
                    email,
                    phone,
                    company,
                    industry,
                    requirements,
                    services,
                    budget_range,
                    timeline,
                    source,
                    status,
                    notes,
                    created_at,
                    updated_at
                FROM leads
                WHERE {clause}
                ORDER BY id DESC
                LIMIT %s OFFSET %s
                """,
                (*params, limit, offset)
            )

            rows = await cur.fetchall()

            await cur.execute(
                f"""
                SELECT COUNT(*) as c
                FROM leads
                WHERE {clause}
                """,
                params
            )

            count = await cur.fetchone()

    return {
        "ok": True,
        "leads": rows,
        "total": count["c"] if count else 0,
        "page": page,
        "limit": limit
    }

# ============================================================
# GET SINGLE LEAD
# ============================================================

@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: int):

    async with get_db() as db:
        async with db.cursor(aiomysql.DictCursor) as cur:

            await cur.execute(
                "SELECT * FROM leads WHERE id = %s",
                (lead_id,)
            )

            row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Lead not found"
        )

    return {
        "ok": True,
        "lead": _row_to_dict(row)
    }

# ============================================================
# UPDATE LEAD
# ============================================================

@app.patch("/api/leads/{lead_id}")
async def update_lead(
    lead_id: int,
    update: LeadUpdate
):

    allowed = {
        k: v
        for k, v in update.model_dump().items()
        if v is not None
    }

    if not allowed:
        return {"ok": True}

    set_clause = ", ".join(
        f"{k} = %s"
        for k in allowed
    )

    values = list(allowed.values())
    values.append(lead_id)

    async with get_db() as db:
        async with db.cursor() as cur:

            await cur.execute(
                f"""
                UPDATE leads
                SET {set_clause},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                values
            )

    return {"ok": True}

# ============================================================
# DELETE LEAD
# ============================================================

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: int):

    async with get_db() as db:
        async with db.cursor() as cur:

            await cur.execute(
                "DELETE FROM leads WHERE id = %s",
                (lead_id,)
            )

    return {"ok": True}

# ============================================================
# STATS
# ============================================================

@app.get("/api/stats")
async def get_stats():

    async with get_db() as db:
        async with db.cursor(aiomysql.DictCursor) as cur:

            await cur.execute(
                """
                SELECT status, COUNT(*) as count
                FROM leads
                GROUP BY status
                """
            )

            by_status = await cur.fetchall()

            await cur.execute(
                "SELECT COUNT(*) as c FROM leads"
            )

            total_row = await cur.fetchone()

            await cur.execute(
                """
                SELECT COUNT(*) as c
                FROM leads
                WHERE DATE(created_at)=CURDATE()
                """
            )

            today_row = await cur.fetchone()

    status_map = {
        r["status"]: r["count"]
        for r in by_status
    }

    return {
        "ok": True,
        "total": total_row["c"] if total_row else 0,
        "today": today_row["c"] if today_row else 0,
        "byStatus": status_map
    }

# ============================================================
# DEV RUNNER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    port = int(os.getenv("PORT", 8000))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )