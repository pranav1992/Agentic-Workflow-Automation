# Security Policy

## Reporting a Vulnerability
If you discover a security issue, please do not open a public issue. Contact the maintainer via their GitHub profile and include a clear description and reproduction steps.

## Supported Versions
This project is in early development. Only the latest commit on the default branch is supported.

## Known Security Concerns

This app started as a demo and picked up real authentication along the
way; some gaps below are leftovers from that path, not new mistakes.
Ranked by how bad it is if left alone, worst first.

### 1. ~~No tenant isolation~~ — FIXED

**Was:** `Tenant`/`tenant_id` columns existed on `Workflow`, `Agent`,
`Tool`, `Edge`, `PositionNode`, `NodeConfig`
(`AgentServer/app/infrastructure/db/models.py`) but nothing filtered by
them. `GET /workflows/get_all` returned every workflow from every tenant
to any authenticated user.

**Fix applied:** every service (`workflow_service.py`, `agent_service.py`,
`tool_service.py`, `edge_service.py`, `position_service.py`,
`node_config_service.py`) now sets `tenant_id` from
`TenantContext.require_tenant_id()` on create, and every repository read/
update/delete filters or verifies it (`app/infrastructure/repository/*`).
A mismatch returns the same 404 as a nonexistent row, so a caller can't
distinguish "not yours" from "doesn't exist" and enumerate other tenants'
IDs. Pre-existing rows (created before this fix, all with `tenant_id
NULL`) were backfilled onto the tenant that actually owned them via
`scripts/backfill_tenant_id.py` — safe only because there was a single
tenant with any data; a multi-tenant backfill would need to be done by
hand per-tenant.

Verified: a second tenant sees an empty workflow list, gets `404` fetching
or deleting the first tenant's workflow by ID (even with the real UUID),
and gets an empty agent list querying that workflow's agents directly —
while the owning tenant's access is unaffected.

**Residual risk:** the fix is per-row filtering, not a database-level
policy (e.g. Postgres RLS) — a future query added directly against the
DB (a script, a new repository method) that forgets to filter by
`tenant_id` reopens this silently, with no test or type system to catch
it. Consider RLS or a lint rule if this deployment ever holds real
multi-tenant customer data.

### 2. ~~Tenant ID from a client-supplied header~~ — FIXED

**Was:** `TenantIsolationMiddleware` (`app/api/middleware.py`) set the
current tenant from the `X-Tenant-ID` request header, which any caller
could set to anything — making #1's fix spoofable even once it existed.

**Fix applied:** `TenantIsolationMiddleware` now decodes the caller's JWT
and reads `tenant_id` from its verified claims; the `X-Tenant-ID` header
is no longer read anywhere.

### 3. No account lockout beyond a per-IP request cap

