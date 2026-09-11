#!/usr/bin/env bash
# Starts the full VoiceOrchid stack for local development: Docker
# (Postgres + LiveKit, via `make infra`), migrations, then the API,
# worker, and Vite dev server as background processes.
#
# Idempotent — anything already running on its port (or recorded in a
# pidfile) is left alone rather than duplicated. Logs and pidfiles go
# to /tmp/voiceorchid-run; use scripts/local-stop.sh to tear it back down.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="/tmp/voiceorchid-run"
API_DIR="$ROOT_DIR/AgentServer"
UI_DIR="$ROOT_DIR/AgentUi/agent@ui"
BIN="$API_DIR/.venv/bin"

mkdir -p "$RUN_DIR"
cd "$ROOT_DIR"

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

echo "Checking Docker..."
if ! docker info >/dev/null 2>&1; then
  echo "  starting Docker Desktop..."
  open -a Docker
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  if ! docker info >/dev/null 2>&1; then
    echo "Docker didn't come up in time." >&2
    exit 1
  fi
fi
echo "  ready"

echo "Starting infra (Postgres + LiveKit)..."
make infra

echo "Applying migrations..."
make migrate

# Launches "$@" (run from $dir) in the background via `exec`, so the pid we
# capture is the real server process itself, not a wrapper shell — that
# way local-stop.sh can actually kill what it thinks it's killing.
start_bg() {
  local name="$1" port="$2" dir="$3"
  shift 3
  local pidfile="$RUN_DIR/$name.pid"
  local logfile="$RUN_DIR/$name.log"

  if [ -n "$port" ] && port_in_use "$port"; then
    echo "  $name: already running on port $port — leaving it alone"
    return
  fi
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile" 2>/dev/null)" 2>/dev/null; then
    echo "  $name: already running (pid $(cat "$pidfile"))"
    return
  fi

  ( cd "$dir" && exec "$@" ) > "$logfile" 2>&1 &
  local pid=$!
  echo "$pid" > "$pidfile"
  echo "  $name: started (pid $pid, log: $logfile)"
}

echo "Starting services..."
start_bg api 8000 "$API_DIR" "$BIN/uvicorn" app.main:app --reload --host 0.0.0.0 --port 8000
start_bg worker "" "$API_DIR" env PYTHONPATH=. "$BIN/python" agents/workers/entrypoint.py dev
start_bg ui 5173 "$UI_DIR" ./node_modules/.bin/vite

sleep 3
echo ""
echo "Health check:"
curl -s -o /dev/null -w "  API: %{http_code}\n" http://localhost:8000/health || echo "  API: unreachable"
curl -s -o /dev/null -w "  UI:  %{http_code}\n" http://localhost:5173/ || echo "  UI:  unreachable"
echo ""
echo "VoiceOrchid is running:"
echo "  UI:  http://localhost:5173"
echo "  API: http://localhost:8000"
echo ""
echo "Logs: tail -f $RUN_DIR/{api,worker,ui}.log"
echo "Stop: scripts/local-stop.sh"
