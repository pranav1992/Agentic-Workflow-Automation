# VoiceOrchid

A full-stack platform for building and deploying AI-powered voice agents for automotive service centers. Operators compose multi-agent workflows visually in a browser, and customers interact with those workflows through a real-time voice session powered by LiveKit and OpenAI.

**Status:** Working — voice sessions functional end-to-end.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Setup — Local Development](#setup--local-development)
- [Launching a Workflow](#launching-a-workflow)
- [Setup — Docker (all services)](#setup--docker-all-services)
- [Environment Variables](#environment-variables)
- [Component Details](#component-details)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)

---

## Overview

The system has two main concerns:

| Layer | What it does |
|---|---|
| **Voice runtime** | A LiveKit agent worker connects callers to an AI assistant and routes them to the right department based on the active workflow |
| **Workflow builder** | Operators visually create directed graphs of agents and tools; the backend persists graph state (nodes, edges, configs) which the voice worker loads at runtime |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (AgentUi)                    │
│  React + ReactFlow workflow builder  ──►  REST API calls │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP  (port 8000)
┌────────────────────────▼─────────────────────────────────┐
│                  AgentServer (FastAPI)                    │
│  /workflows  /agents  /tools  /edges  /positions         │
│       │                                                  │
│  SQLModel ORM  ──►  PostgreSQL (port 5432)               │
│  Redis cache   ──►  Redis      (port 6379)               │
└──────────────────────────────────────────────────────────┘
                         ▲
                         │ WorkflowLoader (reads DB at session start)
┌────────────────────────┴─────────────────────────────────┐
│               LiveKit Worker (voice runtime)              │
│  WorkflowLoader ──► RuntimeWorkflow (agents + edges)     │
│  VoiceOrchidAgent     ──►  OpenAI Realtime API           │
└──────────────────────────────────────────────────────────┘
```

Call flow:
1. A LiveKit room is created with metadata `{"workflow_id": "<uuid>"}`.
2. The worker connects, loads the workflow graph from Postgres via `WorkflowLoader`.
3. The `isInitial` agent's instructions, model, and temperature from the builder UI drive the session.
4. Operators use the React UI to define which agents exist, what tools they have, and how they hand off to each other.

---

## Repository Structure

```
VoiceOrchid/
├── AgentServer/                  # Python backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── routers/          # FastAPI route handlers
│   │   │   │   ├── agent.py
│   │   │   │   ├── edge.py
│   │   │   │   ├── position.py
│   │   │   │   ├── tool.py
│   │   │   │   └── workflows.py
│   │   │   ├── exceptions/       # Custom HTTP exception handlers
│   │   │   └── dependencies/     # FastAPI dependency injectors
│   │   ├── application/
│   │   │   ├── facade/           # Multi-service orchestration layer
│   │   │   └── services/         # Business logic per domain entity
│   │   ├── domain/
│   │   │   ├── schema.py         # Pydantic request/response models
│   │   │   └── exceptions/       # Domain-level exception types
│   │   ├── infrastructure/
│   │   │   ├── db/               # SQLModel engine, session, ORM models
│   │   │   ├── repository/       # Data-access objects per entity
│   │   │   └── cache/            # Redis client
│   │   ├── config.py             # Pydantic settings (reads .env.local)
│   │   └── main.py               # FastAPI app factory + middleware
│   ├── agents/
│   │   ├── agents/agent.py       # VoiceOrchidAgent (LiveKit Agent)
│   │   ├── prompts/prompts.py    # System prompt + welcome message
│   │   ├── runtime/              # Workflow → runtime bridge
│   │   │   ├── workflow_loader.py  # Loads workflow graph from Postgres
│   │   │   └── agent_factory.py    # Builds LiveKit Agent from DB config
│   │   └── workers/entrypoint.py # LiveKit worker entry point
│   ├── migrations/               # Alembic migration scripts
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.txt
│
├── AgentUi/agent@ui/             # React frontend
│   ├── src/
│   │   ├── api/                  # Axios API clients (agent, tool, edge, workflow…)
│   │   ├── components/workflow/  # ReactFlow nodes, panels, canvas, toolbar, sidebar
│   │   ├── hooks/workflow/       # useWorkflowBuilder — all canvas state
│   │   ├── pages/                # Route-level page components
│   │   ├── service/              # Higher-level workflow service
│   │   └── ui/                   # Shared UI primitives (inputs, buttons)
│   ├── package.json
│   ├── vite.config.js
│   └── dockerfile
│
├── start.sh                      # Dev launcher (all services or individual)
├── stop.sh                       # Stop all background services
├── docker-compose.yml            # Postgres + Redis + api + client
└── main.py                       # Root placeholder
```

---

## Tech Stack

### Backend (AgentServer)
| Concern | Library |
|---|---|
| Web framework | FastAPI 0.132+ |
| ORM | SQLModel (SQLAlchemy under the hood) |
| Database | PostgreSQL 15 via psycopg3 |
| Migrations | Alembic |
| Caching | Redis 7 |
| Voice runtime | LiveKit Agents SDK 1.4 |
| LLM | OpenAI Realtime API (`gpt-realtime`, voice `marin`) |
| Settings | Pydantic Settings |
| Server | Uvicorn |
| Python | 3.12+ |

### Frontend (AgentUi)
| Concern | Library |
|---|---|
| Framework | React 19 + Vite 7 |
| Workflow canvas | @xyflow/react (ReactFlow) 12 |
| Server state | TanStack Query 5 |
| Routing | React Router 7 |
| HTTP client | Axios |

---

## Data Model

```
WorkFlow
  │  id, name, name_lower (unique), created_at
  ├── Agent  (many)
  │     id, name, workflow_id, isInitial, model, temperature, instructions, guardrails
  │     ├── PositionNode  (1:1)   — x/y canvas coordinates
  │     ├── NodeConfig    (1:1)   — JSONB config blob
  │     └── Tool          (many)
  │           id, name, workflow_id, agent_id, method
  │           ├── PositionNode  (1:1)
  │           └── NodeConfig    (1:1)
  ├── Edge   (many)
  │     id, source (positionnode.id), target (positionnode.id), workflow_id, metadata JSONB
  ├── HandOff (many)
  │     id, name, workflow_id, metadata JSONB
  └── WorkflowSession (many)
        id, workflow_id, room_name, started_at, ended_at, status (active|stopped)
```

`NodeType` enum: `agent | tool`

`PositionNode` has a DB-level check constraint that ensures exactly one of `agent_id` or `tool_id` is non-null (exclusive ownership).

---

## API Reference

Base URL: `http://localhost:8000`

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |

### Workflows `/workflows`
| Method | Path | Description |
|---|---|---|
| POST | `/workflows/` | Create workflow (auto-creates initial agent) |
| GET | `/workflows/get_all` | List all workflows |
| GET | `/workflows/get/{id}` | Get workflow by ID |
| GET | `/workflows/get_by_name/{name}` | Get workflow by name |
| PUT | `/workflows/update/{id}` | Rename workflow |
| DELETE | `/workflows/delete/{id}` | Delete workflow (cascades) |
| GET | `/workflows/get_all_agent/{id}` | List agents with positions |
| GET | `/workflows/get_all_nodes/{id}` | List all agents + tools with positions |
| POST | `/workflows/{id}/launch` | Create LiveKit room, return token + URL |
| POST | `/workflows/{id}/stop` | Delete LiveKit room, mark session stopped |
| GET | `/workflows/{id}/status` | Active session info or `{"status":"idle"}` |
| GET | `/workflows/{id}/sessions` | Session history (newest first) |

### Agents `/agents`
| Method | Path | Description |
|---|---|---|
| POST | `/agents/` | Create agent + node config |
| PUT | `/agents/` | Update agent + node config |
| GET | `/agents/{id}` | Get agent |
| DELETE | `/agents/{id}` | Delete agent |

### Tools `/tools`
| Method | Path | Description |
|---|---|---|
| POST | `/tools/` | Create tool + node config |
| PUT | `/tools/` | Update tool + node config |
| GET | `/tools/{workflow_id}` | List tools for a workflow |
| GET | `/tools/agent/{agent_id}` | List tools for an agent |
| DELETE | `/tools/{tool_id}` | Delete tool |

### Edges `/edges`
| Method | Path | Description |
|---|---|---|
| POST | `/edges/` | Create edge |
| PUT | `/edges/` | Update edge |
| GET | `/edges/{workflow_id}` | List edges for a workflow |
| DELETE | `/edges/{edge_id}` | Delete edge |

### Positions `/positions`
| Method | Path | Description |
|---|---|---|
| PUT | `/positions/` | Update node position (x/y) |

Interactive docs available at `http://localhost:8000/docs` (Swagger UI).

---

## Setup — Local Development

### Quickstart (Makefile — recommended)

**Prerequisites:** Python 3.12+, Node.js 20+, Docker Desktop, [uv](https://github.com/astral-sh/uv)

```bash
cp AgentServer/.env.local.example AgentServer/.env.local
# Fill in LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, OPENAI_API_KEY, POSTGRES_*, JWT_SECRET_KEY
```

Open **four terminals**, one per process:

```bash
# Terminal 1 — infrastructure (Postgres + Redis)
make infra

# Terminal 2 — install deps + apply migrations + start API
make install-api
make migrate
make api

# Terminal 3 — frontend dev server
make install-ui
make ui

# Terminal 4 — LiveKit voice worker  ← REQUIRED for voice sessions
make worker
```

> **The worker must always be running.** It is the process that joins the LiveKit room and speaks. If the worker is not running, the browser will connect and the mic will activate, but the agent will never appear — the session will sit at "Waiting for agent" indefinitely.

Run `make help` to see all available targets.

### All Makefile targets

| Target | Description |
|---|---|
| `make infra` | Start Postgres + Redis in Docker |
| `make infra-down` | Stop Postgres + Redis |
| `make install` | Install all Python + JS dependencies |
| `make migrate` | Apply pending Alembic migrations |
| `make migrate-new MSG="…"` | Generate a new migration |
| `make api` | Start FastAPI with hot-reload on :8000 |
| `make ui` | Start Vite dev server on :5173 |
| `make worker` | Start LiveKit voice worker |
| `make lint` | Run ruff (Python) + eslint (JS) |
| `make test` | Run Python test suite |

---

## Launching a Workflow

Once the full stack is running, you can start a live voice session directly from the browser.

### Steps

1. **Open a workflow** in the builder (navigate to any workflow from the list page).
2. Click the **▶ Launch** button in the top-right corner of the toolbar.
3. **Allow microphone access** when the browser prompts.
4. The voice panel appears at the bottom of the canvas — the agent speaks through your speakers and listens through your mic.
5. Click **■ Stop** (or the Stop button in the panel) to end the session.

### What happens under the hood

```
Browser → POST /workflows/{id}/launch
        ← { room_name, token, livekit_url, session_id }
Browser → Room.connect(livekit_url, token)    # livekit-client
Worker  ← LiveKit dispatches new room job
Worker  → loads workflow from Postgres, starts OpenAI Realtime session
```

### Requirements

- **LiveKit URL + credentials** must be set in `AgentServer/.env.local`:
  ```
  LIVEKIT_URL=wss://your-project.livekit.cloud
  LIVEKIT_API_KEY=your-api-key
  LIVEKIT_API_SECRET=your-api-secret
  ```
- **The voice worker must be running** (`make worker` in a separate terminal). This is the most common reason a session appears to connect but produces no audio — the browser diagnostic strip will show "⏳ Waiting for agent" if the worker is not active.
- A modern browser with microphone support (Chrome / Edge recommended).

### Session History

Each time a workflow is launched a `WorkflowSession` record is persisted. On the **Workflows list page**:

- Each card shows a live status badge — **● Running** (green) or **○ Idle** (grey), polled every 10 seconds.
- Click **History** on any card to open a side drawer listing all past sessions with start time, duration, and status.

---

## Setup — Docker (all services)

```bash
# Fill in env files first:
#   AgentServer/.env.docker  — backend vars
#   AgentUi/agent@ui/.env    — VITE_APP_BASE_URL=http://localhost:8000

docker compose up --build
```

| Service | Port |
|---|---|
| FastAPI backend | 8000 |
| React UI | 5173 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Environment Variables

### Backend — `AgentServer/.env.local`

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | LiveKit server WebSocket URL (`wss://…`) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `OPENAI_API_KEY` | OpenAI API key (used by the realtime voice model) |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_HOST` | PostgreSQL host (e.g. `localhost`) |
| `POSTGRES_PORT` | PostgreSQL port (default `5432`) |
| `REDIS_HOST` | Redis host (optional) |
| `REDIS_PORT` | Redis port (optional, default `6379`) |

### Frontend — `AgentUi/agent@ui/.env`

| Variable | Description |
|---|---|
| `VITE_APP_BASE_URL` | Backend API base URL (e.g. `http://localhost:8000`) |
| `VITE_APP_API_TIMEOUT` | Axios request timeout in ms (optional) |

> **Security note:** Never commit `.env.local` or `.env.docker` files with real credentials.

---

## Component Details

### Voice Agent (`AgentServer/agents/`)

- **`VoiceOrchidAgent`** — subclasses `livekit.agents.Agent`. Accepts `instructions` as a constructor parameter so the voice session is driven by the workflow builder, not hardcoded prompts.
- **`WorkflowLoader`** — reads the full workflow graph (agents, tools, edges) from Postgres at session start. Returns typed `RuntimeWorkflow` / `RuntimeAgent` / `RuntimeEdge` dataclasses consumed by the worker.
- **`AgentFactory`** — builds a `VoiceOrchidAgent` and the OpenAI `RealtimeModel` from a `RuntimeAgent`'s DB config (model, temperature, instructions).
- **`entrypoint`** — the LiveKit worker entry point. On each new room job it parses `workflow_id` from room metadata, loads the matching workflow, and starts the session with the `isInitial` agent's config. Falls back to hardcoded defaults if no workflow ID is present.

### Workflow Builder UI (`AgentUi/agent@ui/src/`)

- Built on **ReactFlow** — operators drag agent nodes and tool nodes onto a canvas and draw edges between them to define handoff paths.
- **`useWorkflowBuilder`** hook centralises all canvas state: nodes, edges, selection, saving, sidebar visibility.
- **Panels** — clicking a node opens a side panel for configuring that agent (model, temperature, instructions, guardrails) or tool (name, HTTP method, endpoint config).
- **Lazy-loaded panels** — `ToolConfigPanel`, `AgentConfigPanel`, and `HandoffPanel` are code-split to keep initial bundle size small.
- All mutations go through the `src/api/` layer which calls the FastAPI backend via Axios.

### FastAPI Backend (`AgentServer/app/`)

Architecture follows a layered pattern:

```
Router → Facade (multi-service) → Service (business logic) → Repository (DB) → SQLModel ORM
```

- **Facades** coordinate multiple services in a single transactional operation (e.g. creating a workflow also creates an initial agent node and its position).
- **Services** contain domain validation and business rules.
- **Repositories** are thin data-access wrappers over SQLModel sessions.
- **`NodeConfig`** stores arbitrary JSONB metadata for each node — this is how the UI persists agent model settings and tool endpoint configs without requiring schema changes.

---

## Roadmap

- [ ] Hosted demo
- [ ] Unit and integration test suite + CI pipeline
- [ ] Workflow versioning and import/export (JSON)
- [ ] Production deployment guide (cloud Postgres, managed Redis, LiveKit Cloud)
- [ ] Multi-agent handoff routing engine (evaluate edge conditions at runtime)
- [ ] HTTP tool registration (convert Tool rows → LiveKit function tools)
- [ ] Authentication and multi-tenant support
- [ ] Workflow execution tracing and session replay

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening issues or pull requests. Security vulnerabilities should be disclosed as described in [SECURITY.md](SECURITY.md).

Releases are tracked in [CHANGELOG.md](CHANGELOG.md).

---

## Acknowledgements

- [LiveKit Agents](https://docs.livekit.io/agents/) — real-time voice agent SDK
- [FastAPI](https://fastapi.tiangolo.com/) — async Python web framework
- [SQLModel](https://sqlmodel.tiangolo.com/) — ORM combining SQLAlchemy + Pydantic
- [ReactFlow / @xyflow](https://reactflow.dev/) — graph canvas for the workflow builder
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — voice-capable LLM backend
