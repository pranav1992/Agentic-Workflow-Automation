"""make agent position config nullable and rename tool agent

Revision ID: 77d1529e3b16
Revises: 
Create Date: 2026-03-27 19:08:11.052779

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '77d1529e3b16'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # make agent optional fields nullable
    op.alter_column("agent", "position", nullable=True)
    op.alter_column("agent", "config", nullable=True)

    # rename tool.agent -> tool.agent_id to match ORM (only if still named agent)
    tool_cols = {col["name"] for col in inspector.get_columns("tool")}
    if "agent" in tool_cols and "agent_id" not in tool_cols:
        op.alter_column("tool", "agent", new_column_name="agent_id")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tool_cols = {col["name"] for col in inspector.get_columns("tool")}

    # revert column rename only if agent_id exists
    if "agent_id" in tool_cols and "agent" not in tool_cols:
        op.alter_column("tool", "agent_id", new_column_name="agent")

    # revert nullable changes
    op.alter_column("agent", "config", nullable=False)
    op.alter_column("agent", "position", nullable=False)
