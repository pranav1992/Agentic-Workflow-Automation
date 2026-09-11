#!/usr/bin/env bash
# Stops everything scripts/local-start.sh started: api, worker, ui
# processes, then the Postgres/LiveKit infra containers (via
# `make infra-down` — data volumes are preserved, not removed).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="/tmp/voiceorchid-run"

cd "$ROOT_DIR"

stop_bg() {
  local name="$1" port="$2"
  local pidfile="$RUN_DIR/$name.pid"

  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      # Some of these (uvicorn --reload, the LiveKit worker's process
      # pool) fork children of their own — kill those first, then the
      # process itself.
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      echo "  $name: stopped (pid $pid)"
    else
      echo "  $name: not running"
    fi
    rm -f "$pidfile"
  else
    echo "  $name: no pidfile, skipping"
  fi

  # Fallback in case the pidfile was stale or a child outlived its parent.
  if [ -n "$port" ] && lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  $name: port $port still held, force-killing"
    lsof -tiTCP:"$port" -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
  fi
}

echo "Stopping services..."
stop_bg api 8000
stop_bg worker ""
stop_bg ui 5173

# Worker holds no listening port, so it has no port-based fallback above —
# catch any orphaned instance by its exact command line instead.
pkill -f "agents/workers/entrypoint.py dev" 2>/dev/null || true

echo "Stopping infra (Postgres + LiveKit)..."
make infra-down

echo ""
echo "All stopped."
