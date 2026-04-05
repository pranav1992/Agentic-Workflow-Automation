from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import joinedload, selectinload
from app.domain.exceptions import ToolNameAlreadyExist, \
                                DatabaseUnavailableError, ToolNotFoundError
from app.infrastructure.db.models import Tool, Edge
from sqlmodel import select


class ToolRepository:
    def __init__(self, session):
        self.session = session

    def create(self, tool):
        try:
            self.session.add(tool)
            self.session.flush()
            return tool
        except IntegrityError:
            self.session.rollback()
            raise ToolNameAlreadyExist(tool.name)
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_all_tools(self, workflow_id):
        try:
            stmt = select(Tool).where(Tool.workflow_id == workflow_id).options(
                joinedload(Tool.position_node), selectinload(Tool.node_config)
            )
            return self.session.exec(stmt).all()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_all_tools_by_agent(self, agent_id):
        try:
            stmt = select(Tool).where(Tool.agent_id == agent_id).options(
                joinedload(Tool.position_node), selectinload(Tool.node_config))
            return self.session.exec(stmt).all()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def update(self, tool):
        try:
            existing = self.session.get(Tool, tool.id)
            if existing is None:
                raise ToolNotFoundError(tool.id)

            self.session.merge(tool)
            self.session.commit()
            self.session.refresh(tool)
            return tool
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def delete(self, tool_id):
        try:
            tool = self.session.get(Tool, tool_id)
            if tool is None:
                raise ToolNotFoundError(tool_id)

            position_id = tool.position

            # remove edges that reference this tool's position node
            if position_id:
                (
                    self.session.query(Edge)
                    .filter((Edge.source == position_id) | (Edge.target == position_id))
                    .delete(synchronize_session=False)
                )

            # clear foreign keys on tool before deleting 
            # linked rows to satisfy constraints
            tool.config = None
            tool.position = None
            self.session.flush()

            if tool.node_config is not None:
                self.session.delete(tool.node_config)
            if tool.position_node is not None:
                self.session.delete(tool.position_node)

            self.session.delete(tool)
            self.session.commit()
            # return a lightweight dict so callers
            # don't access expired instance
            return tool
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get(self, tool_id):
        try:
            return self.session.get(Tool, tool_id)
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()
