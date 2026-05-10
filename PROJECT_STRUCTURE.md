# Project Structure Guide

## Directory Organization

```
VoiceOrchid/
├── AgentServer/                    # Backend FastAPI application
│   ├── app/
│   │   ├── core/                  # Core infrastructure (NEW)
│   │   │   ├── __init__.py
│   │   │   ├── constants.py       # Enums, constants, roles, permissions
│   │   │   ├── tenancy.py         # Multi-tenant context management
│   │   │   ├── security.py        # JWT, RBAC, encryption
│   │   │   ├── settings.py        # Configuration management
│   │   │   ├── logging.py         # Structured logging
│   │   │   ├── exceptions.py      # Custom exceptions
│   │   │   ├── rate_limiter.py    # Rate limiting
│   │   │   ├── feature_flags.py   # Feature toggle management
│   │   │   ├── pagination.py      # Pagination utilities
│   │   │   ├── background_jobs.py # Async task system
│   │   │   └── versioning.py      # API versioning
│   │   │
│   │   ├── api/
│   │   │   ├── middleware.py      # Request middleware (ENHANCED)
│   │   │   ├── routers/           # API endpoints
│   │   │   ├── exceptions/        # Exception handlers
│   │   │   └── dependencies/      # Dependency injection
│   │   │
│   │   ├── application/
│   │   │   ├── services/          # Business logic
│   │   │   │   ├── auth_service.py       # (NEW) Auth operations
│   │   │   │   ├── audit_log_service.py  # (NEW) Audit logging
│   │   │   │   ├── workflow_service.py
│   │   │   │   ├── agent_service.py
│   │   │   │   ├── tool_service.py
│   │   │   │   └── ...
│   │   │   └── facade/            # High-level operations
│   │   │
│   │   ├── domain/
│   │   │   ├── schema.py          # Pydantic models
│   │   │   └── exceptions/
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── db/
│   │   │   │   ├── models.py           # SQLModel definitions (UPDATED - multi-tenant)
│   │   │   │   ├── auth_models.py      # (NEW) Auth models
│   │   │   │   ├── engine.py
│   │   │   │   └── session.py
│   │   │   ├── cache/
│   │   │   │   └── redis_client.py
│   │   │   └── repository/        # Data access layer
│   │   │
│   │   ├── main.py                # Application factory (ENHANCED)
│   │   └── config.py              # (DEPRECATED - use core/settings.py)
│   │
│   ├── migrations/                # Alembic database migrations
│   ├── tests/                     # Test suite (NEW)
│   ├── Dockerfile                 # Development Dockerfile
│   ├── Dockerfile.prod            # (NEW) Production multi-stage build
│   ├── pyproject.toml             # Dependencies (UPDATED)
│   └── requirements.txt
│
├── AgentUi/                       # Frontend React application
│   └── agent@ui/
│
├── docker-compose.yml             # Development compose
├── docker-compose.prod.yml        # (NEW) Production compose
├── ARCHITECTURE.md                # (NEW) Architecture documentation
├── PROJECT_STRUCTURE.md           # (NEW) This file
├── SECURITY.md                    # Security best practices
├── CONTRIBUTING.md                # Contribution guide
└── README.md                      # Project overview
```

## New Core Components (app/core/)

### constants.py
- `Environment`: DEVELOPMENT, STAGING, PRODUCTION, TESTING
- `UserRole`: ADMIN, TENANT_ADMIN, OPERATOR, AGENT, SERVICE_ACCOUNT
- `PermissionScope`: Fine-grained permissions
- `AuditAction`: CREATE, READ, UPDATE, DELETE, EXECUTE, etc.

### tenancy.py
- `TenantContext`: Per-request tenant/user/request-id management
- Context variables using Python's contextvars
- Automatic propagation through async code

### security.py
- `JWTManager`: Token creation and validation
- `RBACManager`: Role-based access control
- `EncryptionManager`: Password hashing and verification

### settings.py
- Environment-aware configuration
- Singleton pattern for settings access
- Database and Redis URL builders
- Feature flags storage

### logging.py
- `StructuredLogger`: JSON-formatted logging
- `JSONFormatter`: Structured log output
- Automatic context injection (request_id, tenant_id, user_id)

### exceptions.py
- `ApplicationError`: Base exception class
- `ValidationFailedError`, `NotFoundError`, `UnauthorizedError`, etc.
- Global exception handlers
- Standardized error response format

### rate_limiter.py
- `RateLimiter`: In-memory rate limiting
- Decorator-based endpoint protection
- Configurable limits and time windows

### feature_flags.py
- `FeatureFlagManager`: Feature toggle management
- Enable/disable features without code changes
- Common flags pre-defined

### pagination.py
- `PaginationParams`: Request parameters
- `PaginatedResponse`: Generic paginated response
- Page calculation utilities

