#!/usr/bin/env bash
# Public HTTPS URL so the phone can reach the app. Service workers, Web Push and the microphone
# all require a secure context (docs/01-ARCHITECTURE.md §6).
#
# Usage: ./scripts/tunnel.sh [port]   (default 5000: Flask serving web/dist, as in the demo)
#
# WARNING: a quick tunnel gets a NEW random URL on every start. The installed PWA, the
# notification permission and the push subscription are bound to that origin, so a new URL
# means reinstalling on the phone. Start it once and leave it running (docs/10-OPEN-ISSUES.md #11).
# After it starts, copy the URL into PUBLIC_BASE_URL in .env.
set -euo pipefail

PORT="${1:-5000}"

if command -v cloudflared >/dev/null 2>&1; then
  exec cloudflared tunnel --url "http://localhost:${PORT}"
elif command -v ngrok >/dev/null 2>&1; then
  exec ngrok http "${PORT}"
else
  echo "Neither cloudflared nor ngrok is installed." >&2
  echo "Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi
