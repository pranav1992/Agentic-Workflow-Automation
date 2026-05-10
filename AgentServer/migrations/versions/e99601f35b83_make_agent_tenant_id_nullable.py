"""make_tenant_id_nullable_on_all_tables

Revision ID: e99601f35b83
Revises: bd5f2c0c2ebd
Create Date: 2026-05-10 18:05:25.482677

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'e99601f35b83'
down_revision: Union[str, Sequence[str], None] = 'bd5f2c0c2ebd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TABLES = ['agent', 'nodeconfig', 'positionnode', 'edge', 'handoff', 'tool', 'audit_log']


def upgrade() -> None:
    for table in _TABLES:
        op.alter_column(table, 'tenant_id', existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    for table in _TABLES:
        op.alter_column(table, 'tenant_id', existing_type=sa.UUID(), nullable=False)
