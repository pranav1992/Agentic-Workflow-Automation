"""add workflow_session table

Revision ID: 4f9696a0be8d
Revises: e99601f35b83
Create Date: 2026-05-11 00:03:25.248585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '4f9696a0be8d'
down_revision: Union[str, Sequence[str], None] = 'e99601f35b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_session",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("workflow_id", sa.UUID(), nullable=False),
        sa.Column("room_name", sqlmodel.AutoString(length=200), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("status", sqlmodel.AutoString(length=20), nullable=False, server_default="active"),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflow.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_session_workflow", "workflow_session", ["workflow_id"])
    op.create_index("idx_session_status", "workflow_session", ["status"])


def downgrade() -> None:
    op.drop_index("idx_session_status", table_name="workflow_session")
    op.drop_index("idx_session_workflow", table_name="workflow_session")
    op.drop_table("workflow_session")
