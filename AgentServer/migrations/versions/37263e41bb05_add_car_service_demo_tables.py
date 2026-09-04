"""add car service demo tables

Revision ID: 37263e41bb05
Revises: f0dbc57d836a
Create Date: 2026-09-04 05:59:24.998626

"""
from typing import Sequence, Union

from datetime import datetime

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '37263e41bb05'
down_revision: Union[str, Sequence[str], None] = 'f0dbc57d836a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


service_pricing = sa.table(
    'service_pricing',
    sa.column('id', sa.UUID()),
    sa.column('service_type', sqlmodel.sql.sqltypes.AutoString()),
    sa.column('price_cents', sa.Integer()),
    sa.column('description', sqlmodel.sql.sqltypes.AutoString()),
)

repair_order = sa.table(
    'repair_order',
    sa.column('id', sa.UUID()),
    sa.column('order_number', sqlmodel.sql.sqltypes.AutoString()),
    sa.column('vehicle_vin', sqlmodel.sql.sqltypes.AutoString()),
    sa.column('status', sqlmodel.sql.sqltypes.AutoString()),
    sa.column('description', sqlmodel.sql.sqltypes.AutoString()),
    sa.column('estimated_completion', sqlmodel.sql.sqltypes.AutoString()),
    sa.column('created_at', sa.DateTime()),
)

# Fixed ids so downgrade/upgrade is idempotent-ish and seed rows are easy to
# spot in a debugger; values themselves are just demo content.
_PRICING_SEED = [
    {"id": "9c8f1e10-0000-4000-8000-000000000001", "service_type": "oil change", "price_cents": 6999, "description": "Conventional oil change, up to 5 quarts, includes filter."},
    {"id": "9c8f1e10-0000-4000-8000-000000000002", "service_type": "synthetic oil change", "price_cents": 9999, "description": "Full synthetic oil change, up to 5 quarts, includes filter."},
    {"id": "9c8f1e10-0000-4000-8000-000000000003", "service_type": "brake inspection", "price_cents": 0, "description": "Free brake inspection; repair quoted separately if needed."},
    {"id": "9c8f1e10-0000-4000-8000-000000000004", "service_type": "brake pad replacement", "price_cents": 18999, "description": "Front or rear pad replacement, per axle, parts and labor."},
    {"id": "9c8f1e10-0000-4000-8000-000000000005", "service_type": "tire rotation", "price_cents": 2999, "description": "Four-tire rotation and pressure check."},
    {"id": "9c8f1e10-0000-4000-8000-000000000006", "service_type": "general diagnostics", "price_cents": 12999, "description": "Computer diagnostic scan and technician review, up to 1 hour."},
    {"id": "9c8f1e10-0000-4000-8000-000000000007", "service_type": "battery replacement", "price_cents": 15999, "description": "Standard battery replacement, parts and labor, most vehicles."},
]

_REPAIR_ORDER_SEED = [
    {
        "id": "9c8f1e10-0000-4000-9000-000000000001",
        "order_number": "RO-1001",
        "vehicle_vin": "1FAKE00000VIN0001",
        "status": "in progress",
        "description": "Brake pad replacement, front axle.",
        "estimated_completion": "2026-09-05",
        "created_at": datetime(2026, 9, 2, 9, 0, 0),
    },
    {
        "id": "9c8f1e10-0000-4000-9000-000000000002",
        "order_number": "RO-1002",
        "vehicle_vin": "2FAKE00000VIN0002",
        "status": "ready for pickup",
        "description": "Synthetic oil change and tire rotation.",
        "estimated_completion": "2026-09-04",
        "created_at": datetime(2026, 9, 1, 9, 0, 0),
    },
]


def upgrade() -> None:
    op.create_table(
        'service_appointment',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('confirmation_code', sqlmodel.sql.sqltypes.AutoString(length=12), nullable=False),
        sa.Column('vehicle_vin', sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column('service_type', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('scheduled_date', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('scheduled_time', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('customer_phone', sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_service_appointment_confirmation_code'), 'service_appointment', ['confirmation_code'], unique=False)

    op.create_table(
        'repair_order',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_number', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('vehicle_vin', sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column('estimated_completion', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_number', name='repair_order_order_number_key'),
    )
    op.create_index(op.f('ix_repair_order_order_number'), 'repair_order', ['order_number'], unique=True)
    op.create_index(op.f('ix_repair_order_vehicle_vin'), 'repair_order', ['vehicle_vin'], unique=False)

    op.create_table(
        'service_pricing',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('service_type', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('price_cents', sa.Integer(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('service_type', name='service_pricing_service_type_key'),
    )
    op.create_index(op.f('ix_service_pricing_service_type'), 'service_pricing', ['service_type'], unique=True)

    op.create_table(
        'escalation',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('reason', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column('customer_phone', sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column('location', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Seed data — the demo tools have nothing real to look up/quote without
    # this. Appointments/escalations start empty; they get real rows as the
    # tools are actually called during calls.
    op.bulk_insert(service_pricing, _PRICING_SEED)
    op.bulk_insert(repair_order, _REPAIR_ORDER_SEED)


def downgrade() -> None:
    op.drop_table('escalation')
    op.drop_index(op.f('ix_service_pricing_service_type'), table_name='service_pricing')
    op.drop_table('service_pricing')
    op.drop_index(op.f('ix_repair_order_vehicle_vin'), table_name='repair_order')
    op.drop_index(op.f('ix_repair_order_order_number'), table_name='repair_order')
    op.drop_table('repair_order')
    op.drop_index(op.f('ix_service_appointment_confirmation_code'), table_name='service_appointment')
    op.drop_table('service_appointment')
