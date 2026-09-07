# VoiceOrchid Production Architecture Guide

## Overview

VoiceOrchid has been restructured for production-grade, multi-tenant enterprise deployment. This document outlines the new architecture, components, and best practices.

## Architecture Layers

### 1. **Core Layer** (`app/core/`)
Fundamental infrastructure components:
- **`constants.py`**: Enumerations for roles, permissions, and audit actions
- **`tenancy.py`**: Multi-tenant context management
- **`security.py`**: JWT, RBAC, and encryption utilities
- **`settings.py`**: Enhanced configuration management (environment-aware)
- **`logging.py`**: Structured JSON logging with correlation IDs
- **`exceptions.py`**: Standardized error handling
- **`rate_limiter.py`**: API rate limiting
- **`feature_flags.py`**: Feature flag management
- **`pagination.py`**: Standardized pagination utilities
- **`versioning.py`**: API version management

### 2. **Infrastructure Layer** (`app/infrastructure/`)
- **`db/`**: Database models and connections
  - `models.py`: Core workflow/agent/tool models (now with tenant_id)
  - `auth_models.py`: Authentication/authorization models (Tenant, User, AuditLog)
  - `engine.py`: Database engine and session management
  - `session.py`: Database session factory

- **`cache/`**: Caching layer
  - `redis_client.py`: Redis connection and utilities

- **`repository/`**: Data access layer
  - All repositories implement tenant isolation

### 3. **Domain Layer** (`app/domain/`)
- `schema.py`: Pydantic models and validation schemas
- `exceptions/`: Domain-specific exceptions

### 4. **Application Layer** (`app/application/`)
- **`services/`**: Business logic
  - `auth_service.py`: Authentication and user management
  - `workflow_service.py`: Workflow operations
  - `agent_service.py`: Agent operations
  - `tool_service.py`: Tool operations
  - `audit_log_service.py`: Audit trail management
  
- **`facade/`**: High-level operations combining multiple services

### 5. **API Layer** (`app/api/`)
- **`routers/`**: Endpoint definitions
  - All endpoints include tenant isolation and RBAC checks
  
- **`middleware.py`**: Cross-cutting concerns
  - Request ID tracking
  - Tenant isolation middleware
  - Security headers
  - Request timing
  - Error handling

- **`dependencies/`**: Dependency injection
  - Service instantiation
  - Database session injection

- **`exceptions/`**: HTTP exception handlers

## Multi-Tenancy Implementation

### Tenant Isolation Strategy

1. **Context-Based Isolation**
   - `TenantContext` manages tenant_id, user_id, and request_id per request
   - Middleware extracts tenant_id from headers (`X-Tenant-ID`)
   - All queries automatically filtered by tenant_id

2. **Database-Level Isolation**
   - Every table has `tenant_id` foreign key
   - Unique constraints include tenant_id
   - Cascade delete on tenant deletion

3. **Query Filters**
   - All repository methods filter by current tenant_id
   - Prevents cross-tenant data leakage

### Adding Tenant Isolation to New Resources

```python
# In models.py
class MyResource(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(sa_column=Column(ForeignKey("tenant.id", ondelete="CASCADE")))
    # ... other fields

# In service
def get_resource(self, resource_id: UUID) -> MyResource:
    tenant_id = TenantContext.get_tenant_id()
    return self.db.query(MyResource).filter(
        MyResource.id == resource_id,
        MyResource.tenant_id == tenant_id  # Automatic tenant isolation
    ).first()
```

## Authentication & Authorization

### User Roles
- **ADMIN**: Full system access
- **TENANT_ADMIN**: Tenant-level administration
- **OPERATOR**: Workflow management and execution
- **AGENT**: Read-only access
- **SERVICE_ACCOUNT**: Automated access

### Permission System
```python
from app.core.constants import PermissionScope, UserRole
from app.core.security import RBACManager

# Check permission
if not RBACManager.has_permission(user_role, PermissionScope.WORKFLOW_CREATE):
    raise ForbiddenError("Insufficient permissions")
```

### JWT Tokens
```python
# Create token
token = auth_service.create_access_token(
    user_id=user.id,
    tenant_id=tenant.id,
    role=user.role
)

# Verify token
claims = jwt_manager.decode_token(token)
```

## Logging & Observability

### Structured Logging
All logs are JSON-formatted with context:
```json
{
  "timestamp": "2024-05-10T10:30:00.000Z",
  "level": "INFO",
  "message": "Workflow created",
  "request_id": "req-123",
  "tenant_id": "tenant-456",
  "user_id": "user-789"
}
```

### Using Logger
```python
from app.core.logging import get_logger

logger = get_logger(__name__)
logger.info("User action", user_id=user.id, action="create_workflow")
```

### Audit Logging
```python
from app.application.services.audit_log_service import AuditLogService
from app.core.constants import AuditAction

audit_service.log_action(
    action=AuditAction.CREATE,
    resource_type="workflow",
    resource_id=workflow.id,
    details={"name": workflow.name}
)
```

## Rate Limiting

### Configuration
```python
# In .env.local
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD_SECONDS=60
```

### Usage
```python
from app.core.rate_limiter import rate_limit

@router.post("/workflows")
@rate_limit(limit=10, window=60)  # 10 requests per minute
async def create_workflow(request: Request, ...):
    ...
```

## Feature Flags

