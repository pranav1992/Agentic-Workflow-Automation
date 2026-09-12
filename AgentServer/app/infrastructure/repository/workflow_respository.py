from sqlmodel import select
from app.infrastructure.db.models import WorkFlow
from sqlalchemy.exc import IntegrityError, OperationalError
from app.domain.exceptions import DatabaseUnavailableError
from app.domain.exceptions import DuplicateWorkflowError, WorkflowNotFoundError


class WorkflowRepository:
    def __init__(self, session):
        self.session = session

    def create(self, workflow: WorkFlow):
        # preempt duplicate names to return a clean error
        try:
            self.session.add(workflow)
            self.session.flush()
            return workflow
        except IntegrityError:
            self.session.rollback()
            raise DuplicateWorkflowError(workflow.name)
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_workflow(self, workflow_id, tenant_id):
        try:
            workflow = self.session.get(WorkFlow, workflow_id)
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()
        # Same 404 whether the row doesn't exist or belongs to another
        # tenant — distinguishing the two would let a caller enumerate
        # other tenants' workflow IDs.
        if not workflow or workflow.tenant_id != tenant_id:
            raise WorkflowNotFoundError(workflow_id)
        return workflow

    def get_workflow_by_name(self, workflow_name, tenant_id):
        try:
            workflow = self.session.exec(
                select(WorkFlow).where(
                    WorkFlow.name == workflow_name,
                    WorkFlow.tenant_id == tenant_id,
                )
            ).first()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

        if workflow is None:
            raise WorkflowNotFoundError(workflow_name)

        return workflow

    def get_all_workflows(self, tenant_id):
        try:
            return self.session.exec(
                select(WorkFlow).where(WorkFlow.tenant_id == tenant_id)
            ).all()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def delete_workflow(self, workflow_id, tenant_id):
        try:
            workflow = self.session.get(WorkFlow, workflow_id)
            if workflow is None or workflow.tenant_id != tenant_id:
                raise WorkflowNotFoundError(workflow_id)

            self.session.delete(workflow)
            # Do not commit here; caller (facade) controls the transaction
            return workflow
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def update_workflow(self, workflow_id, workflow, tenant_id):
        try:
            existing = self.session.get(WorkFlow, workflow_id)
            if existing is None or existing.tenant_id != tenant_id:
                raise WorkflowNotFoundError(workflow_id)

            self.session.merge(workflow)
            self.session.commit()
            self.session.refresh(workflow)
            return workflow
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()
