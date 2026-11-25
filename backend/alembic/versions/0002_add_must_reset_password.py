"""add must_reset_password flag to users

Revision ID: 0002_must_reset_pw
Revises: 0001_initial
Create Date: 2026-11-25 12:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0002_must_reset_pw'
down_revision = '0001_initial'
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
    if not column_exists(conn, 'users', 'must_reset_password'):
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(
                sa.Column('must_reset_password', sa.Boolean(), server_default=sa.false(), nullable=True)
            )


def downgrade() -> None:
    pass
