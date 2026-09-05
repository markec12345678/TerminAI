#!/usr/bin/env bash
# =============================================================
# TerminAI — zagon dev serverja kot PRAVI daemon (double-fork).
# Proces se reparenta na init (PID 1) in preživi bash klice.
# Uporaba: bash start-dev.sh   (ko je dev server padel/ustavljen)
# =============================================================
cd /home/z/my-project

python3 << 'EOF'
import os, sys, signal

# Preveri, da na portu 3000 ne teče že istanca (izogib duplikatom)
import socket
s = socket.socket()
try:
    s.bind(('0.0.0.0', 3000))
    s.close()
except OSError:
    print("OPOMBA: port 3000 je že zaseden — dev server morda že teči.")
    sys.exit(0)

if os.fork() > 0:
    sys.exit(0)
os.setsid()
signal.signal(signal.SIGHUP, signal.SIG_IGN)
if os.fork() > 0:
    sys.exit(0)

os.chdir('/home/z/my-project')
os.umask(0)

log = open('/home/z/my-project/dev.log', 'ab', buffering=0)
devnull = open(os.devnull, 'rb')
os.dup2(devnull.fileno(), 0)
os.dup2(log.fileno(), 1)
os.dup2(log.fileno(), 2)

os.execvp('bun', ['bun', 'run', 'dev'])
EOF

sleep 12
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 30)
echo "Dev server: HTTP $HTTP"
