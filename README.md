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
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Setup — Local Development](#setup--local-development)
- [Automation Scripts](#automation-scripts)
- [Launching a Workflow](#launching-a-workflow)
- [Setup — Docker (all services)](#setup--docker-all-services)
- [Environment Variables](#environment-variables)
- [Production Deployment (AWS)](#production-deployment-aws)
- [Cost Analysis](#cost-analysis)
- [Component Details](#component-details)
- [Security](#security)
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
| **Auth & multi-tenancy** | Every builder action requires a signed-in user (JWT). Each workflow/agent/tool belongs to a tenant, so operators from different organizations sharing one deployment can't see or edit each other's data — see [Authentication](#authentication) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (AgentUi)                    │
│  Sign-in page  ──►  JWT stored in localStorage            │
│  React + ReactFlow workflow builder  ──►  REST API calls │
│  (every request sends Authorization: Bearer <jwt>)        │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP  (port 8000)
┌────────────────────────▼─────────────────────────────────┐
│                  AgentServer (FastAPI)                    │
│  /auth/login /auth/me /auth/logout   (public / gated)     │
│  /workflows  /agents  /tools  /edges  /positions          │
│       — every route requires a valid JWT, and every       │
│         row is scoped to the caller's tenant_id  —        │
│       │                                                  │
│  SQLModel ORM  ──►  PostgreSQL (port 5432)               │
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
4. Operators use the React UI to define which agents exist, what tools they have, and how they hand off to each other — after signing in; see [Authentication](#authentication).

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
│   │   │   └── repository/       # Data-access objects per entity
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
├── docker-compose.yml            # Postgres + LiveKit + api + client
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

Every `WorkFlow`, `Agent`, `Tool`, `Edge`, `PositionNode`, and `NodeConfig` row also carries a `tenant_id`, pointing at a `Tenant` (which owns `User` accounts). This is what keeps different organizations' data apart on a shared deployment — see [Authentication](#authentication).

---

## Authentication

Every API route except `POST /auth/login` requires a signed-in user — there's no anonymous access to the builder, and (since a later hardening pass) no anonymous access to the voice demo endpoints either.

### Signing in

1. Open the app — you'll land on `/login` if you don't already have a valid session.
2. Enter the email/password for an account created via the bootstrap script (see [Automation Scripts](#automation-scripts) — there's no self-registration page on purpose; this is an internal builder tool).
3. On success, the frontend stores a JWT in `localStorage` and sends it as `Authorization: Bearer <token>` on every request from then on.

### What a login gets you

- **Any signed-in user can do everything** — create, edit, and delete workflows/agents/tools regardless of role. There's a `role` field (`admin`, `tenant_admin`, `operator`, `agent`, `service_account`) and an unused RBAC permission model in the code, but nothing currently checks it; this is a deliberate simplification, not a bug, for a single small-team deployment. See [SECURITY.md](SECURITY.md) for the full reasoning and how to bring role checks back if you need them.
- **Data is scoped to your tenant.** Every workflow/agent/tool you create is tagged with your account's tenant; you'll never see another tenant's data, even by guessing a real ID.
- **Tokens expire** (`JWT_EXPIRE_MINUTES`, default 30 minutes) and can be **revoked immediately** by signing out — logout invalidates every token issued to that account, not just the one used to log out (there's no per-device session tracking).
- **Login is rate-limited** two ways at once: a per-IP cap (`LOGIN_RATE_LIMIT_ATTEMPTS` per `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, default 10/5min) and a per-account lockout (`ACCOUNT_LOCKOUT_THRESHOLD` consecutive failures, default 5, locks for `ACCOUNT_LOCKOUT_DURATION_SECONDS`, default 15min) — a locked account rejects even the correct password until the lock expires.

### Creating the first user

There's no sign-up form. Create your first (and any subsequent) user with:

```bash
cd AgentServer
python scripts/create_user.py --email you@example.com --password 'a-strong-password' \
  --tenant-name "My Company" --tenant-slug my-company --role admin
```

This creates the tenant (if it doesn't already exist) and the user in one step. Run it against whichever database your app is currently pointed at (local `.env.local`, or via `docker exec`/`docker compose run` against a deployed container — see [Automation Scripts](#automation-scripts)).

### Auth endpoints

| Method | Path | Auth required? | Description |
|---|---|---|---|
| POST | `/auth/login` | No | `{email, password}` → `{access_token, user}` |
| GET | `/auth/me` | Yes | Verifies the current token and returns the signed-in user |
| POST | `/auth/logout` | Yes | Revokes every token issued to the current user |

---

## API Reference

Base URL: `http://localhost:8000`

> **All routes below require `Authorization: Bearer <jwt>`** (see [Authentication](#authentication)), except `/health*` and `/auth/login`. In non-production environments, interactive always-current docs are also available at `/api/docs` (Swagger) and `/openapi.json` — disabled in production deliberately, so the tables here are the reference there.

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

Interactive docs available at `http://localhost:8000/api/docs` (Swagger UI) in local/dev — not in production, see the note above.

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
# Terminal 1 — infrastructure (Postgres + LiveKit)
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

> **Faster alternative:** `scripts/local-start.sh` does all four terminals' worth of setup in one command (infra, migrations, API, worker, UI, as background processes with logs in `/tmp/voiceorchid-run`) and `scripts/local-stop.sh` tears it back down. See [Automation Scripts](#automation-scripts).

### All Makefile targets

| Target | Description |
|---|---|
| `make infra` | Start Postgres + LiveKit SFU in Docker |
| `make infra-down` | Stop Postgres + LiveKit SFU |
| `make install` | Install all Python + JS dependencies |
| `make migrate` | Apply pending Alembic migrations |
| `make migrate-new MSG="…"` | Generate a new migration |
| `make api` | Start FastAPI with hot-reload on :8000 |
| `make ui` | Start Vite dev server on :5173 |
| `make worker` | Start LiveKit voice worker |
| `make lint` | Run ruff (Python) + eslint (JS) |
| `make test` | Run Python test suite |

---

## Automation Scripts

Every recurring task — starting the local stack, standing up AWS infrastructure, deploying, creating the first user — has a script. None of them are optional conveniences you need to remember extra steps around; each one is meant to be the *only* thing you run for its job.

### Local development

| Script | What it does |
|---|---|
| `scripts/local-start.sh` | Starts everything: Docker infra (Postgres + LiveKit), applies migrations, then the API, worker, and Vite dev server as background processes. Idempotent — anything already running on its port is left alone, not duplicated. Logs and pidfiles go to `/tmp/voiceorchid-run/`. |
| `scripts/local-stop.sh` | Stops exactly what `local-start.sh` started (api, worker, ui processes, then the infra containers) — data volumes are preserved, not removed. |

```bash
scripts/local-start.sh
# ... work ...
tail -f /tmp/voiceorchid-run/worker.log   # if something's not talking
scripts/local-stop.sh
```

### AWS infrastructure & deployment

| Script | What it does |
|---|---|
| `scripts/provision.sh` | Creates every AWS resource the production host needs — security group, SSH key pair, EC2 instance, Elastic IP — or verifies they already exist. **Idempotent**: re-running it against an already-provisioned setup changes nothing; running it against a blank AWS account builds the whole thing from scratch. Run this once per environment (or never again, if you only ever have the one). |
| `scripts/ec2-start.sh` | Starts the EC2 instance (if stopped) and deploys/redeploys the app onto it: rewrites the `.env` hostnames, rebuilds the containers, restarts everything, waits for Caddy to issue TLS certs. This is what you run for **every deploy**, not just after a stop. |
| `scripts/ec2-stop.sh` | Stops the EC2 instance to pause compute billing. Prints a reminder about the Elastic IP's small ongoing charge while stopped — see [Cost Analysis](#cost-analysis). |

```bash
# First time ever, or setting up a fresh environment:
scripts/provision.sh          # creates the AWS resources
scripts/ec2-start.sh          # deploys the app onto them

# Every subsequent deploy (after pushing new code):
scripts/ec2-start.sh

# End of day / pausing cost:
scripts/ec2-stop.sh
```

`scripts/provision.sh` and `scripts/ec2-*.sh` all default to `REGION=ap-south-1`, but every setting is overridable via environment variables — run `head -30 scripts/provision.sh` to see the full list (region, instance type, volume size, SSH key path, admin CIDR).

### Backend maintenance scripts (`AgentServer/scripts/`)

These are plain Python, run with the backend's virtualenv active and pointed at whichever database you mean to touch:

| Script | What it does | When you need it |
|---|---|---|
| `create_user.py` | Creates a tenant (if it doesn't exist) and a user in one step. | The very first user on a fresh deployment — there's no sign-up page. |
| `backfill_tenant_id.py` | Assigns a tenant to any pre-existing row that predates tenant scoping (`tenant_id IS NULL`). Refuses to run if more than one tenant exists, since it can't know which one owned an orphaned row. | Only relevant if you're running an install that predates multi-tenancy — a fresh install never needs this. |

```bash
cd AgentServer
source .venv/bin/activate

# Create the first user (do this once, right after standing up a new deployment):
python scripts/create_user.py --email you@example.com --password 'a-strong-password' \
  --tenant-name "My Company" --tenant-slug my-company --role admin

# Preview what a tenant backfill would touch before actually running it:
python scripts/backfill_tenant_id.py --tenant-slug my-company --dry-run
python scripts/backfill_tenant_id.py --tenant-slug my-company
```

To run either against a **deployed** (not local) database, use `docker compose run` on the host instead of a local `.venv` — see the exact commands in `ARCHITECTURE.md`'s deployment notes, or:

```bash
ssh -i ~/.ssh/voiceorchid-prod.pem ubuntu@<host>
cd voiceorchid
sudo docker compose -f docker-compose.prod.yml --env-file .env run --rm -w /app -e PYTHONPATH=/app \
  api python scripts/create_user.py --email you@example.com --password '...' --tenant-name "..." --tenant-slug ... --role admin
```

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
| LiveKit SFU | 7880 |

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
| `JWT_SECRET_KEY` | Signs and verifies login tokens — required, no default in production |
| `JWT_EXPIRE_MINUTES` | Access token lifetime (default `30`) |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_PERIOD_SECONDS` | General per-user/IP request cap (default `100`/`60`) |
| `LOGIN_RATE_LIMIT_ATTEMPTS` / `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | Per-IP login attempt cap (default `10`/`300`) |
| `ACCOUNT_LOCKOUT_THRESHOLD` / `ACCOUNT_LOCKOUT_DURATION_SECONDS` | Per-account lockout after N failed logins (default `5`/`900`) |

> Full list, including the ones with sane defaults you'll rarely touch, is in `AgentServer/app/core/settings.py`.

### Frontend — `AgentUi/agent@ui/.env`

| Variable | Description |
|---|---|
| `VITE_APP_BASE_URL` | Backend API base URL (e.g. `http://localhost:8000`) |
| `VITE_APP_API_TIMEOUT` | Axios request timeout in ms (optional) |

> **Security note:** Never commit `.env.local` or `.env.docker` files with real credentials.

---

## Production Deployment (AWS)

The production deployment is a single AWS EC2 instance running the full `docker-compose.prod.yml` stack (API, worker, client, Postgres, self-hosted LiveKit SFU, Caddy as reverse proxy). There's no Kubernetes, no managed database, no CDN — deliberately minimal for a small-team internal tool.

### One-time setup

```bash
scripts/provision.sh    # security group, SSH key, EC2 instance, Elastic IP
```

This is idempotent — see [Automation Scripts](#automation-scripts). It prints next steps for the one-time manual part (installing Docker on a *brand-new* instance, cloning the repo, copying secrets over) since those aren't safely automatable without knowing where your secrets live.

### Every deploy

```bash
scripts/ec2-start.sh
```

Starts the instance if it's stopped, then always redeploys: rewrites `.env` hostnames, rebuilds containers, restarts everything, waits for Caddy to obtain TLS certificates.

### How HTTPS works without a purchased domain

The app is served over HTTPS on hostnames like `app.<dashed-elastic-ip>.sslip.io` — [sslip.io](https://sslip.io) is a free public service that resolves any subdomain of a dashed IP back to that IP, so no DNS registration is needed. Caddy automatically obtains a Let's Encrypt certificate for these hostnames. Browsers require a secure context (`https://`) for microphone access, which is why this exists at all — not for the encryption itself.

Since the instance now has an [Elastic IP](#cost-analysis) attached, these hostnames are **permanent** — they used to change on every stop/start before that.

### If you outgrow this

This setup is intentionally simple, and simple has real limits — it's a good fit until it isn't. Reasons to move past it:
- **More than one instance/replica**: the in-process rate limiter (`app/core/rate_limiter.py`) and the [Cost Analysis](#cost-analysis) below both assume a single process. See `ARCHITECTURE.md`'s Rate Limiting section for the specific scale plan.
- **A managed database**: Postgres currently runs in a container on the same host as everything else — no automated backups, no replica, no separate failure domain. Fine for a demo; a real incident (disk failure, bad migration) loses data with no recovery path beyond whatever manual `pg_dump` you happened to take.
- **A real domain + CDN**: `sslip.io` hostnames work but look unpolished and depend on a third-party service staying up; a purchased domain is a ~$10-15/year cost that removes both concerns.

---

## Cost Analysis

**These are estimates, not a bill.** Actual AWS pricing varies by region/time and changes over time — use the [AWS Pricing Calculator](https://calculator.aws/) for a number you can rely on. Figures below are for the `ap-south-1` (Mumbai) region as of this writing, and were looked up rather than assumed, but treat them as ballpark.

### Fixed infrastructure (AWS)

| Item | Rate | Monthly cost (if running 24/7) |
|---|---|---|
| EC2 `t3.small` (2 vCPU, 2 GiB RAM) | $0.0224/hr | ≈ **$16.35** |
| EBS `gp3` volume, 30 GB | $0.08/GB-month | ≈ **$2.40** |
| Elastic IP | $0.005/hr, flat — same rate whether attached, idle, *or* on a stopped instance | ≈ **$3.65** |
| Data transfer out | ~$0.09/GB after a small free allowance (varies by account age/region) | **Usually negligible** for a low-traffic internal tool — a handful of GB/month at most |
| LiveKit SFU | **$0** — self-hosted in a container on the same instance, not LiveKit Cloud | — |
| Domain / TLS | **$0** — `sslip.io` hostnames + Caddy's automatic Let's Encrypt certs | — |

**≈ $22-23/month baseline if left running continuously.**

### The stop/start tradeoff

Before the Elastic IP was added, stopping the instance overnight/weekends meant paying for EC2 compute only while it ran, EBS storage always (storage bills regardless of running state), and $0 for the IP while stopped (there was no IP at all). **Now**, the Elastic IP bills its flat $0.005/hr whether the instance is running or not — so stopping it still saves the EC2 compute cost, just not quite as much as before, in exchange for a hostname that no longer changes every time you start it back up. If you stop it for, say, 20 hours/day (running ~10hrs/day, ~300hrs/month):

| Item | Cost at ~300hrs/month running |
|---|---|
| EC2 | $0.0224 × 300 ≈ **$6.72** |
| EBS (always billed) | **$2.40** |
| Elastic IP (always billed) | **$3.65** |
| **Total** | **≈ $12.77/month** |

### The variable cost that actually matters: OpenAI Realtime API

Every voice session is a live `gpt-realtime` audio stream, billed per token (roughly 1 token per 100ms of user audio, 1 per 50ms of assistant audio) — not a flat per-minute rate, but it works out to about **$0.05–$0.15 per minute of conversation** with prompt caching in typical use, or noticeably more without it. This is almost certainly the dominant cost driver the moment this gets real usage, not the AWS infrastructure above.

The app already caps exposure to this: `MAX_CONCURRENT_SESSIONS` and `MAX_SESSION_SECONDS` (see [Environment Variables](#environment-variables)) bound how many simultaneous calls and how long each one can run, specifically because this cost is otherwise unbounded per caller.

### Bottom line

For light, single-tenant internal use: **roughly $13-23/month in fixed AWS infrastructure**, depending on whether you stop the instance when idle, **plus OpenAI usage costs that scale with how much anyone actually talks to it** — a handful of test calls a day is a few dollars a month; regular real usage could be the larger line item.

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

## Security

Every route requires authentication, login is doubly rate-limited (per-IP and per-account), tokens are revocable, and each tenant's data is isolated from every other's — see [Authentication](#authentication) for the user-facing summary.

For what's *not* yet hardened — no password strength requirements, containers running as root, no RBAC enforcement beyond "signed in or not" — see [SECURITY.md](SECURITY.md)'s "Known Security Concerns" section. It's written as a running list of tradeoffs and gaps, not a pass/fail audit, and each entry says whether it's fixed, deliberately accepted, or still open.

---

## Roadmap

- [x] Authentication (JWT sign-in, per-account lockout, revocable sessions)
- [x] Multi-tenant data isolation
- [x] Rate limiting (global + login-specific)
- [x] Hosted demo (AWS EC2, `scripts/provision.sh` + `scripts/ec2-start.sh`)
- [x] Production deployment guide (this README + `ARCHITECTURE.md`)
- [ ] Password strength requirements on account creation
- [ ] Non-root containers (`AgentServer/Dockerfile` has no `USER` directive)
- [ ] Unit and integration test suite + CI pipeline
- [ ] Workflow versioning and import/export (JSON)
- [ ] Multi-agent handoff routing engine (evaluate edge conditions at runtime)
- [ ] HTTP tool registration (convert Tool rows → LiveKit function tools)
- [ ] Workflow execution tracing and session replay
- [ ] Managed Postgres + automated backups (currently self-hosted on the same instance, no backup automation)

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
