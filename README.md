# AskDrFleshner — Virtual Urology Consultation Platform

A multi-condition virtual consultation platform for Dr. Neil Fleshner's urology practice.

## Features

- **Multi-condition support**: BPH, Erectile Dysfunction, Microhematuria
- **Auto-detection**: Reads referral files and routes to the correct clinical protocol
- **Live Clinical Dashboard**: Real-time reasoning sidebar (for clinician view)
- **Patient Progress Bar**: Shows consultation progress
- **SOAP Note Generation**: Auto-generates clinical documentation
- **Admin Dashboard**: View all consultations with transcripts

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo-url>
cd askdrfleshner
npm install

# 2. Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Anthropic API key

# 3. Run locally
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

```bash
# Via Vercel CLI
npx vercel

# Or connect GitHub repo in Vercel dashboard
# Add environment variables in Vercel project settings:
# - ANTHROPIC_API_KEY
# - ADMIN_USERNAME
# - ADMIN_PASSWORD
```

## Project Structure

```
askdrfleshner/
├── app/
│   ├── page.jsx              # Main patient-facing app
│   ├── layout.jsx             # Root layout
│   ├── admin/
│   │   └── page.jsx           # Admin dashboard (login required)
│   └── api/
│       ├── chat/route.js      # Chat endpoint (secure API key)
│       ├── analyze/route.js   # Clinical analysis endpoint
│       ├── soap/route.js      # SOAP generation endpoint
│       └── admin/
│           └── conversations/route.js  # Admin data endpoint
├── prompts/
│   ├── bph.js                 # BPH system prompt
│   ├── ed.js                  # ED system prompt
│   ├── mh.js                  # MH system prompt
│   ├── unknown.js             # Fallback prompt
│   └── index.js               # Prompt exports
├── lib/
│   ├── store.js               # Conversation storage
│   └── auth.js                # Admin authentication
├── public/                     # Static assets
├── .env.local.example         # Environment template
├── next.config.js
└── package.json
```

## Updating Prompts

Each clinical prompt lives in its own file under `prompts/`.
To update a prompt, edit the corresponding file and redeploy.
The full unabridged prompts should be pasted here (no size limit on server-side).

## Admin Access

Navigate to `/admin` and log in with the credentials from your environment variables.
Default: `admin` / `drfleshner2026`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `ADMIN_USERNAME` | No | Admin login (default: admin) |
| `ADMIN_PASSWORD` | No | Admin password (default: drfleshner2026) |

## Demo Patients

Upload these test files to demo each condition:
- `PATIENT_01_Michael_Tran.txt` — BPH/LUTS
- `PATIENT_02_Daniel_*.txt` — Erectile Dysfunction
- `PATIENT_03_Margaret_Whitfield.txt` — Microhematuria

---

Built for Dr. Neil Fleshner · Not for clinical use (demonstration only)
