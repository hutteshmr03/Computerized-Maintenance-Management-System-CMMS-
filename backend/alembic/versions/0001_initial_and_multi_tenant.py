"""multi-tenant organizations, sites and enterprise user columns

Revision ID: 0001_initial
Revises: 
Create Date: 2026-11-24 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def table_exists(conn, table_name):
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def column_exists(conn, table_name, column_name):
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create organizations table if not exists
    if not table_exists(conn, 'organizations'):
        op.create_table(
            'organizations',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('code', sa.String(length=30), nullable=False, unique=True),
            sa.Column('name', sa.String(length=140), nullable=False),
            sa.Column('domain', sa.String(length=120), server_default='', nullable=False),
            sa.Column('tax_id', sa.String(length=60), server_default='', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )

    # 2. Create sites table if not exists
    if not table_exists(conn, 'sites'):
        op.create_table(
            'sites',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id'), server_default='1', nullable=False),
            sa.Column('code', sa.String(length=30), nullable=False, unique=True),
            sa.Column('name', sa.String(length=140), nullable=False),
            sa.Column('city', sa.String(length=100), server_default='', nullable=False),
            sa.Column('country', sa.String(length=100), server_default='Germany', nullable=False),
            sa.Column('address', sa.String(length=200), server_default='', nullable=False),
            sa.Column('timezone', sa.String(length=60), server_default='Europe/Berlin', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )

    # 3. Add columns to users table
    if table_exists(conn, 'users'):
        with op.batch_alter_table('users', schema=None) as batch_op:
            if not column_exists(conn, 'users', 'organization_id'):
                batch_op.add_column(sa.Column('organization_id', sa.Integer(), nullable=True))
            if not column_exists(conn, 'users', 'site_id'):
                batch_op.add_column(sa.Column('site_id', sa.Integer(), nullable=True))
            if not column_exists(conn, 'users', 'username'):
                batch_op.add_column(sa.Column('username', sa.String(length=60), nullable=True))
            if not column_exists(conn, 'users', 'full_name'):
                batch_op.add_column(sa.Column('full_name', sa.String(length=120), nullable=True))
            if not column_exists(conn, 'users', 'locations'):
                batch_op.add_column(sa.Column('locations', sa.JSON(), nullable=True))
            if not column_exists(conn, 'users', 'units'):
                batch_op.add_column(sa.Column('units', sa.JSON(), nullable=True))
            if not column_exists(conn, 'users', 'departments'):
                batch_op.add_column(sa.Column('departments', sa.JSON(), nullable=True))
            if not column_exists(conn, 'users', 'contractor_company'):
                batch_op.add_column(sa.Column('contractor_company', sa.String(length=120), server_default='', nullable=True))
            if not column_exists(conn, 'users', 'phone'):
                batch_op.add_column(sa.Column('phone', sa.String(length=40), server_default='', nullable=True))
            if not column_exists(conn, 'users', 'failed_logins'):
                batch_op.add_column(sa.Column('failed_logins', sa.Integer(), server_default='0', nullable=True))
            if not column_exists(conn, 'users', 'locked_until'):
                batch_op.add_column(sa.Column('locked_until', sa.DateTime(), nullable=True))
            if not column_exists(conn, 'users', 'created_at'):
                batch_op.add_column(sa.Column('created_at', sa.DateTime(), nullable=True))

    # 4. Add columns to assets table
    if table_exists(conn, 'assets'):
        with op.batch_alter_table('assets', schema=None) as batch_op:
            if not column_exists(conn, 'assets', 'organization_id'):
                batch_op.add_column(sa.Column('organization_id', sa.Integer(), nullable=True))
            if not column_exists(conn, 'assets', 'site_id'):
                batch_op.add_column(sa.Column('site_id', sa.Integer(), nullable=True))
            if not column_exists(conn, 'assets', 'utility_type'):
                batch_op.add_column(sa.Column('utility_type', sa.String(length=30), nullable=True))

    # 5. Add columns to locations table
    if table_exists(conn, 'locations'):
        with op.batch_alter_table('locations', schema=None) as batch_op:
            if not column_exists(conn, 'locations', 'site_id'):
                batch_op.add_column(sa.Column('site_id', sa.Integer(), nullable=True))

    # 6. Ensure default organization and sites exist, and backfill
    conn.execute(sa.text("""
        INSERT OR IGNORE INTO organizations (id, code, name, domain, tax_id, is_active, created_at)
        VALUES (1, 'ORG-001', 'Sumant Industrial Manufacturing AG', 'cmms.test', 'DE348920194', 1, CURRENT_TIMESTAMP)
    """))

    conn.execute(sa.text("""
        INSERT OR IGNORE INTO sites (id, organization_id, code, name, city, country, address, timezone, is_active, created_at)
        VALUES (1, 1, 'SITE-01', 'Plant A - Heavy Machinery & Power', 'Stuttgart', 'Germany', 'Mercedesstrasse 120, 70372 Stuttgart', 'Europe/Berlin', 1, CURRENT_TIMESTAMP)
    """))

    conn.execute(sa.text("""
        INSERT OR IGNORE INTO sites (id, organization_id, code, name, city, country, address, timezone, is_active, created_at)
        VALUES (2, 1, 'SITE-02', 'Plant B - Precision Assembly & Packaging', 'Munich', 'Germany', 'Frankfurter Ring 85, 80807 Munich', 'Europe/Berlin', 1, CURRENT_TIMESTAMP)
    """))

    conn.execute(sa.text("""
        INSERT OR IGNORE INTO sites (id, organization_id, code, name, city, country, address, timezone, is_active, created_at)
        VALUES (3, 1, 'SITE-03', 'Central Logistics Hub', 'Frankfurt', 'Germany', 'Industriepark Höchst, 65926 Frankfurt', 'Europe/Berlin', 1, CURRENT_TIMESTAMP)
    """))

    if table_exists(conn, 'users'):
        conn.execute(sa.text("UPDATE users SET organization_id = 1 WHERE organization_id IS NULL"))
        conn.execute(sa.text("UPDATE users SET site_id = 1 WHERE site_id IS NULL"))

    if table_exists(conn, 'assets'):
        conn.execute(sa.text("UPDATE assets SET organization_id = 1 WHERE organization_id IS NULL"))
        conn.execute(sa.text("UPDATE assets SET site_id = 1 WHERE site_id IS NULL"))

    if table_exists(conn, 'locations'):
        conn.execute(sa.text("UPDATE locations SET site_id = 1 WHERE site_id IS NULL AND name LIKE '%Plant A%'"))
        conn.execute(sa.text("UPDATE locations SET site_id = 2 WHERE site_id IS NULL AND name LIKE '%Plant B%'"))


def downgrade() -> None:
    pass
