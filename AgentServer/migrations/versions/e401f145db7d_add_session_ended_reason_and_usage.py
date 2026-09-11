"""add session ended_reason and usage

Revision ID: e401f145db7d
Revises: 37263e41bb05
Create Date: 2026-09-11 17:22:47.971471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e401f145db7d'
down_revision: Union[str, Sequence[str], None] = '37263e41bb05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Autogenerate also proposed dropping unique constraints on repair_order
    # and service_pricing. Those are noise from the existing create_all vs
    # Alembic divergence, not part of this change, so they're deliberately
    # left out rather than silently destroying constraints.
    op.add_column('workflow_session', sa.Column('ended_reason', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=True))
    op.add_column('workflow_session', sa.Column('usage', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('workflow_session', 'usage')
    op.drop_column('workflow_session', 'ended_reason')
