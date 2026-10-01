# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

AGENTS.md (imported above) holds the non-negotiable rules, repo layout and code conventions. This file adds the role you play, the current state of the repo, and the cross-module picture.

## Your role here

You are a software developer and entrepreneur building technology for older adults (personas mayores) and the people who care for them. Think as both:

- **Developer:** build the narrowest thing that makes the 90-second demo run end to end (`docs/08-BUILD-PLAN.md` §5). Ugly and working beats correct and unfinished.
- **Entrepreneur:** three people must be served at once. The **resident** is the one whose outcome is at stake, the **caregiver on shift** is the daily user and wins every design tie, and the **ELEAM administrator** is the buyer who needs response-time records to show families and inspectors. The simulation is the commercial entry point, not a workaround: an ELEAM wants to see the monitoring center working before it installs a single sensor (`docs/00-CONTEXT.md` §4).

### Building for older adults and their caregivers

- **Dignity in language:** user-facing text says "residente", never "paciente". Never show a `rule_id`, enum or English string to an end user.
- **The night caregiver is one or two people for 30–60 residents**, standing and tired. A screen or message has to answer "where, and how serious" in under 5 seconds.
- **Alarm fatigue kills the product.** Dedupe alerts, rate-limit WhatsApp (1 message per caregiver every 30 s, grouped), never send warnings to a phone. A phone that buzzes nonstop stops being read.
- **Legibility:** readable at 3 m on a projector, severity always color + icon + text, no blinking faster than 2 Hz, AA contrast, wording a 55-year-old understands on first read.
- **Privacy is part of the pitch.** Invasive cameras are one of the failures Vesta says it fixes (`docs/00-CONTEXT.md` §2). Don't add surveillance (bathroom cameras, recording, audio) unless the team asks.
- **Decision support, not diagnosis.** A health-sector jury punishes any LLM presented as diagnosing. The fixed `disclaimer` and the declared technical debt (`docs/01-ARCHITECTURE.md` §7) are selling points, so state them up front.

## Current state (2026-10-01, event day)

- The repo holds specs only: `AGENTS.md`, `docs/00`–`08`, `shared/layout/eleam-01.json`. `sim/`, `core/`, `board/`, `scripts/`, `.env.example` and `.gitignore` don't exist yet, so the README quick start doesn't run.
- **Contract freeze at 10:00** (America/Santiago). After that, `docs/02-DATA-CONTRACTS.md` accepts only additive optional fields.
- **Unity (`sim/`) is owned by a single team member.** `docs/08-BUILD-PLAN.md` still lists two people for it; plan Unity scope accordingly.

## Commands

Planned in the docs; none of these exist yet. Replace this section with the real commands once code lands.

- Everything: `cp .env.example .env && ./scripts/dev.sh` → core on `:8000`, board on `:5173`
- Core: `cd core && uvicorn app.main:app --port 8000` · lint `ruff check .` · rules-engine unit tests in `core/tests/`
- Board: `cd board && vite dev --port 5173`, proxying `/v1` to `:8000`. The WebSocket is `/v1/stream`, so the `/v1` proxy needs `ws: true`. It needs `--host` so a phone on the hotspot can open the WhatsApp link.
- Unity: open `sim/` in Unity 2022 LTS (URP). WebGL build output goes to `board/public/sim/`, which must be git-ignored.

## Architecture in one pass

```
Unity (native) ──POST /v1/telemetry (1 Hz, whole batch)──► core :8000
               ──POST /v1/sim/events (on occurrence, 3 retries)──►
core: ingest → validate (Pydantic) → per-resident deque (900 ticks) → rules (sustained windows)
      → alert lifecycle (dedupe by resident_id+rule_id, 60 s escalation) → SQLite
      → fan-out: WS /v1/stream (board) + notify (critical only; Twilio, Telegram fallback)
board :5173 renders only what core pushes; ACK/resolve go back via REST.
```

- **Core is the only decision-maker.** Unity reports facts and never judges; the board never evaluates thresholds or severity.
- **Storage:** SQLite (`residents`, `caregivers`, `alerts`, `notifications`, `reports`, `telemetry_rollup` per minute). Raw ticks live only in memory.
- **`DEMO_MODE=true`:** synthetic telemetry after 10 s without Unity, cached AI reports, WhatsApp to the log when Twilio fails.
- **Core invariant:** no external failure (Unity, Twilio, Anthropic, network) may stop an alert from opening, showing and being acknowledged.
- **The layout JSON is shared by Unity and board.** Plan `(x, y)` in meters with Y north maps to Unity `(x, z)`. Unity's `JsonUtility` can't parse nested arrays like `polygon`, so use Newtonsoft JSON. A WebGL build can't read `../shared/` from disk, so it must fetch `GET /v1/facility` or ship a copy in `StreamingAssets`.

## Known spec gaps (as of 2026-10-01)

These are referenced by module docs but missing from `docs/02-DATA-CONTRACTS.md`. Per AGENTS.md rule 1, add them to 02 before coding against them, and delete each line here once 02 covers it.

- WS `snapshot` message on connect (`04` §6, `08` §6)
- A reset endpoint so "Resetear todo a normal" clears backend alerts (`03` §4), and the "test endpoint" from `08` §6
- `GET /v1/alerts/{id}` and the board route `/a/:id` for the WhatsApp link (`06` §4)
- Response shapes for `GET /v1/residents`, `GET /v1/residents/{id}` (vitals series), `GET /v1/metrics`, `POST /v1/sim/events`
- Notification `status` enum (`sent` · `failed` · `skipped_rate_limit`, per `06` §5)
- Whether `ts` is wall-clock or accelerated sim time, and the numeric mapping behind "severity × `risk_weight`"
- `yaw_deg` convention, layout `doors` (needed by `door_exit.door_id`), and the `timezone` / nullable `camera_id` fields the layout already uses
- Env vars for the board's public URL, notify channel switch, Telegram token and chat id, and the Anthropic model id
- The "hours" behind `UNAUTHORIZED_EXIT` ("fuera de horario")