### Configuration
```python
# In settings
FEATURE_FLAGS = {
    "multi_tenancy": True,
    "audit_logging": True,
    "workflow_versioning": False,
}
```

### Usage
```python
from app.core.feature_flags import get_feature_flag_manager

manager = get_feature_flag_manager()
if manager.is_enabled("workflow_versioning"):
    # New feature code
    ...
```

## API Versioning

### Version Support
- `/api/v1/` - Current stable version
- `/api/v2/` - Next generation (planned)

### Creating Versioned Endpoints
```python
from app.core.versioning import create_versioned_router

router = create_versioned_router(
    version="v1",
    prefix="/workflows",
    tags=["workflows"]
)

@router.get("/")
async def list_workflows():
    ...
```

## Error Handling

### Using Custom Exceptions
```python
from app.core.exceptions import (
    NotFoundError,
    ForbiddenError,
    ValidationFailedError,
)

if not workflow:
    raise NotFoundError("Workflow not found", resource_type="workflow")

if not has_permission:
    raise ForbiddenError("You don't have permission to delete this workflow")
```

### Error Response Format
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Workflow not found",
    "details": {"resource_type": "workflow"},
    "request_id": "req-123",
    "timestamp": "2024-05-10T10:30:00.000Z"
  }
}
```

## Configuration Management

### Environment Variables

```bash
# Application
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=appuser
POSTGRES_PASSWORD=secure-password
POSTGRES_DB=voiceorchid

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis-password

# Security
JWT_SECRET_KEY=your-secret-key-min-32-chars
JWT_EXPIRE_MINUTES=30

# Multi-Tenancy
MULTI_TENANCY_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD_SECONDS=60

# Audit Logging
AUDIT_LOG_ENABLED=true

# Features
ENABLE_METRICS=true
ENABLE_TRACING=true
```

## Deployment

### Using Docker Compose (Production)
```bash
# Copy environment template and fill in real secrets
# (JWT_SECRET_KEY, POSTGRES_PASSWORD, LIVEKIT_*, OPENAI_API_KEY, VITE_APP_BASE_URL)
cp .env.example .env
docker compose -f docker-compose.prod.yml --env-file .env build
docker compose -f docker-compose.prod.yml --env-file .env run --rm api alembic upgrade head

# Start services (api, worker, client, postgres, redis)
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Check health
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
curl http://localhost:8000/health/live

# Confirm the voice worker registered with LiveKit
docker compose -f docker-compose.prod.yml logs -f worker
```

The `api` service only serves the HTTP API — realtime voice sessions require the
separate `worker` service (`agents/workers/entrypoint.py`), which connects out to
LiveKit Cloud and joins rooms as they're created. Both `api` and `worker` need
`LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`; only `worker` needs
`OPENAI_API_KEY`. `JWT_SECRET_KEY` and `POSTGRES_PASSWORD` have no default in
production compose — the stack refuses to start without them set.

The `client` service builds a static production bundle (Vite build served by
nginx, `AgentUi/agent@ui/Dockerfile.prod`) rather than running the Vite dev
server. `VITE_APP_BASE_URL` is baked in at build time, so set it to the API's
public URL before building — changing it later requires a rebuild.

### Health Checks
- `/health` - Basic health check
- `/health/ready` - Readiness probe (Kubernetes)
- `/health/live` - Liveness probe (Kubernetes)

## Database Migrations

### Creating New Migrations
```bash
cd AgentServer
alembic revision --autogenerate -m "Add tenant_id to workflows"
alembic upgrade head
```

## Testing

### Test Structure
```
tests/
├── unit/
├── integration/
├── e2e/
└── fixtures/
```

### Running Tests
```bash
pytest tests/ -v
pytest tests/unit/ -v --cov=app
```

## Security Best Practices

1. **Always use HTTPS** in production
2. **Set strong JWT secret** (minimum 32 characters)
3. **Enable CORS** only for trusted origins
4. **Rotate secrets** regularly
5. **Use strong database passwords**
6. **Enable audit logging** for compliance
7. **Implement rate limiting** for API protection
8. **Keep dependencies updated**

## Monitoring & Alerting

### Metrics to Track
- Request latency
- Error rate
- Database connection pool usage
- Redis memory usage
- Background job queue depth
- Tenant-specific usage

### Logging Strategy
- Structured JSON logs for parsing
- Request correlation IDs for tracing
- Audit logs for compliance
- Separate logs for different severity levels

## Scaling Considerations

1. **Horizontal Scaling**
   - Stateless API instances
   - Shared PostgreSQL database
   - Shared Redis cache

2. **Database**
   - Connection pooling (PgBouncer)
   - Read replicas for reporting
   - Regular backups

3. **Caching**
   - Redis cluster for high availability
   - Tenant-scoped cache keys
   - TTL management

4. **Load Balancing**
   - Round-robin across API instances
   - Session affinity if needed
   - Health check configuration

## Migration from Legacy System

### Key Changes
1. Add tenant_id to all existing workflows
2. Create tenant records for each organization
3. Create user records with appropriate roles
4. Update client headers to include tenant_id
5. Enable audit logging

### Gradual Migration
- Support both old and new authentication temporarily
- Feature flag for new features
- Monitor for breaking changes

## Support & Documentation

- API Documentation: `/api/docs` (development only)
- Architecture Decisions: See ADR files
- Troubleshooting: See TROUBLESHOOTING.md
- Contributing: See CONTRIBUTING.md
