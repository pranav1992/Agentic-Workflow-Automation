# AgentServer

FastAPI backend for the Car Service Voice Assistant. Provides workflow graph APIs, agent and tool management, and LiveKit voice agent entrypoints.

## Features
- Workflow graph CRUD (agents, tools, edges, positions)
- Postgres persistence with SQLModel
- LiveKit worker entrypoint for realtime voice agents

## Quickstart
1. `cd AgentServer`
2. `python -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. Create `.env.local` with required variables
5. `python main.py`

API docs: `http://127.0.0.1:8000/docs`

## Environment
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `REDIS_HOST` (optional)
- `REDIS_PORT` (optional)

## LiveKit Worker
Run the realtime voice agent worker:
- `python agents/workers/entrypoint.py`

## Notes
- Tables are created on startup by `create_db_and_tables()`
