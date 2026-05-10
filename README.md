# Car Service Voice Assistant

A full-stack platform for building and deploying AI-powered voice agents for automotive service centers. Operators compose multi-agent workflows visually in a browser, and customers interact with those workflows through a real-time voice session powered by LiveKit and OpenAI.

**Status:** Alpha — actively iterating.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Setup — Local Development](#setup--local-development)
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
│  CarServiceAssistant  ──►  OpenAI Realtime API           │
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
CarServiceVoiceAssistant/
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
│   │   ├── agents/agent.py       # CarServiceAssistant (LiveKit Agent)
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
| LLM | OpenAI Realtime API (`gpt-4o-realtime-preview`, voice `marin`) |
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
  └── HandOff (many)
        id, name, workflow_id, metadata JSONB
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

### Quickstart (recommended)

```bash
cp AgentServer/.env.local.example AgentServer/.env.local
# Edit AgentServer/.env.local with your LiveKit + OpenAI credentials

./start.sh        # starts all services
./stop.sh         # stops all services
```

Individual targets:

```bash
./start.sh api      # backend only (also starts Postgres)
./start.sh ui       # frontend only
./start.sh worker   # LiveKit voice worker only
./start.sh infra    # Postgres + Redis only
```

### Manual setup

**Prerequisites:** Python 3.12+, Node.js 20+, Docker & Docker Compose

```bash
# 1. Infrastructure
docker compose up -d postgres redis

# 2. Backend API
cd AgentServer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.local.example .env.local   # fill in credentials
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
# 3. Frontend UI
cd AgentUi/agent@ui
npm install && npm run dev
```

```bash
# 4. LiveKit Voice Worker
cd AgentServer
source .venv/bin/activate
python agents/workers/entrypoint.py dev
```

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

- **`CarServiceAssistant`** — subclasses `livekit.agents.Agent`. Accepts `instructions` as a constructor parameter so the voice session is driven by the workflow builder, not hardcoded prompts.
- **`WorkflowLoader`** — reads the full workflow graph (agents, tools, edges) from Postgres at session start. Returns typed `RuntimeWorkflow` / `RuntimeAgent` / `RuntimeEdge` dataclasses consumed by the worker.
- **`AgentFactory`** — builds a `CarServiceAssistant` and the OpenAI `RealtimeModel` from a `RuntimeAgent`'s DB config (model, temperature, instructions).
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
