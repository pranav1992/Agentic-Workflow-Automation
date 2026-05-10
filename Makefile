API_DIR := AgentServer
UI_DIR  := AgentUi/agent@ui
VENV    := $(CURDIR)/$(API_DIR)/.venv
BIN     := $(VENV)/bin

.DEFAULT_GOAL := help
.PHONY: help infra infra-down install install-api install-ui \
        migrate migrate-new api ui \
        lint test \
        docker-up docker-build docker-down logs logs-api

# ── Help ──────────────────────────────────────────────────────
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Infrastructure (Postgres + Redis only) ────────────────────
infra: ## Start Postgres + Redis in Docker
	docker compose up -d postgres redis
	@echo ""
	@echo "  Postgres → localhost:5433"
	@echo "  Redis    → localhost:6379"
	@echo ""
	@echo "  Next: make migrate && make api   (in one terminal)"
	@echo "        make ui                    (in another terminal)"

infra-down: ## Stop Postgres + Redis
	docker compose stop postgres redis

# ── Dependencies ──────────────────────────────────────────────
install: install-api install-ui ## Install all dependencies

install-api: ## Sync Python deps with uv (fast, respects uv.lock)
	uv sync --project $(API_DIR)

install-ui: ## Install JS deps
	cd $(UI_DIR) && npm install

# ── Database ──────────────────────────────────────────────────
migrate: ## Apply all pending Alembic migrations
	cd $(API_DIR) && $(BIN)/alembic upgrade head

migrate-new: ## Generate a new migration  (usage: make migrate-new MSG="add users")
	cd $(API_DIR) && $(BIN)/alembic revision --autogenerate -m "$(MSG)"

migrate-down: ## Roll back the last migration
	cd $(API_DIR) && $(BIN)/alembic downgrade -1

migrate-stamp: ## Mark DB as up-to-date without running migrations (use after create_all)
	cd $(API_DIR) && $(BIN)/alembic stamp head

# ── Services (run each in its own terminal) ───────────────────
api: ## Start FastAPI with hot-reload on :8000
	cd $(API_DIR) && $(BIN)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

ui: ## Start Vite dev server with HMR on :5173
	cd $(UI_DIR) && npm run dev

# ── Quality ───────────────────────────────────────────────────
lint: ## Lint API (ruff) and UI (eslint)
	cd $(API_DIR) && $(BIN)/ruff check .
	cd $(UI_DIR) && npm run lint

test: ## Run API test suite
	cd $(API_DIR) && $(BIN)/pytest tests/ -v

# ── Docker (full stack — integration tests, not daily dev) ────
docker-up: ## Start full Docker stack (no rebuild)
	docker compose up -d

docker-build: ## Rebuild Docker images (run only when requirements.txt changes)
	docker compose build

docker-down: ## Stop and remove all Docker containers
	docker compose down

# ── Logs ─────────────────────────────────────────────────────
logs: ## Tail logs for all Docker services
	docker compose logs -f

logs-api: ## Tail API logs only (Docker mode)
	docker compose logs -f api
