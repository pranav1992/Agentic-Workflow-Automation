#!/usr/bin/env bash
# stop.sh — stop all running VoiceOrchid services
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

stopped=0
for pid_file in "$LOG_DIR"/*.pid; do
  [[ -f "$pid_file" ]] || continue
  pid=$(cat "$pid_file")
  name=$(basename "$pid_file" .pid)
  if kill "$pid" 2>/dev/null; then
    echo -e "${GREEN}[stop]${NC} Stopped $name (PID $pid)"
    stopped=$((stopped + 1))
  else
    echo -e "${YELLOW}[warn]${NC}  $name (PID $pid) was not running"
  fi
  rm -f "$pid_file"
done

if [[ $stopped -eq 0 ]]; then
  echo "No running services found in .logs/. Nothing to stop."
fi

# Optionally stop Docker infra too
if [[ "${1:-}" == "--infra" ]]; then
  echo -e "${GREEN}[stop]${NC} Stopping Docker services..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" stop postgres redis
fi
