
from app.infrastructure.repository.workflow_respository import\
                                                 WorkflowRepository
from app.domain.schema import WorkflowCreate
from app.infrastructure.db.models import WorkFlow
from app.core.tenancy import TenantContext


class WorkflowService:
    def __init__(self, workflow_repository: WorkflowRepository):
        self.workflow_repository = workflow_repository

    def create(self, workflow: WorkflowCreate):
        workflow_model = WorkFlow(
            **workflow.model_dump(), tenant_id=TenantContext.require_tenant_id()
        )
        return self.workflow_repository.create(workflow_model)

    def get_workflow(self, workflow_id):
        return self.workflow_repository.get_workflow(
            workflow_id, TenantContext.require_tenant_id()
        )

    def get_workflow_by_name(self, workflow_name):
        return self.workflow_repository.get_workflow_by_name(
            workflow_name, TenantContext.require_tenant_id()
        )

    def get_all_workflows(self):
        return self.workflow_repository.get_all_workflows(
            TenantContext.require_tenant_id()
        )

    def delete_workflow(self, workflow_id):
        return self.workflow_repository.delete_workflow(
            workflow_id, TenantContext.require_tenant_id()
        )

    def update_workflow(self, workflow_id, workflow):
        return self.workflow_repository.update_workflow(
            workflow_id, workflow, TenantContext.require_tenant_id()
        )
