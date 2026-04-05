
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import joinedload, selectinload
from sqlmodel import select

from app.domain.exceptions import (
    AgentAlreadyInitializedError,
    AgentNameAlreadyExist,
    AgentNotFoundError,
    DatabaseUnavailableError,
)
from app.infrastructure.db.models import Agent, Edge


class AgentRepository:
    def __init__(self, session):
        self.session = session

    def initialize(self, agent):
        try:
            self.session.add(agent)
            self.session.flush()
            return agent
        except IntegrityError:
            self.session.rollback()
            raise AgentAlreadyInitializedError()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def create(self, agent):
        try:
            self.session.add(agent)
            self.session.commit()
            self.session.flush()
            return agent
        except IntegrityError:
            self.session.rollback()
            raise AgentNameAlreadyExist(agent.name)
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def update(self, agent):
        try:
            existing = self.session.get(Agent, agent.id)
            if existing is None:
                raise AgentNotFoundError(agent.id)

            self.session.merge(agent)
            self.session.commit()
            self.session.refresh(agent)
            return agent
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_agent(self, agent_id):
        stmt = (
            select(Agent)
            .where(Agent.id == agent_id)
            .options(selectinload(Agent.node_config), joinedload(
                                                    Agent.position_node))
        )
        try:
            agent = self.session.exec(stmt).first()
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

        if agent is None:
            raise AgentNotFoundError(agent_id)

        return agent

    def isNameAlreadyExist(self, name, workflow_id):
        """Return True if an agent with the same name exists in the workflow."""
        try:
            already_exist = self.session.exec(
                select(Agent).where(
                    Agent.name == name, Agent.workflow_id == workflow_id
                )
            ).first()
            return already_exist is not None
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def get_all_agents(self, workflow_id):
        """Return all agents for a workflow with their
            PositionNode eagerly loaded."""

        stmt = (
            select(Agent)
            .where(Agent.workflow_id == workflow_id)
            .options(selectinload(Agent.node_config), selectinload(
                Agent.position_node))
        )

        # materialize the result so FastAPI serializes a concrete list
        try:
            return list(self.session.exec(stmt))
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def delete(self, agent_id):
        try:
            agent = self.session.get(Agent, agent_id)
            if agent is None:
                raise AgentNotFoundError(agent_id)

            position_id = agent.position

            # remove edges that reference this agent's position node
            if position_id:
                (
                    self.session.query(Edge)
                    .filter((Edge.source == position_id) | (Edge.target == position_id))
                    .delete(synchronize_session=False)
                )

            # clear FKs and delete linked config/position before deleting agent
            agent.config = None
            agent.position = None
            self.session.flush()

            if agent.node_config is not None:
                self.session.delete(agent.node_config)
            if agent.position_node is not None:
                self.session.delete(agent.position_node)

            self.session.delete(agent)
            self.session.commit()
            return agent
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()

    def isInitialized(self, workflow_id):
        try:
            initial_agent = self.session.exec(
                select(Agent).where(
                    Agent.workflow_id == workflow_id, Agent.isInitial
                )
            ).first()
            return initial_agent is not None
        except OperationalError:
            self.session.rollback()
            raise DatabaseUnavailableError()
