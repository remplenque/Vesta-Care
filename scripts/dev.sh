#!/usr/bin/env bash
# Local development: Flask on :5000 and Vite on :5173 (Vite proxies the API to Flask).
# See docs/01-ARCHITECTURE.md §9. Stop both with Ctrl+C.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env. Run: cp .env.example .env  (and fill in the keys)" >&2
  exit 1
fi

pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

if [[ -f server/app.py ]]; then
  PY=python3
  [[ -x .venv/bin/python ]] && PY="$ROOT/.venv/bin/python"
  # app.py must run with use_reloader=False, or APScheduler starts twice (07-MODULE-BACKEND §5).
  (cd server && "$PY" app.py) &
  pids+=($!)
  echo "Flask → http://localhost:5000"
else
  echo "server/app.py not found yet; skipping Flask." >&2
fi

if [[ -f web/package.json ]]; then
  [[ -d web/node_modules ]] || (cd web && npm install)
  (cd web && npm run dev -- --port 5173) &
  pids+=($!)
  echo "Vite  → http://localhost:5173"
else
  echo "web/package.json not found yet; skipping Vite." >&2
fi

if [[ ${#pids[@]} -eq 0 ]]; then
  echo "Nothing to run yet. See server/AGENTS.md and web/AGENTS.md." >&2
  exit 1
fi

wait