### background_jobs.py
- `BackgroundTask`: Task model and status tracking
- `TaskQueue`: Simple task queue
- Task registration and enqueueing

### versioning.py
- `APIVersion`: Version constants
- `create_versioned_router()`: Create versioned endpoints
- Deprecation decorators

## Enhanced Infrastructure Layer

### Database Models (UPDATED)
All models now include:
- `tenant_id`: Foreign key to tenant table
- `created_at` & `updated_at`: Audit timestamps
- `created_by` & `updated_by`: User tracking (where applicable)
- Updated unique constraints to include tenant_id

### Auth Models (NEW)
- `Tenant`: Multi-tenant organization
- `User`: User accounts with credentials
- `AuditLog`: Audit trail for compliance

### Middleware (ENHANCED)
- `RequestIdMiddleware`: X-Request-ID tracking
- `TenantIsolationMiddleware`: Extract tenant context
- `RequestTimingMiddleware`: Track request duration
- `SecurityHeadersMiddleware`: Security header injection
- `ErrorHandlingMiddleware`: Centralized error handling

## Service Layer (UPDATED)

### auth_service.py (NEW)
- User creation and authentication
- Token generation and validation
- User lookup

### audit_log_service.py (NEW)
- Log audit events
- Query audit history
- Compliance reporting

### Other Services (UPDATED)
- All services now filtered by tenant_id
- RBAC checks before operations
- Audit logging integration

## API Layer

All endpoints now:
- Extract tenant_id from request
- Validate user permissions
- Log operations
- Return paginated results
- Include correlation IDs in responses

## Testing (NEW)

```
tests/
├── unit/
│   ├── core/
│   ├── application/
│   └── infrastructure/
├── integration/
├── e2e/
└── fixtures/
    └── conftest.py
```

## Configuration Files

### .env.local (Example)
```bash
ENVIRONMENT=development
POSTGRES_HOST=localhost
POSTGRES_USER=devuser
POSTGRES_PASSWORD=devpass
JWT_SECRET_KEY=your-secret-key-change-this
MULTI_TENANCY_ENABLED=true
```

### Docker Files
- `Dockerfile`: Development image with auto-reload
- `Dockerfile.prod`: Production multi-stage build

### Docker Compose
- `docker-compose.yml`: Development setup
- `docker-compose.prod.yml`: Production setup with security

## Migration Path

### From Old to New Structure

1. **Old Models** → **New Models**
   - Add `tenant_id` to all tables
   - Add audit columns
   - Update unique constraints

2. **Old Config** → **New Settings**
   - Migrate from basic env vars to core/settings.py
   - Use settings object everywhere

3. **Old Logging** → **Structured Logging**
   - Replace print statements with logger
   - Use structured logging format

4. **Old Auth** → **New Auth System**
   - Implement JWT-based authentication
   - Add user and tenant management

5. **Old Middleware** → **New Middleware**
   - Add new middleware stack to main.py
   - Implement tenant isolation

## Key Design Patterns

### 1. Dependency Injection
```python
# Services injected via FastAPI dependencies
@router.post("/workflows")
async def create_workflow(
    workflow: WorkflowCreate,
    service: WorkflowService = Depends(get_workflow_service)
):
    ...
```

### 2. Context Management
```python
# Tenant context automatically set by middleware
# Access anywhere in the request
tenant_id = TenantContext.get_tenant_id()
```

### 3. Repository Pattern
```python
# All data access through repositories
# Repositories handle tenant filtering
repository.get_workflow(workflow_id)  # Filters by tenant_id automatically
```

### 4. Service Layer
```python
# Business logic in services
# Services use repositories and other services
# Services are framework-agnostic
```

### 5. Schema Validation
```python
# Request/response validation with Pydantic
# Automatic serialization/deserialization
```

## Performance Considerations

1. **Database Indexes**
   - tenant_id indexed in all multi-tenant tables
   - Composite indexes for common queries

2. **Connection Pooling**
   - PG connection pool configured in settings
   - Configurable pool size and overflow

3. **Caching**
   - Redis for session/token caching
   - Tenant-scoped cache keys

4. **Query Optimization**
   - Use `select` eager loading where appropriate
   - Pagination for large result sets

## Security Considerations

1. **Authentication**
   - JWT tokens with expiration
   - Refresh token support
   - Token in Authorization header

2. **Authorization**
   - Role-based access control
   - Permission checks before operations
   - Resource-level access control

3. **Data Protection**
   - Tenant isolation at DB level
   - Password hashing with salt
   - Sensitive fields encrypted

4. **Audit Trail**
   - All operations logged
   - User and IP address tracking
   - Compliance retention

5. **API Security**
   - CORS configured
   - Rate limiting
   - Security headers
   - Input validation

## Next Steps

1. Create database migrations for new tables
2. Implement test suite
3. Add API documentation (OpenAPI)
4. Set up CI/CD pipeline
5. Configure monitoring and alerting
6. Set up production deployment