**What:** `LoginRateLimitMiddleware` limits login *attempts per IP*
(`LOGIN_RATE_LIMIT_ATTEMPTS` / `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, default
10/5min) but there's no per-account lockout, no exponential backoff, and
no alerting. A distributed attacker (many IPs) can still brute-force one
specific account at 10 attempts per IP × however many IPs they control.

**Why it matters:** passwords have no minimum strength requirement either
(see #6), so a brute-forceable account is a real risk, not theoretical.

**Fix:** add a per-`user_id` (or per-email) failure counter alongside the
per-IP one, with a lockout or increasing delay after N consecutive
failures, and log/alert on it via the existing `AuditLogService`.

### 4. JWTs can't be revoked

**What:** there's no token blacklist/allowlist and no `/auth/logout`
endpoint. A JWT is valid for its full lifetime
(`JWT_EXPIRE_MINUTES`, default 30) no matter what happens to the account
afterward — password changed, user deactivated, token stolen.

**Why it matters:** 30 minutes is a short blast radius today, but there's
no mechanism to cut a session short if you needed to (e.g. a leaked
token, an offboarded user). "Sign out" in the frontend only clears
`localStorage` — the token itself is still valid until it expires.

**Fix:** either keep expiry short and accept the tradeoff explicitly, or
add a revocation list (even a simple `revoked_token_jti` table checked in
`get_current_user`) for cases that need immediate effect.

### 5. Containers run as root

**What:** `AgentServer/Dockerfile` (used for both the `api` and `worker`
services in `docker-compose.prod.yml`) has no `USER` directive, so both
run as root inside their containers. Only `Dockerfile.prod` (used for the
static frontend/nginx image) drops to `USER appuser`.

**Why it matters:** a code-execution bug in either service (dependency
vuln, deserialization bug, etc.) hands the attacker root inside that
container — normally not a host compromise on its own, but it removes a
layer of defense-in-depth for no reason.

**Fix:** add a non-root `USER` to `AgentServer/Dockerfile`, matching the
pattern already used in `Dockerfile.prod`.

### 6. No password strength requirements

**What:** `AuthService.create_user`
(`app/application/services/auth_service.py`) hashes and stores whatever
string is passed as a password — no minimum length, complexity, or
common-password check. This only matters today via
`scripts/create_user.py` (there's no self-registration endpoint), but
anything built on top of `create_user` later inherits the same gap.

**Fix:** validate password strength before hashing — even a simple
minimum-length check closes the worst of it.

### 7. Rate limiting is in-process and single-instance only

**What:** documented in detail in
[ARCHITECTURE.md § Rate Limiting](ARCHITECTURE.md#rate-limiting). The
limiter's state is a plain Python `dict` in the API process's memory. It
resets on every restart/deploy, and if the API ever runs as more than one
process or container, each one enforces its own separate allowance — the
real limit becomes `limit × (number of processes)`.

**Why it matters:** fine today (single `uvicorn` process, single
container), actively wrong the moment that changes.

**Fix:** see the "Scale plan" in `ARCHITECTURE.md` — swap to a shared
backend (Redis, e.g. via `slowapi`) before adding `--workers` or scaling
to multiple API containers/replicas.

### 8. `X-Forwarded-For` trust depends on Caddy correctly overwriting it

**What:** `AgentServer/Dockerfile` runs uvicorn with
`--forwarded-allow-ips=*`, which trusts the *entire* `X-Forwarded-For`
chain rather than just Caddy's own hop. This was previously spoofable —
Caddy's default `reverse_proxy` behavior appends to a client-supplied
`X-Forwarded-For` rather than replacing it, so a client could plant a fake
leftmost IP and have it trusted as the "real" caller. `caddy/Caddyfile`
now explicitly overwrites the header
(`header_up X-Forwarded-For {http.request.remote.host}`) for the API
route, closing this — verified against a live spoofing attempt.

**Why it matters if this regresses:** the rate limiter's IP-based
fallback (used for anyone without a valid token, and specifically for
`/auth/login`) keys on this value. If the Caddy config or the
`--forwarded-allow-ips` flag ever changes without keeping both in sync,
this reopens.

**Fix:** none needed right now — just don't remove the `header_up` line
in `Caddyfile` without re-verifying this, and don't add another reverse
proxy in front of Caddy without checking it does the same.

### 9. RBAC scaffolding exists but enforces nothing

**What:** `UserRole`, `PermissionScope`, and `RBACManager`
(`app/core/constants.py`, `app/core/security.py`) define a full
permission model, but nothing calls
`RBACManager.has_permission(...)` — see
[ARCHITECTURE.md § Authentication & Authorization](ARCHITECTURE.md#authentication--authorization).
Any signed-in user, regardless of role, can do everything.

**Why it's here and not higher:** this was a deliberate simplification
for a demo app, not an oversight — flagging it so it isn't mistaken for
real role enforcement by anyone reading the `UserRole` field and assuming
it does something.

**Fix (if ever needed):** wire a `require_permission(scope)` dependency
into `RBACManager` and gate specific mutating routes with it, the way
`require_admin` used to before it was removed.

## Deliberately accepted (not concerns, documented so they aren't "found" again)

- **Voice-demo endpoints require login**, reversing an earlier deliberate
  design (anonymous demo access with spend caps). This was an explicit
  choice, not a regression — see `ARCHITECTURE.md` and commit history
  around the JWT lockdown.
- **Any signed-in user can mutate anything** (#9 above) — explicit
  simplification for a demo app, not a bug.
