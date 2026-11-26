"""add maintenance_requests table for SCR-013 to SCR-015

Revision ID: 0003_maint_requests
Revises: 0002_must_reset_pw
Create Date: 2026-11-26 10:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003_maint_requests'
down_revision = '0002_must_reset_pw'
branch_labels = None
depends_on = None


def table_exists(conn, table_name):
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    if not table_exists(conn, 'maintenance_requests'):
        op.create_table(
            'maintenance_requests',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('req_number', sa.String(length=30), nullable=False, unique=True),
            sa.Column('organization_id', sa.Integer(), nullable=True),
            sa.Column('site_id', sa.Integer(), nullable=True),
            sa.Column('asset_id', sa.Integer(), sa.ForeignKey('assets.id'), nullable=False),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('description', sa.Text(), server_default='', nullable=False),
            sa.Column('category', sa.String(length=40), server_default='breakdown', nullable=False),
            sa.Column('severity', sa.String(length=20), server_default='high', nullable=False),
            sa.Column('machine_stopped', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('reported_down_at', sa.DateTime(), nullable=True),
            sa.Column('photo_filename', sa.String(length=200), server_default='', nullable=False),
            sa.Column('status', sa.String(length=20), server_default='submitted', nullable=False),
            sa.Column('requested_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('rejection_reason', sa.Text(), server_default='', nullable=False),
            sa.Column('converted_job_id', sa.Integer(), sa.ForeignKey('jobs.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    pass
