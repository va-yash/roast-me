"""
main.py — Roast-Me.me Backend
FastAPI + pyswisseph + OpenCage + Anthropic Claude

Environment variables (.env):
  ANTHROPIC_API_KEY   = sk-ant-...
  OPENCAGE_API_KEY    = your_opencage_key
  ALLOWED_ORIGIN      = https://roast-me-wheat.vercel.app   (or * for dev)
  CLAUDE_MODEL        = claude-sonnet-4-6
  MAX_TOKENS          = 1600
  ROAST_RATE_PER_HOUR = 12      (per IP; 0 disables)

Run locally:
  uvicorn main:app --reload --port 8000
"""

import os
import json
import time
import uuid
import asyncio
from collections import defaultdict, deque
from datetime import datetime
from typing import AsyncGenerator

import httpx
import pytz
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from vedic_calc import calculate_chart, calculate_dominant_planet
from prompt_builder import build_roast_system_prompt

load_dotenv()

ANTHROPIC_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
OPENCAGE_KEY   = os.getenv("OPENCAGE_API_KEY", "")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
CLAUDE_MODEL   = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

# ── 2026-08 · 1000 -> 1600 ──────────────────────────────────────────────────
# The prompt asks for 8-10 patterns, each with a title, a 2-3 sentence body and
# a closer. Priced out, that is 850-1,000 output tokens before JSON overhead —
# i.e. the old ceiling was the expected length, not a backstop.
#
# The failure was silent, which is why it was never noticed: when the stream is
# cut mid-JSON the frontend's parseRoast() patches the unclosed brackets and
# renders whatever survived. The user gets six patterns instead of nine and no
# error anywhere. 1600 leaves real headroom; a runaway still stops.
MAX_TOKENS     = int(os.getenv("MAX_TOKENS", "1600"))

# Per-IP ceiling on roast generations. There is no auth on this endpoint and
# every call spends real money, so the only thing between a bored person with a
# loop and the Anthropic bill is this number. 0 disables.
RATE_PER_HOUR  = int(os.getenv("ROAST_RATE_PER_HOUR", "12"))

# ── In-memory session store ───────────────────────────────────────────────────
# { session_id: { chart, birth_utc, birth_data, dominant_planet, created } }
#
# Bounded now. It was an unbounded dict, so every chart ever calculated stayed
# resident until the container restarted — which on Railway is often enough to
# hide the leak rather than fix it.
SESSIONS: dict[str, dict] = {}
SESSION_MAX = int(os.getenv("SESSION_MAX", "2000"))

_rate: dict[str, deque] = defaultdict(deque)


def _rate_ok(ip: str) -> bool:
    """Sliding one-hour window per IP. In-memory, per container."""
    if RATE_PER_HOUR <= 0:
        return True
    now = time.time()
    dq  = _rate[ip]
    while dq and now - dq[0] > 3600:
        dq.popleft()
    if len(dq) >= RATE_PER_HOUR:
        return False
    dq.append(now)
    return True


def _remember(session_id: str, payload: dict) -> None:
    """Store a session, evicting the oldest when the cap is reached."""
    SESSIONS[session_id] = payload
    if len(SESSIONS) > SESSION_MAX:
        for old in sorted(SESSIONS, key=lambda k: SESSIONS[k].get("created", 0))[:200]:
            SESSIONS.pop(old, None)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Roast-Me.me API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    # Comma-separated list supported, so a preview deploy and the live URL can
    # both work during a move. A single stale value here CORS-blocks 100% of
    # traffic from whichever origin is not listed.
    allow_origins=(["*"] if ALLOWED_ORIGIN == "*"
                   else [o.strip() for o in ALLOWED_ORIGIN.split(",") if o.strip()]),
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
    language:   str = "English"    # Output language for the roast
    # "Mild" | "Spicy" | "No Mercy". Documented in the README since the first
    # release and never actually wired up; it is the single strongest lever on
    # "the roast is too soft" because the user opts into the harder setting
    # themselves.
    intensity:  str = "Spicy"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


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


async def _stream_claude(system_blocks, messages: list[dict],
                         max_tokens: int = None) -> AsyncGenerator[str, None]:
    """
    Shared SSE streaming logic for all Claude calls.

    `system_blocks` may be a plain string or a list of strings. A list is sent
    as a structured system array with a cache breakpoint on the FIRST block —
    that block is the craft/format instructions, which are byte-identical for
    every user of the app, so after the first roast of each cache window it is
    read back at 0.1x input price instead of being re-sent in full.
    """
    if not ANTHROPIC_KEY:
        yield f"data: {json.dumps({'error': 'ANTHROPIC_API_KEY not configured'})}\n\n"
        return

    headers = {
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
    }

    if isinstance(system_blocks, str):
        system_payload = system_blocks
    else:
        system_payload = []
        for i, text in enumerate(system_blocks):
            block = {"type": "text", "text": text}
            if i == 0:
                block["cache_control"] = {"type": "ephemeral"}
            system_payload.append(block)

    payload = {
        "model":      CLAUDE_MODEL,
        "max_tokens": max_tokens or MAX_TOKENS,
        "system":     system_payload,
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

                stop_reason = None
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
                    elif etype == "message_delta":
                        stop_reason = (event.get("delta") or {}).get("stop_reason")
                        usage = event.get("usage") or {}
                        if usage:
                            print(f"[roast] out={usage.get('output_tokens')} "
                                  f"stop={stop_reason}", flush=True)
                    elif etype == "message_stop":
                        # Surfaced so the frontend can tell a truncated roast
                        # from a complete one instead of silently rendering
                        # whatever survived the bracket-patcher.
                        yield f"data: {json.dumps({'done': True, 'truncated': stop_reason == 'max_tokens'})}\n\n"
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
    return {"status": "ok", "model": CLAUDE_MODEL, "sessions": len(SESSIONS)}


@app.post("/api/chart")
async def create_chart(birth: BirthInput, request: Request):
    """
    Geocode → calculate Vedic chart → store session.
    Returns session_id + compact chart summary for the UI.
    """
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "That's a lot of roasts. Try again in a bit.")

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
        dominant_planet = calculate_dominant_planet(chart)
    except Exception:
        dominant_planet = "Saturn"  # safe fallback

    session_id = str(uuid.uuid4())
    _remember(session_id, {
        "chart":           chart,
        "birth_utc":       birth_utc,
        "dominant_planet": dominant_planet,
        "created":         time.time(),
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
    })

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
        "dominant_planet": dominant_planet,
    }


@app.post("/api/roast")
async def get_roast(req: RoastInput, request: Request):
    """
    Streaming endpoint — generates the personalised roast.
    Requires a valid session_id from /api/chart.
    Streams SSE text tokens. Frontend collects them and parses as JSON.
    """
    if req.session_id not in SESSIONS:
        raise HTTPException(404, "Session not found. Please re-enter birth details.")

    session = SESSIONS[req.session_id]

    try:
        # ── 2026-08 · THE PROMPT NOW KNOWS WHO IT IS ROASTING ───────────────
        # birth_data (name, gender, place) and dominant_planet were both sitting
        # on the session and neither reached the prompt. The chart was being
        # described to the model with no person attached to it, which is why
        # every roast read like it could have been about anyone born that month.
        system_blocks = build_roast_system_prompt(
            session["chart"],
            birth_dt=session["birth_utc"],
            query_date=datetime.utcnow(),
            language=req.language,
            birth_data=session.get("birth_data") or {},
            dominant_planet=session.get("dominant_planet", ""),
            intensity=req.intensity,
            as_blocks=True,
        )
    except Exception as e:
        raise HTTPException(500, f"Roast prompt build failed: {e}")

    messages = [{"role": "user", "content": "Generate the roast now. Output only JSON."}]

    return StreamingResponse(
        _stream_claude(system_blocks, messages, max_tokens=MAX_TOKENS),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
