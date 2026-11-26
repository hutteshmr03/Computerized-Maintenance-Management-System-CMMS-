"""add breakdown downtime precision and RCA fields to jobs (SCR-026 to SCR-028)

Revision ID: 0004_breakdown_rca
Revises: 0003_maint_requests
Create Date: 2026-11-26 12:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004_breakdown_rca'
down_revision = '0003_maint_requests'
branch_labels = None
depends_on = None


def column_exists(conn, table_name, column_name):
    inspector = sa.inspect(conn)
    if table_name not in inspector.get_table_names():
        return False
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'jobs' in inspector.get_table_names():
        with op.batch_alter_table('jobs', schema=None) as batch_op:
            if not column_exists(conn, 'jobs', 'breakdown_start_at'):
                batch_op.add_column(sa.Column('breakdown_start_at', sa.DateTime(), nullable=True))
            if not column_exists(conn, 'jobs', 'breakdown_end_at'):
                batch_op.add_column(sa.Column('breakdown_end_at', sa.DateTime(), nullable=True))
            if not column_exists(conn, 'jobs', 'downtime_minutes'):
                batch_op.add_column(sa.Column('downtime_minutes', sa.Float(), server_default='0', nullable=True))
            if not column_exists(conn, 'jobs', 'downtime_type'):
                batch_op.add_column(sa.Column('downtime_type', sa.String(length=30), server_default='unplanned', nullable=True))
            if not column_exists(conn, 'jobs', 'root_cause_analysis'):
                batch_op.add_column(sa.Column('root_cause_analysis', sa.Text(), server_default='', nullable=True))
            if not column_exists(conn, 'jobs', 'corrective_action'):
                batch_op.add_column(sa.Column('corrective_action', sa.Text(), server_default='', nullable=True))
            if not column_exists(conn, 'jobs', 'preventive_action'):
                batch_op.add_column(sa.Column('preventive_action', sa.Text(), server_default='', nullable=True))
            if not column_exists(conn, 'jobs', 'production_confirmed_by'):
                batch_op.add_column(sa.Column('production_confirmed_by', sa.String(length=100), server_default='', nullable=True))
            if not column_exists(conn, 'jobs', 'production_confirmed_at'):
                batch_op.add_column(sa.Column('production_confirmed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    pass
