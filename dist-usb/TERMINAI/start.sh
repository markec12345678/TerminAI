#!/usr/bin/env bash
# TerminAI — zagon na Linux/macOS
cd "$(dirname "$0")/app"
export DATABASE_URL="file:$(pwd)/custom.db"
export AI_ENABLED=false
export PORT=3456
export HOSTNAME=0.0.0.0

echo "=============================================="
echo " TERMINAI — zaganjam rezervacijski sistem ..."
echo " Odpre se brskalnik na http://localhost:3456"
echo "=============================================="

( sleep 5; xdg-open http://localhost:3456 2>/dev/null || open http://localhost:3456 2>/dev/null ) &

../runtime/bun-linux server.js
