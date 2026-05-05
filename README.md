# Roast-Me.me

> The cosmos have seen everything. And they have notes.

A personalised Vedic astrology roast app. Enter your birth details, receive a dark-but-warm psychological profile written by the cosmos (via Claude). Zero astrology jargon in the output. Just your patterns, held up to a light.

---

## Stack

| Layer    | Tech                          | Host         |
|----------|-------------------------------|--------------|
| Frontend | Next.js 14 (App Router, TS)   | Vercel (free)|
| Backend  | FastAPI + pyswisseph           | Railway (free)|
| AI       | Claude claude-sonnet-4-6 via Anthropic API | — |
| Geocoding| OpenCage API                  | — |

---

## Local Development

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/roast-me.git
cd roast-me
```

### 2. Backend setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Download Swiss Ephemeris data files (required by pyswisseph)
bash download_ephemeris.sh

# Copy and fill in env vars
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and OPENCAGE_API_KEY

# Start backend
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`
Health check: `http://localhost:8000/health`

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

# Start frontend
npm run dev
```

Frontend runs at `http://localhost:3000`

---

## API Keys

| Key | Where to get |
|-----|-------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `OPENCAGE_API_KEY`  | https://opencagedata.com (free tier: 2,500 req/day) |

---

## Deployment

### Backend → Railway

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Point to the `backend/` folder (set root directory in Railway settings)
3. Add environment variables in Railway dashboard:
   - `ANTHROPIC_API_KEY`
   - `OPENCAGE_API_KEY`
   - `ALLOWED_ORIGIN=https://roast-me.me`
4. Railway auto-detects `Procfile` and deploys
5. Copy the Railway URL (e.g. `https://roast-me-backend.up.railway.app`)

> **Ephemeris files on Railway**: After first deploy, run the following in Railway's shell:
> ```bash
> bash download_ephemeris.sh
> ```
> Or add the download to a `nixpacks.toml` build step.

### Frontend → Vercel

1. Go to https://vercel.com → New Project → Import from GitHub
2. Set framework: **Next.js**, root directory: `frontend/`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL
4. Deploy

---

## Project Structure

```
roast-me/
├── .gitignore
├── README.md
├── backend/
│   ├── main.py              ← FastAPI app — /api/chart, /api/roast, /api/ask
│   ├── vedic_calc.py        ← pyswisseph D1/D9/D10 chart engine
│   ├── prompt_builder.py    ← Jyotishi + Roast system prompt builders
│   ├── requirements.txt
│   ├── Procfile             ← Railway start command
│   ├── railway.toml         ← Railway config
│   ├── download_ephemeris.sh← Downloads Swiss Ephe data files
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx   ← Root layout + SEO meta
    │   │   ├── page.tsx     ← Entry point
    │   │   └── globals.css
    │   └── components/
    │       └── RoastMe.tsx  ← Full app component (input → loading → result)
    ├── package.json
    ├── next.config.js
    ├── tsconfig.json
    └── .env.local.example
```

---

## API Reference

### `POST /api/chart`
Geocodes birth place, calculates Vedic chart, stores session.

**Body:** `{ dob, tob, pob, name?, gender? }`
**Returns:** `{ session_id, ascendant, sun_sign, moon_sign, ... }`

### `POST /api/roast`
Streams the personalised roast as SSE.

**Body:** `{ session_id, intensity }` — intensity: `"Mild" | "Spicy" | "No Mercy"`
**Returns:** SSE stream → collect text tokens → parse as JSON `{ villain_name, patterns[] }`

### `POST /api/ask`
Streams a Jyotishi advisor response (future feature).

**Body:** `{ session_id, question, history[] }`

---

## Viral mechanics built in

- **Villain name** — shareable in bio, stories, WhatsApp status
- **Per-card copy** — every pattern card has a one-tap copy button that appends `— roast-me.me`
- **"Roast someone else"** CTA — passive friend loop

---

## License

MIT
