# AgentServer

FastAPI backend for VoiceOrchid. Provides workflow graph APIs, agent and tool management, LiveKit session lifecycle, and the realtime voice agent worker.

## Quickstart (Makefile — recommended)

From the **project root** (`VoiceOrchid/`):

```bash
# 1. Start Postgres + Redis
make infra

# 2. Install Python dependencies
make install-api

# 3. Apply database migrations
make migrate

# 4. Start the API server  (port 8000)
make api

# 5. Start the LiveKit voice worker  (separate terminal — required for voice sessions)
make worker
```

> The worker **must be running** alongside the API for voice sessions to work.  
> Without it, the browser connects to LiveKit but no agent ever joins the room.

## Manual setup (no Makefile)

```bash
cd AgentServer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.local.example .env.local   # fill in credentials

# Apply migrations (creates all tables)
PYTHONPATH=. alembic upgrade head

# Start API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start worker (separate terminal)
PYTHONPATH=. python agents/workers/entrypoint.py dev
```

## Environment variables — `.env.local`

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | LiveKit server WebSocket URL (`wss://…`) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `OPENAI_API_KEY` | OpenAI API key (realtime voice model) |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_HOST` | PostgreSQL host |
| `POSTGRES_PORT` | PostgreSQL port (default `5432`) |
| `REDIS_HOST` | Redis host (optional) |
| `REDIS_PORT` | Redis port (optional, default `6379`) |

## Database migrations

Alembic is the single source of truth for schema. `make migrate` (or `alembic upgrade head`) works on a completely fresh database — no manual `create_all` step required.

```bash
make migrate                      # apply all pending migrations
make migrate-new MSG="add users"  # generate a new migration
make migrate-down                 # roll back one migration
```

## API docs

Interactive Swagger UI: `http://localhost:8000/docs`
