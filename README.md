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

The system has three main concerns:

| Layer | What it does |
|---|---|
| **Voice runtime** | A LiveKit agent worker connects callers to an AI assistant, collects VIN, and routes them to the right department |
| **Workflow builder** | Operators visually create directed graphs of agents and tools; the backend persists graph state (nodes, edges, configs) |
| **Car data (MCP)** | A FastMCP server exposes SQLite-backed car lookup tools (VIN → make/model/year) that the agents can call |

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
                         │ LiveKit Agents SDK
┌────────────────────────┴─────────────────────────────────┐
│               LiveKit Worker (voice runtime)              │
│  CarServiceAssistant  ──►  OpenAI Realtime API           │
│                       ──►  MCP tools / FastAPI APIs      │
└──────────────────────────────────────────────────────────┘
                         ▲
                         │ FastMCP (stdio / HTTP)
┌────────────────────────┴─────────────────────────────────┐
│                  cars_mcp  (MCP server)                  │
│  greet(), VIN lookup …  ──►  SQLite car database         │
└──────────────────────────────────────────────────────────┘
```

Call flow:
1. A customer calls the LiveKit room.
2. The worker connects, greets the customer, and asks for their VIN.
3. The agent looks up the VIN via MCP tools, then answers questions or routes the caller to the right department.
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
├── cars_mcp/                     # FastMCP server
│   ├── server.py                 # MCP tool definitions
│   └── db/                       # SQLModel engine + Car model
│
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
| Build | Vite |

### MCP Server (cars_mcp)
| Concern | Library |
|---|---|
| MCP framework | FastMCP |
| Database | SQLite via SQLModel |

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

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (for Postgres + Redis)

### 1. Start infrastructure services

```bash
docker compose up -d postgres redis
```

### 2. Backend API

```bash
cd AgentServer

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file (see Environment Variables section)
cp .env.local.example .env.local   # or create manually
# Edit .env.local with your credentials

# Run database migrations
alembic upgrade head

# Start the API server
python main.py
```

API available at `http://localhost:8000` — Swagger docs at `http://localhost:8000/docs`.

### 3. Frontend UI

```bash
cd AgentUi/agent@ui

npm install

# Set backend URL
echo "VITE_APP_BASE_URL=http://localhost:8000" > .env

npm run dev
```

UI available at `http://localhost:5173`.

### 4. LiveKit Voice Worker

```bash
cd AgentServer
source .venv/bin/activate

python agents/workers/entrypoint.py dev
```

The worker registers with your LiveKit Cloud project and picks up new room jobs automatically.

### 5. MCP Server (optional)

```bash
cd cars_mcp
python server.py
```

---

## Setup — Docker (all services)

```bash
# Copy and fill in the env files first
# AgentServer/.env.docker  — backend vars
# AgentUi/agent@ui/.env    — VITE_APP_BASE_URL=http://localhost:8000

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

- **`CarServiceAssistant`** — subclasses `livekit.agents.Agent`, initialized with a system prompt that defines it as an auto service center call center manager.
- **`entrypoint`** — the LiveKit worker entry point. On each new room job it:
  1. Connects to the room and waits for a participant.
  2. Initializes an OpenAI Realtime session (`gpt-realtime`, voice `marin`, temperature 0.7, audio+text modalities).
  3. Starts an `AgentSession` and sends the welcome message.
- **System prompt** — instructs the agent to collect the caller's VIN, look up their profile, answer questions, and route to the correct department.
- **Welcome message** — asks for the VIN or offers to create a new profile.

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

- **Facades** (`workflow_facade`, `agent_facade`, `tool_facade`) coordinate multiple services in a single transactional operation (e.g. creating a workflow also creates an initial agent node and its position).
- **Services** contain domain validation and business rules.
- **Repositories** are thin data-access wrappers over SQLModel sessions.
- **`NodeConfig`** stores arbitrary JSONB metadata for each node — this is how the UI persists agent model settings and tool endpoint configs without requiring schema changes.

### MCP Server (`cars_mcp/`)

A **FastMCP** server that exposes tools the voice agent can call:
- `greet(name)` — basic greeting tool (placeholder, demonstrates the pattern).
- Car lookup tools backed by a SQLite database with a `Car` model (VIN, make, model, year).

Add new tools by decorating Python functions with `@mcp.tool` in `cars_mcp/server.py`.

---

## Roadmap

- [ ] Hosted demo
- [ ] Unit and integration test suite + CI pipeline
- [ ] Workflow versioning and import/export (JSON)
- [ ] Production deployment guide (cloud Postgres, managed Redis, LiveKit Cloud)
- [ ] Additional MCP tools (appointment booking, parts lookup, service history)
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
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP server framework
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — voice-capable LLM backend
