# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

AGENTS.md (imported above) holds the non-negotiable rules, repo layout and code conventions. This file adds the role you play, the current state of the repo, and the cross-module picture.

## Your role here

You are a software developer and entrepreneur building technology for older adults (personas mayores) who live alone, and for the family who supports them from a distance. Think as both:

- **Developer:** build the narrowest thing that makes the 90-second demo run end to end (`docs/07-BUILD-PLAN.md` §4). Ugly and working beats correct and unfinished.
- **Entrepreneur:** the **older adult** is the primary user and wins every design tie: if they feel watched, they switch Vesta off and the product is dead. The **primary contact** (usually a daughter or son) is the likely buyer and wants peace of mind, not a firehose. Vesta's pitch is integration: it doesn't compete with the watch, the pillbox or BondUP, it ties them together (`docs/00-CONTEXT.md` §3–4).

### Building for older adults and their families

- **Dignity in language:** say the person's name ("Don Luis"), never "paciente" or "usuario". "Usted" by default, no condescending diminutives. Never show a `rule_id`, enum or English string to an end user.
- **Voice is unreliable with older adults.** Every voice interaction has a big-button alternative; the mic only listens while "Hablar" is pressed.
- **Alarm fatigue kills the product.** Dedupe alerts, max 1 WhatsApp per contact every 30 s (grouped), medication never notifies as `critical`, device issues stay in the panel.
- **Legibility:** large type, severity always color + icon + text, no blinking faster than 2 Hz, AA contrast, readable at 3 m on a projector.
- **Privacy is part of the pitch.** No cameras, recordings or always-on mic; family sees that a conversation happened, not what was said; the person can pause monitoring.
- **Support, not diagnosis.** The LLM never gives clinical advice; emergency phrases are caught by a fixed filter before it. State this and the declared technical debt (`docs/01-ARCHITECTURE.md` §7) up front to the jury.

## Current state (2026-10-01, event day)

- **Product pivot (twice) this morning.** ELEAM monitoring center → smart pillbox → **centralized assistant**. ELEAM specs are archived in `docs/archive/eleam/`; don't build against them.
- `core/` has a working assistant prototype: a phone-sized voice page at `/` (`core/app/static/mic.html`, Emilia/Mateo mascots, tap-to-answer suggestions, replay), the assistant (`assistant.py`: fixed safety filters, then Claude Haiku 4.5 with read-only state), ElevenLabs TTS proxy (`tts.py`) and the Twilio WhatsApp webhook (`whatsapp.py`). The agenda, alerts, store and `web/` (React) don't exist yet; the person and agenda are hardcoded in `assistant.py`.
- ElevenLabs is on a free account: the library voices chosen for Emilia/Mateo need a paid plan, so `.env` maps them to premade stand-ins (see the comment there).
- **Contract freeze at 12:00** (America/Santiago). After that, `docs/02-DATA-CONTRACTS.md` accepts only additive optional fields.
- **Unverified assumption:** "Bondapp" was read as **BondUP**, the Chilean community app for people 55+. Confirm with the team before naming it in the pitch.
- Team: Vicente Rodríguez, Bato, Luchoo. Roles A/B/C in `docs/07-BUILD-PLAN.md` are not yet assigned.

## Commands

- Setup: `cp .env.example .env` (fill keys) · `python3 -m venv core/.venv && core/.venv/bin/pip install -r core/requirements.txt`
- Core + voice page: `cd core && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app --reload-dir .. --reload-include .env --reload-exclude .venv` → open `http://localhost:8000`
- Public tunnel for WhatsApp and phone mic (HTTPS): `cloudflared tunnel --url http://localhost:8000`, then set `PUBLIC_CORE_URL` and paste `<url>/v1/channels/whatsapp/webhook` in the Twilio sandbox settings. The quick-tunnel URL changes on every restart.
- Planned, not yet present: `./scripts/dev.sh`, `pytest` suites in `core/tests/`, `ruff check .`
- Web (planned): `cd web && vite dev --host --port 5173`, proxying `/v1` to `:8000` with `ws: true` (the WebSocket is `/v1/stream`). `--host` so a phone on the hotspot can open the WhatsApp link.

## Architecture in one pass

```
connectors (watch · pillbox · calendar · bondup · /sim) ──POST /v1/events──► core :8000
core: ingest → rules → check-ins / alerts ─┐   agenda scheduler (1 s tick) → reminders → escalation
                                           └──► SQLite → fan-out: WS /v1/stream + notify (WhatsApp/Telegram/log)
assistant: text → fixed emergency filter → LLM (read-only state summary) → {reply, flags} → core decides actions
web :5173: /  (person, voice + buttons) · /familia + /a/:id (family, ACK) · /sim (operator)
```

- **Core is the only decision-maker.** Connectors report facts, the LLM returns text and flags, the web paints.
- **Scheduler time is injectable** (`now()`), so escalation tests don't sleep. `ESCALATION_TIME_SCALE` compresses minutes into seconds for the demo.
- **`DEMO_MODE=true`:** accelerated escalation, assistant fallback templates, WhatsApp to the log when Twilio fails, `/v1/demo/*` enabled.
- **Core invariant:** no external failure (Twilio, Anthropic, browser speech, network) may stop a reminder from firing or an alert from opening, showing and being acknowledged.
