"""add account lockout fields to user

Revision ID: 2e3333b3cace
Revises: e401f145db7d
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2e3333b3cace'
down_revision: Union[str, Sequence[str], None] = 'e401f145db7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'user',
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'user',
        sa.Column('locked_until', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'locked_until')
    op.drop_column('user', 'failed_login_attempts')
