# Migration Guide: Legacy to Production-Grade Multi-Tenant Architecture

## Overview
This guide walks through the process of migrating the existing VoiceOrchid codebase to the new production-grade, multi-tenant architecture.

## Phase 1: Database Preparation (Week 1)

### Step 1: Create Authentication Tables
```bash
alembic revision --autogenerate -m "Add authentication tables"
```

This migration will add:
- `tenant` table
- `user` table
- `audit_log` table

### Step 2: Add Tenant ID to Existing Tables
```bash
alembic revision --autogenerate -m "Add tenant_id to workflow tables"
```

This migration will add:
- `tenant_id` to `workflow`, `agent`, `tool`, `edge`, `handoff`, `positionnode`, `nodeconfig`
- Update unique constraints to include tenant_id
- Add timestamps and user tracking

### Step 3: Populate Tenant Data
Create a one-time migration script:
```python
# migrations/versions/xxx_populate_tenant_data.py
from alembic import op
from sqlalchemy import text
from uuid import uuid4

def upgrade():
    # Create default tenant for existing data
    default_tenant_id = str(uuid4())
    
    op.execute(text(f"""
        INSERT INTO tenant (id, name, slug, is_active, created_at, updated_at)
        VALUES ('{default_tenant_id}', 'Default Tenant', 'default', true, now(), now())
    """))
    
    # Update all existing workflows with default tenant
    op.execute(text(f"""
        UPDATE workflow SET tenant_id = '{default_tenant_id}'
    """))
```

## Phase 2: Code Updates (Week 2-3)

### Step 1: Update Configuration
```bash
# Old way
export POSTGRES_USER=devuser
export POSTGRES_PASSWORD=devpass

# New way - use .env.local with all settings
cp .env.example .env.local
```

### Step 2: Update Main Application
The `app/main.py` has been updated with:
- New middleware stack
- Enhanced exception handling
- Better logging
- Health check endpoints

No action needed - already done!

### Step 3: Update Services
All existing services in `app/application/services/` need tenant isolation:

**Before:**
```python
class WorkflowService:
    def get_workflow(self, workflow_id):
        return self.workflow_repository.get_workflow(workflow_id)
```

**After:**
```python
class WorkflowService:
    def get_workflow(self, workflow_id):
        tenant_id = TenantContext.get_tenant_id()
        return self.workflow_repository.get_workflow(workflow_id, tenant_id)
```

### Step 4: Update Repositories
All repository methods should filter by tenant:

**Before:**
```python
def get_workflow(self, workflow_id):
    return self.session.query(WorkFlow).filter(WorkFlow.id == workflow_id).first()
```

**After:**
```python
def get_workflow(self, workflow_id, tenant_id=None):
    if tenant_id is None:
        tenant_id = TenantContext.get_tenant_id()
    
    return self.session.query(WorkFlow).filter(
        WorkFlow.id == workflow_id,
        WorkFlow.tenant_id == tenant_id
    ).first()
```

## Phase 3: Frontend Updates (Week 3)

### Step 1: Add Tenant Header
All API requests must include the tenant ID:

```javascript
// Before
const response = await api.get('/workflows');

// After
const response = await api.get('/workflows', {
    headers: {
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
    }
});
```

### Step 2: Update API Client
Update `src/api/client.jsx`:
```javascript
export const createApiClient = (token, tenantId) => {
    return axios.create({
        baseURL: '/api/v1',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
        }
    });
};
```

### Step 3: Add Authentication UI
Create login/signup pages:
- User registration
- JWT token storage
- Token refresh mechanism

## Phase 4: Testing (Week 4)

### Step 1: Unit Tests
```bash
pytest tests/unit/ -v
```

### Step 2: Integration Tests
```bash
pytest tests/integration/ -v
```

### Step 3: End-to-End Tests
```bash
pytest tests/e2e/ -v
```

### Step 4: Manual Testing
- Create test tenant
- Create test users with different roles
- Test workflow CRUD operations
- Verify audit logging
- Test rate limiting

## Phase 5: Deployment (Week 4-5)

### Step 1: Backup Production Database
```bash
pg_dump -U production_user production_db > backup.sql
```

### Step 2: Run Migrations
```bash
alembic upgrade head
```

### Step 3: Deploy New Code
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Step 4: Verify Health
```bash
curl http://production-api:8000/health/ready
```

## Breaking Changes

### API Changes

**Workflows Endpoint** (Now tenant-scoped):
```
GET /api/v1/workflows
  Headers: X-Tenant-ID: {tenant_id}, Authorization: Bearer {token}
```

**New Endpoints**:
```
POST   /api/v1/tenants              # Create tenant
GET    /api/v1/tenants/{id}         # Get tenant
POST   /api/v1/users                # Create user
POST   /api/v1/auth/login           # Login
POST   /api/v1/auth/refresh         # Refresh token
GET    /api/v1/audit-logs           # View audit logs
```

### Database Changes

All tables now require:
- `tenant_id` (foreign key)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Configuration Changes

New required settings:
```
JWT_SECRET_KEY                  # For token signing
MULTI_TENANCY_ENABLED=true      # Multi-tenant mode
AUDIT_LOG_ENABLED=true          # Enable audit logging
```

## Rollback Plan

If issues occur:

### Option 1: Rollback Migrations
```bash
alembic downgrade -1
```

### Option 2: Restore from Backup
```bash
psql -U production_user production_db < backup.sql
```

### Option 3: Blue-Green Deployment
Keep previous version running and switch back if needed.

## Performance Considerations

1. **Database Indexes**: New indexes on `tenant_id` improve query performance
2. **Tenant Isolation**: Smaller query result sets per tenant
3. **Caching**: Redis caching for tenant metadata

## Monitoring Post-Migration

Watch for:
- Slow queries - Check new indexes
- Failed requests - Review error logs
- High latency - Check database connection pool
- Memory usage - Redis and cache behavior

## Common Issues

### Issue 1: "Tenant ID not found"
**Solution**: Ensure `X-Tenant-ID` header is included in all requests

### Issue 2: "Tenant mismatch" errors
**Solution**: Verify user belongs to tenant they're accessing

### Issue 3: Audit logs not appearing
**Solution**: Ensure `AUDIT_LOG_ENABLED=true` in environment

### Issue 4: Rate limiting too strict
**Solution**: Adjust `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_PERIOD_SECONDS`

## Timeline Summary

| Phase | Duration | Tasks |
|-------|----------|-------|
| Preparation | 1 week | Schema changes, data migration |
| Development | 2 weeks | Code updates, testing |
| Frontend | 1 week | UI updates, integration |
| Testing | 1 week | Comprehensive testing |
| Deployment | 1-2 days | Production rollout |

**Total: ~5 weeks**

## Support

For questions or issues during migration:
1. Check the ARCHITECTURE.md for detailed explanations
2. Review test examples in tests/
3. Check logs for specific error messages
4. Refer to security best practices in SECURITY.md
