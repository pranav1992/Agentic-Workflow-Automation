"""add cascade to agent workflow

Revision ID: 57008c1fe4fd
Revises: 6df362713786
Create Date: 2026-03-29 17:26:19.923595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '57008c1fe4fd'
down_revision: Union[str, Sequence[str], None] = '6df362713786'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # drop existing FK on agent.workflow_id (name may vary across environments)
    for fk in insp.get_foreign_keys("agent"):
        if fk["referred_table"] == "workflow" and fk["constrained_columns"] == ["workflow_id"]:
            if fk.get("name"):
                op.drop_constraint(fk["name"], "agent", type_="foreignkey")
            break

    op.create_foreign_key(
        "fk_agent_workflow_id_workflow",
        "agent",
        "workflow",
        ["workflow_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # remove cascade version and recreate a simple FK without ON DELETE CASCADE
    op.drop_constraint("fk_agent_workflow_id_workflow", "agent", type_="foreignkey")
    op.create_foreign_key(
        "agent_workflow_id_fkey",
        "agent",
        "workflow",
        ["workflow_id"],
        ["id"],
    )
