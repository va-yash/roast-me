"""
main.py — Roast-Me.me Backend
FastAPI + pyswisseph + OpenCage + Anthropic Claude

Environment variables (.env):
  ANTHROPIC_API_KEY   = sk-ant-...
  OPENCAGE_API_KEY    = your_opencage_key
  ALLOWED_ORIGIN      = https://roast-me.me   (or * for dev)
  CLAUDE_MODEL        = claude-sonnet-4-6
  MAX_TOKENS          = 3000

Run locally:
  uvicorn main:app --reload --port 8000
"""

import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import AsyncGenerator

import httpx
import pytz
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from vedic_calc import calculate_chart
from prompt_builder import build_system_prompt, build_roast_system_prompt

load_dotenv()

ANTHROPIC_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
OPENCAGE_KEY   = os.getenv("OPENCAGE_API_KEY", "")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
CLAUDE_MODEL   = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
MAX_TOKENS     = int(os.getenv("MAX_TOKENS", "3000"))

# ── In-memory session store ───────────────────────────────────────────────────
# { session_id: { system_prompt, chart, birth_utc, birth_data } }
# Fine for low traffic. Swap for Redis at 100+ concurrent users.
SESSIONS: dict[str, dict] = {}

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Roast-Me.me API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN] if ALLOWED_ORIGIN != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────

class BirthInput(BaseModel):
    name:   str = ""
    dob:    str          # "YYYY-MM-DD"
    tob:    str          # "HH:MM"
    pob:    str          # "Nagpur, India"
    gender: str = ""


class RoastInput(BaseModel):
    session_id: str
    intensity:  str = "Unhinged"   # "Gentle" | "Chaotic" | "Unhinged"


class AskInput(BaseModel):
    session_id: str
    question:   str
    history:    list[dict] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

async def geocode_city(city: str) -> dict:
    if not OPENCAGE_KEY:
        raise HTTPException(500, "OPENCAGE_API_KEY not configured")
    url = "https://api.opencagedata.com/geocode/v1/json"
    params = {"q": city, "key": OPENCAGE_KEY, "limit": 1, "no_annotations": 0}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    if not data.get("results"):
        raise HTTPException(400, f"Location not found: {city}")
    result   = data["results"][0]
    geometry = result["geometry"]
    timezone = result["annotations"]["timezone"]["name"]
    return {
        "lat":               geometry["lat"],
        "lng":               geometry["lng"],
        "timezone":          timezone,
        "formatted_address": result["formatted"],
    }


def local_to_utc(dob: str, tob: str, timezone_str: str) -> datetime:
    tz       = pytz.timezone(timezone_str)
    dt_str   = f"{dob} {tob}:00"
    local_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
    local_dt = tz.localize(local_dt)
    utc_dt   = local_dt.astimezone(pytz.utc)
    return utc_dt.replace(tzinfo=None)


async def _stream_claude(system_prompt: str, messages: list[dict]) -> AsyncGenerator[str, None]:
    """Shared SSE streaming logic for all Claude calls."""
    if not ANTHROPIC_KEY:
        yield f"data: {json.dumps({'error': 'ANTHROPIC_API_KEY not configured'})}\n\n"
        return

    headers = {
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
    }
    payload = {
        "model":      CLAUDE_MODEL,
        "max_tokens": MAX_TOKENS,
        "system":     system_prompt,
        "messages":   messages,
        "stream":     True,
    }
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    yield f"data: {json.dumps({'error': body.decode()})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    etype = event.get("type")
                    if etype == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                yield f"data: {json.dumps({'text': text})}\n\n"
                    elif etype == "message_stop":
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        break
                    elif etype == "error":
                        err = event.get("error", {}).get("message", "Unknown error")
                        yield f"data: {json.dumps({'error': err})}\n\n"
                        break

    except httpx.ReadTimeout:
        yield f"data: {json.dumps({'error': 'Claude timed out. Please try again.'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


SSE_HEADERS = {
    "Cache-Control":    "no-cache",
    "X-Accel-Buffering": "no",
}

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": CLAUDE_MODEL}


@app.post("/api/chart")
async def create_chart(birth: BirthInput):
    """
    Geocode → calculate Vedic chart → store session.
    Returns session_id + compact chart summary for the UI.
    """
    try:
        geo = await geocode_city(birth.pob)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Geocoding failed: {e}")

    try:
        birth_utc = local_to_utc(birth.dob, birth.tob, geo["timezone"])
    except Exception as e:
        raise HTTPException(400, f"Invalid date/time: {e}")

    try:
        chart = calculate_chart(birth_utc, lat=geo["lat"], lon=geo["lng"])
    except Exception as e:
        raise HTTPException(500, f"Chart calculation failed: {e}")

    try:
        system_prompt = build_system_prompt(
            chart,
            birth_dt=birth_utc,
            query_date=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(500, f"Prompt build failed: {e}")

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "system_prompt": system_prompt,   # Jyotishi advisor mode
        "chart":         chart,            # raw dict — used by roast endpoint
        "birth_utc":     birth_utc,        # for dasha timing in roast
        "birth_data": {
            "name":     birth.name,
            "dob":      birth.dob,
            "tob":      birth.tob,
            "pob":      geo["formatted_address"],
            "gender":   birth.gender,
            "lat":      geo["lat"],
            "lng":      geo["lng"],
            "timezone": geo["timezone"],
        },
    }

    ct = chart["core_trinity"]
    return {
        "session_id":      session_id,
        "name":            birth.name or "Friend",
        "ascendant":       ct["ascendant"]["sign"],
        "asc_nakshatra":   ct["ascendant"]["nakshatra"],
        "asc_pada":        ct["ascendant"]["pada"],
        "sun_sign":        ct["sun"]["sign"],
        "moon_sign":       ct["moon"]["sign"],
        "moon_nakshatra":  ct["moon"]["nakshatra"],
        "moon_pada":       ct["moon"]["pada"],
        "location":        geo["formatted_address"],
        "timezone":        geo["timezone"],
    }


@app.post("/api/roast")
async def get_roast(req: RoastInput):
    """
    Streaming endpoint — generates the personalised roast.
    Requires a valid session_id from /api/chart.
    Streams SSE text tokens. Frontend collects them and parses as JSON.
    """
    if req.session_id not in SESSIONS:
        raise HTTPException(404, "Session not found. Please re-enter birth details.")

    session = SESSIONS[req.session_id]

    try:
        roast_system = build_roast_system_prompt(
            session["chart"],
            birth_dt=session["birth_utc"],
            query_date=datetime.utcnow(),
            intensity=req.intensity,
        )
    except Exception as e:
        raise HTTPException(500, f"Roast prompt build failed: {e}")

    messages = [{"role": "user", "content": "Generate the cosmic mirror reading now. Output only JSON."}]

    return StreamingResponse(
        _stream_claude(roast_system, messages),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@app.post("/api/ask")
async def ask_question(req: AskInput):
    """
    Streaming endpoint for the Jyotishi advisor mode (future feature).
    Same session, different system prompt.
    """
    if req.session_id not in SESSIONS:
        raise HTTPException(404, "Session not found. Please re-enter birth details.")

    session = SESSIONS[req.session_id]
    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in req.history
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    messages.append({"role": "user", "content": req.question})

    return StreamingResponse(
        _stream_claude(session["system_prompt"], messages),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
