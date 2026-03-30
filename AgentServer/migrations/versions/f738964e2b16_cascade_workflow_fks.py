"""cascade workflow fks

Revision ID: f738964e2b16
Revises: 304871eadf7b
Create Date: 2026-03-29 17:34:37.547688

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'f738964e2b16'
down_revision: Union[str, Sequence[str], None] = '304871eadf7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    def reset_fk(table: str, fk_name: str):
        fks = insp.get_foreign_keys(table)
        for fk in fks:
            if fk["referred_table"] == "workflow" and fk["constrained_columns"] == ["workflow_id"]:
                if fk.get("name"):
                    op.drop_constraint(fk["name"], table, type_="foreignkey")
                break
        op.create_foreign_key(
            fk_name,
            table,
            "workflow",
            ["workflow_id"],
            ["id"],
            ondelete="CASCADE",
        )

    reset_fk("positionnode", "fk_positionnode_workflow_id_workflow")
    reset_fk("nodeconfig", "fk_nodeconfig_workflow_id_workflow")
    reset_fk("tool", "fk_tool_workflow_id_workflow")
    reset_fk("handoff", "fk_handoff_workflow_id_workflow")


def downgrade() -> None:
    """Downgrade schema."""
    for table, fk_name in [
        ("positionnode", "fk_positionnode_workflow_id_workflow"),
        ("nodeconfig", "fk_nodeconfig_workflow_id_workflow"),
        ("tool", "fk_tool_workflow_id_workflow"),
        ("handoff", "fk_handoff_workflow_id_workflow"),
    ]:
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_workflow_id_fkey",
            table,
            "workflow",
            ["workflow_id"],
            ["id"],
        )
