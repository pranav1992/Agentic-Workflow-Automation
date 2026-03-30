"""Add workflow_id to positionnode and allow null

Revision ID: 6c8f5c6d0d9b
Revises: 77d1529e3b16
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "6c8f5c6d0d9b"
down_revision: Union[str, Sequence[str], None] = "77d1529e3b16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("positionnode")}
    if "workflow_id" not in cols:
        op.add_column(
            "positionnode",
            sa.Column(
                "workflow_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
        )
        op.create_foreign_key(
            "fk_positionnode_workflow_id_workflow",
            "positionnode",
            "workflow",
            ["workflow_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("positionnode")}
    if "workflow_id" in cols:
        fks = {fk["name"] for fk in insp.get_foreign_keys("positionnode") if fk.get("name")}
        if "fk_positionnode_workflow_id_workflow" in fks:
            op.drop_constraint(
                "fk_positionnode_workflow_id_workflow",
                "positionnode",
                type_="foreignkey",
            )
        op.drop_column("positionnode", "workflow_id")
