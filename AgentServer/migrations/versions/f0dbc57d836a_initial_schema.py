"""initial_schema

Revision ID: f0dbc57d836a
Revises:
Create Date: 2026-05-13 19:17:36.087562

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f0dbc57d836a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- tenant (no dependencies) ---
    op.create_table('tenant',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
    sa.Column('slug', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('slug', name='uq_tenant_slug'),
    )
    op.create_index('idx_tenant_created_at', 'tenant', ['created_at'], unique=False)
    op.create_index(op.f('ix_tenant_is_active'), 'tenant', ['is_active'], unique=False)
    op.create_index(op.f('ix_tenant_name'), 'tenant', ['name'], unique=False)

    # --- audit_log (no FK dependencies) ---
    op.create_table('audit_log',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('action', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
    sa.Column('resource_type', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
    sa.Column('resource_id', sa.UUID(), nullable=True),
    sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('ip_address', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
    sa.Column('user_agent', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('timestamp', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_audit_action', 'audit_log', ['action'], unique=False)
    op.create_index('idx_audit_tenant', 'audit_log', ['tenant_id'], unique=False)
    op.create_index('idx_audit_timestamp', 'audit_log', ['timestamp'], unique=False)
    op.create_index('idx_audit_user', 'audit_log', ['user_id'], unique=False)
    op.create_index(op.f('ix_audit_log_timestamp'), 'audit_log', ['timestamp'], unique=False)

    # --- user (depends on tenant) ---
    op.create_table('user',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.UUID(), nullable=True),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
    sa.Column('username', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
    sa.Column('full_name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
    sa.Column('password_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('password_salt', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role', sa.Enum('ADMIN', 'TENANT_ADMIN', 'OPERATOR', 'AGENT', 'SERVICE_ACCOUNT', name='userrole'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_verified', sa.Boolean(), nullable=False),
    sa.Column('last_login', sa.DateTime(), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email', 'tenant_id', name='uq_user_email_tenant'),
    )
    op.create_index('idx_user_created_at', 'user', ['created_at'], unique=False)
    op.create_index('idx_user_tenant', 'user', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=False)
    op.create_index(op.f('ix_user_is_active'), 'user', ['is_active'], unique=False)

    # --- workflow (depends on tenant) ---
    op.create_table('workflow',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.UUID(), nullable=True),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
    sa.Column('name_lower', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('updated_by', sa.Uuid(), nullable=True),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', 'name_lower', name='uq_workflow_tenant_name'),
    )
    op.create_index('idx_workflow_tenant', 'workflow', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_workflow_name'), 'workflow', ['name'], unique=False)
    op.create_index(op.f('ix_workflow_name_lower'), 'workflow', ['name_lower'], unique=False)

    # --- agent (depends on workflow; circular FKs to positionnode/nodeconfig deferred) ---
    op.create_table('agent',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('position', sa.Uuid(), nullable=True),
    sa.Column('config', sa.Uuid(), nullable=True),
    sa.Column('isInitial', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', 'workflow_id', 'name', name='uq_agent_tenant_workflow_name'),
    )
    op.create_index(op.f('ix_agent_name'), 'agent', ['name'], unique=False)

    # --- tool (depends on workflow, agent; circular FKs to positionnode/nodeconfig deferred) ---
    op.create_table('tool',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('agent_id', sa.Uuid(), nullable=True),
    sa.Column('method', sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False),
    sa.Column('position', sa.Uuid(), nullable=True),
    sa.Column('config', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['agent.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tool_name'), 'tool', ['name'], unique=False)

    # --- positionnode (depends on workflow, agent, tool — all exist now) ---
    op.create_table('positionnode',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('agent_id', sa.Uuid(), nullable=True),
    sa.Column('tool_id', sa.Uuid(), nullable=True),
    sa.Column('x', sa.Float(), nullable=False),
    sa.Column('y', sa.Float(), nullable=False),
    sa.CheckConstraint('(agent_id IS NOT NULL AND tool_id IS NULL) OR (agent_id IS NULL AND tool_id IS NOT NULL)', name='only_one_position_type'),
    sa.ForeignKeyConstraint(['agent_id'], ['agent.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tool_id'], ['tool.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )

    # --- nodeconfig (depends on workflow, agent, tool — all exist now) ---
    op.create_table('nodeconfig',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('type', sa.Enum('AGENT', 'TOOL', name='node_type'), nullable=False),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('agent_id', sa.Uuid(), nullable=True),
    sa.Column('tool_id', sa.Uuid(), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.CheckConstraint('(agent_id IS NOT NULL AND tool_id IS NULL) OR (agent_id IS NULL AND tool_id IS NOT NULL)', name='only_one_node_type'),
    sa.ForeignKeyConstraint(['agent_id'], ['agent.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tool_id'], ['tool.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )

    # --- resolve circular FKs now that positionnode + nodeconfig exist ---
    op.create_foreign_key('fk_agent_position', 'agent', 'positionnode', ['position'], ['id'])
    op.create_foreign_key('fk_agent_config',   'agent', 'nodeconfig',   ['config'],   ['id'])
    op.create_foreign_key('fk_tool_position',  'tool',  'positionnode', ['position'], ['id'])
    op.create_foreign_key('fk_tool_config',    'tool',  'nodeconfig',   ['config'],   ['id'])

    # --- edge, handoff, workflow_session ---
    op.create_table('edge',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('source', sa.Uuid(), nullable=False),
    sa.Column('target', sa.Uuid(), nullable=False),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['source'], ['positionnode.id'], ),
    sa.ForeignKeyConstraint(['target'], ['positionnode.id'], ),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_table('handoff',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=True),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_handoff_name'), 'handoff', ['name'], unique=False)
    op.create_table('workflow_session',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('workflow_id', sa.Uuid(), nullable=True),
    sa.Column('room_name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
    sa.Column('started_at', sa.DateTime(), nullable=False),
    sa.Column('ended_at', sa.DateTime(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_session_status', 'workflow_session', ['status'], unique=False)
    op.create_index('idx_session_workflow', 'workflow_session', ['workflow_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_session_workflow', table_name='workflow_session')
    op.drop_index('idx_session_status', table_name='workflow_session')
    op.drop_table('workflow_session')
    op.drop_index(op.f('ix_handoff_name'), table_name='handoff')
    op.drop_table('handoff')
    op.drop_table('edge')

    # Remove circular FKs before dropping agent/tool/positionnode/nodeconfig
    op.drop_constraint('fk_tool_config',    'tool',  type_='foreignkey')
    op.drop_constraint('fk_tool_position',  'tool',  type_='foreignkey')
    op.drop_constraint('fk_agent_config',   'agent', type_='foreignkey')
    op.drop_constraint('fk_agent_position', 'agent', type_='foreignkey')

    op.drop_table('nodeconfig')
    op.drop_table('positionnode')
    op.drop_index(op.f('ix_tool_name'), table_name='tool')
    op.drop_table('tool')
    op.drop_index(op.f('ix_agent_name'), table_name='agent')
    op.drop_table('agent')
    op.drop_index(op.f('ix_workflow_name_lower'), table_name='workflow')
    op.drop_index(op.f('ix_workflow_name'), table_name='workflow')
    op.drop_index('idx_workflow_tenant', table_name='workflow')
    op.drop_table('workflow')
    op.drop_index(op.f('ix_user_is_active'), table_name='user')
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_index('idx_user_tenant', table_name='user')
    op.drop_index('idx_user_created_at', table_name='user')
    op.drop_table('user')
    op.drop_index(op.f('ix_audit_log_timestamp'), table_name='audit_log')
    op.drop_index('idx_audit_user', table_name='audit_log')
    op.drop_index('idx_audit_timestamp', table_name='audit_log')
    op.drop_index('idx_audit_tenant', table_name='audit_log')
    op.drop_index('idx_audit_action', table_name='audit_log')
    op.drop_table('audit_log')
    op.drop_index(op.f('ix_tenant_name'), table_name='tenant')
    op.drop_index(op.f('ix_tenant_is_active'), table_name='tenant')
    op.drop_index('idx_tenant_created_at', table_name='tenant')
    op.drop_table('tenant')
