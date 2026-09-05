#!/usr/bin/env bash
# =============================================================
# TERMINAI — Export USB paket (offline namestitev za stranke)
# Uporaba: bash export-usb.sh
# Rezultat: dist-usb/TERMINAI/ (skopiraj na USB ključek)
# =============================================================
set -euo pipefail

ROOT="/home/z/my-project"
OUT="$ROOT/dist-usb/TERMINAI"
PORT=3456

cd "$ROOT"

echo "==> 1/7 Ustavljam dev server (zacasno) ..."
pkill -f "next dev -p 3000" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

echo "==> 2/7 Produkcijski build (AI izklopljena, offline) ..."
NEXT_PUBLIC_AI_ENABLED=false AI_ENABLED=false bun run build 2>&1 | tail -20

echo "==> 3/7 Sestavljam USB strukturo ..."
rm -rf "$OUT"
mkdir -p "$OUT/app" "$OUT/runtime"

# Standalone build vsebuje: server.js, node_modules subset, .next/static, public
cp -r "$ROOT/.next/standalone/." "$OUT/app/"

# Obramba pred smetmi: Next file-tracing včasih povleče projektne mape
# (dist-usb z ZIPOM, dev.log, screenshots …) v standalone — jih odstranimo,
# da na USB ne pride 800 MB odvečne vsebine. App sme vsebovati samo:
# .next, node_modules, public, server.js, package.json (+ db, .env).
for JUNK in dist-usb screenshots scripts src dev.log worklog.md README.md \
            .git .env.local sales-flyer download examples mini-services \
            db/backups prisma Caddyfile eslint.config.mjs export-usb.sh \
            next.config.ts postcss.config.mjs tailwind.config.ts tsconfig.json \
            components.json bun.lock skills start-dev.sh tests upload usb-template; do
  rm -rf "$OUT/app/$JUNK"
done
echo "    Vsebina app/: $(ls "$OUT/app" | tr '\n' ' ')"

# Baza: friskno kopijo demo baze (stranka resetira prek UI "Cist start")
rm -f "$OUT/app/custom.db"
cp "$ROOT/db/custom.db" "$OUT/app/custom.db"

# .env znotraj app mape (linux start.sh uporabi; bat pa nastavi eksplicitno)
cat > "$OUT/app/.env" << 'EOF'
DATABASE_URL=file:./custom.db
AI_ENABLED=false
EOF

echo "==> 4/7 Kopiram bun runtime (linux + windows) ..."
cp "$(command -v bun)" "$OUT/runtime/bun-linux"

if [ ! -f "$OUT/runtime/bun.exe" ]; then
  echo "    Prenasam bun.exe (Windows) iz GitHub releases ..."
  if curl -sL --max-time 120 -o /tmp/bun-win.zip \
     "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip"; then
    python3 -m zipfile -e /tmp/bun-win.zip /tmp/bun-win/ 2>/dev/null || unzip -q -o /tmp/bun-win.zip -d /tmp/bun-win/
    EXE=$(find /tmp/bun-win -name "bun.exe" -type f | head -1)
    if [ -n "$EXE" ]; then
      cp "$EXE" "$OUT/runtime/bun.exe"
      echo "    bun.exe uspesno pridobljen."
    fi
    rm -rf /tmp/bun-win /tmp/bun-win.zip
  fi
fi
[ -f "$OUT/runtime/bun.exe" ] || echo "    OPOMBA: bun.exe manjka — rocno dodaj iz https://bun.sh (Windows zip)"

echo "==> 5/7 Dodajam namestitvene skripte in navodila ..."
cp "$ROOT/usb-template/"* "$OUT/"
chmod +x "$OUT/start.sh"

echo "==> 6/7 Test offline zagona (port $PORT) ..."
cd "$OUT/app"
DATABASE_URL="file:$PWD/custom.db" AI_ENABLED=false PORT=$PORT HOSTNAME=127.0.0.1 \
  "$OUT/runtime/bun-linux" server.js > /tmp/usb-test.log 2>&1 &
TEST_PID=$!
sleep 6

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" --max-time 10 || echo "FAIL")
API=$(curl -s "http://localhost:$PORT/api/services" --max-time 10 | head -c 120 || echo "FAIL")

if [ "$HTTP" = "200" ]; then
  echo "    ✓ Stran se odpre (HTTP $HTTP)"
  echo "    ✓ API: ${API:0:80}"
else
  echo "    ✗ NAPAKA: HTTP=$HTTP — zadnjih 20 vrstic loga:"
  tail -20 /tmp/usb-test.log
fi

# Preveri, da ni CDN odvisnosti v client bundle (grep na zunanje URLje)
BUNDLES=$(find "$OUT/app/.next/static" -name "*.js" -type f)
CDNHITS=$(grep -l "z-cdn.chatglm.cn\|fonts.googleapis\|fonts.gstatic" $BUNDLES 2>/dev/null | head -3 || true)
if [ -n "$CDNHITS" ]; then
  echo "    ✕ OPOZORILO: CDN reference najdene v: $CDNHITS"
else
  echo "    ✓ Brez CDN odvisnosti — cist offline bundle"
fi

kill $TEST_PID 2>/dev/null || true
sleep 1

echo "==> 7/7 Znazujem dev server (port 3000, daemon mode) ..."
cd "$ROOT"
bash "$ROOT/start-dev.sh"

SIZE=$(du -sh "$OUT" | cut -f1)
echo ""
echo "============================================================"
echo " USB PAKET PRIPRABLJEN: dist-usb/TERMINAI  ($SIZE)"
echo " Skopiraj na USB in pri stranki pozeni NAMESTI.bat"
echo "============================================================"
