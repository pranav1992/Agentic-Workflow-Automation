#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# start.sh — CarServiceVoiceAssistant local dev launcher
# Usage:
#   ./start.sh          # start all services
#   ./start.sh api      # backend API only
#   ./start.sh ui       # frontend only
#   ./start.sh worker   # LiveKit voice worker only
#   ./start.sh infra    # Postgres + Redis only (via Docker)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

# ── Colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[start]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ── Prerequisite checks ───────────────────────────────────────
check_prereqs() {
  command -v python3 >/dev/null 2>&1 || error "python3 not found. Install Python 3.12+."
  command -v node    >/dev/null 2>&1 || error "node not found. Install Node.js 20+."
  command -v npm     >/dev/null 2>&1 || error "npm not found."
  command -v docker  >/dev/null 2>&1 || error "docker not found. Install Docker Desktop."
  PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  [[ "$PYTHON_VERSION" < "3.12" ]] && warn "Python $PYTHON_VERSION detected — 3.12+ recommended."
}

# ── Infra (Postgres + Redis) ──────────────────────────────────
start_infra() {
  info "Starting Postgres and Redis via Docker Compose..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres redis
  info "Waiting for Postgres to be healthy..."
  for i in $(seq 1 20); do
    docker compose -f "$ROOT_DIR/docker-compose.yml" exec postgres \
      pg_isready -U devuser -q 2>/dev/null && break
    sleep 1
  done
  info "Postgres is ready."
}

# ── Backend API ───────────────────────────────────────────────
setup_backend_venv() {
  local VENV="$ROOT_DIR/AgentServer/.venv"
  if [[ ! -d "$VENV" ]]; then
    info "Creating backend virtualenv..."
    python3 -m venv "$VENV"
  fi
  # shellcheck source=/dev/null
  source "$VENV/bin/activate"
  info "Installing backend dependencies..."
  pip install -q -r "$ROOT_DIR/AgentServer/requirements.txt"
}

run_migrations() {
  info "Running Alembic database migrations..."
  (
    cd "$ROOT_DIR/AgentServer"
    source .venv/bin/activate
    alembic upgrade head
  )
}

start_api() {
  [[ ! -f "$ROOT_DIR/AgentServer/.env.local" ]] && \
    error "Missing AgentServer/.env.local — copy .env.local.example and fill in your credentials."

  setup_backend_venv
  run_migrations

  info "Starting FastAPI backend on http://localhost:8000 ..."
  info "  Docs: http://localhost:8000/docs"
  (
    cd "$ROOT_DIR/AgentServer"
    source .venv/bin/activate
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
      2>&1 | tee "$LOG_DIR/api.log"
  ) &
  API_PID=$!
  echo $API_PID > "$LOG_DIR/api.pid"
  info "Backend PID: $API_PID (log: .logs/api.log)"
}

# ── Frontend UI ───────────────────────────────────────────────
start_ui() {
  [[ ! -f "$ROOT_DIR/AgentUi/agent@ui/.env" ]] && \
    warn "Missing AgentUi/agent@ui/.env — creating default pointing to localhost:8000."
    echo "VITE_APP_BASE_URL=http://127.0.0.1:8000" > "$ROOT_DIR/AgentUi/agent@ui/.env"
    echo "VITE_APP_API_TIMEOUT=10000"              >> "$ROOT_DIR/AgentUi/agent@ui/.env"

  info "Installing frontend dependencies..."
  (cd "$ROOT_DIR/AgentUi/agent@ui" && npm install --silent)

  info "Starting React UI on http://localhost:5173 ..."
  (
    cd "$ROOT_DIR/AgentUi/agent@ui"
    exec npm run dev 2>&1 | tee "$LOG_DIR/ui.log"
  ) &
  UI_PID=$!
  echo $UI_PID > "$LOG_DIR/ui.pid"
  info "Frontend PID: $UI_PID (log: .logs/ui.log)"
}

# ── LiveKit Worker ────────────────────────────────────────────
start_worker() {
  [[ ! -f "$ROOT_DIR/AgentServer/.env.local" ]] && \
    error "Missing AgentServer/.env.local — LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and OPENAI_API_KEY required."

  info "Starting LiveKit voice worker..."
  (
    cd "$ROOT_DIR/AgentServer"
    source .venv/bin/activate
    exec python agents/workers/entrypoint.py dev \
      2>&1 | tee "$LOG_DIR/worker.log"
  ) &
  WORKER_PID=$!
  echo $WORKER_PID > "$LOG_DIR/worker.pid"
  info "LiveKit worker PID: $WORKER_PID (log: .logs/worker.log)"
}

# ── Cleanup on Ctrl-C ─────────────────────────────────────────
cleanup() {
  echo ""
  warn "Shutting down services..."
  for pid_file in "$LOG_DIR"/*.pid; do
    [[ -f "$pid_file" ]] || continue
    pid=$(cat "$pid_file")
    kill "$pid" 2>/dev/null && info "Stopped PID $pid ($(basename "$pid_file" .pid))"
    rm -f "$pid_file"
  done
  info "All services stopped."
}
trap cleanup INT TERM

# ── Entry point ───────────────────────────────────────────────
TARGET="${1:-all}"

check_prereqs

case "$TARGET" in
  all)
    start_infra
    start_api
    start_ui
    start_worker
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  All services started successfully!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "  API:     http://localhost:8000"
    echo -e "  Docs:    http://localhost:8000/docs"
    echo -e "  UI:      http://localhost:5173"
    echo -e "  Logs:    .logs/"
    echo ""
    echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services."
    wait
    ;;
  infra)   start_infra ;;
  api)     start_infra && start_api    && wait ;;
  ui)      start_ui                    && wait ;;
  worker)  start_worker                && wait ;;
  *)
    echo "Usage: $0 [all|api|ui|worker|infra]"
    exit 1
    ;;
esac
