from sqlalchemy.exc import OperationalError
from sqlmodel import select

from app.domain.exceptions import DatabaseUnavailableError
from app.infrastructure.db.models import WorkflowSession


class SessionRepository:
    def __init__(self, session):
        self.session = session

    def create(self, workflow_session: WorkflowSession) -> WorkflowSession:
        try:
            self.session.add(workflow_session)
            self.session.commit()
            self.session.refresh(workflow_session)
            return workflow_session
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_active(self, workflow_id) -> WorkflowSession | None:
        try:
            return self.session.exec(
                select(WorkflowSession).where(
                    WorkflowSession.workflow_id == workflow_id,
                    WorkflowSession.status == "active",
                )
            ).first()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_all(self, workflow_id) -> list[WorkflowSession]:
        try:
            return list(
                self.session.exec(
                    select(WorkflowSession)
                    .where(WorkflowSession.workflow_id == workflow_id)
                    .order_by(WorkflowSession.started_at.desc())
                )
            )
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def update(self, workflow_session: WorkflowSession) -> WorkflowSession:
        try:
            self.session.add(workflow_session)
            self.session.commit()
            self.session.refresh(workflow_session)
            return workflow_session
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()
