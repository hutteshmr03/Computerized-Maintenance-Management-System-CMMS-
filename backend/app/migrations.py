"""
Database Migration and Schema Synchronization Module.
Ensures zero-downtime, safe, idempotent migrations run on every startup
before any application models or superadmin initialization are accessed.
Supports SQLite, PostgreSQL, and MySQL/MariaDB (MilesWeb hosting ready).
"""
from pathlib import Path
from alembic.config import Config
from alembic import command
from sqlalchemy import inspect as sa_inspect
from .db import engine, DATABASE_URL


def run_alembic_migrations():
    """Runs Alembic migrations programmatically to head."""
    try:
        backend_dir = Path(__file__).resolve().parent.parent
        ini_path = backend_dir / "alembic.ini"
        if ini_path.exists():
            alembic_cfg = Config(str(ini_path))
            alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
            alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
            command.upgrade(alembic_cfg, "head")
            print("[Migrations] Alembic upgrade head executed successfully.")
    except Exception as e:
        print(f"[Migrations] Note during alembic upgrade: {e}")


def run_schema_self_heal():
    """
    Self-healing safety net using SQLAlchemy Inspector (SQLite, PostgreSQL, MySQL).
    Directly inspects existing tables and adds any newly introduced columns
    before any queries run, preserving all user, asset, and maintenance data.
    """
    with engine.connect() as conn:
        inspector = sa_inspect(conn)
        existing_tables = set(inspector.get_table_names())
        dialect = conn.dialect.name  # 'sqlite', 'postgresql', 'mysql'

        json_type = "JSON" if dialect in ("sqlite", "postgresql", "mysql") else "TEXT"
        ts_type = "DATETIME" if dialect == "mysql" else "TIMESTAMP"
        bool_false_def = "BOOLEAN DEFAULT FALSE" if dialect == "postgresql" else "BOOLEAN DEFAULT 0"

        def add_missing_columns(table_name: str, cols_spec: list[tuple[str, str]]):
            if table_name not in existing_tables:
                return
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, col_def in cols_spec:
                if col_name not in existing_cols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}")
                        print(f"[Migrations] Added missing column {table_name}.{col_name}")
                    except Exception as ex:
                        print(f"[Migrations] Notice adding {table_name}.{col_name}: {ex}")

        add_missing_columns("users", [
            ("organization_id", "INTEGER"),
            ("site_id", "INTEGER"),
            ("username", "VARCHAR(60)"),
            ("full_name", "VARCHAR(120)"),
            ("locations", json_type),
            ("units", json_type),
            ("departments", json_type),
            ("contractor_company", "VARCHAR(120) DEFAULT ''"),
            ("phone", "VARCHAR(40) DEFAULT ''"),
            ("failed_logins", "INTEGER DEFAULT 0"),
            ("locked_until", ts_type),
            ("must_reset_password", bool_false_def),
            ("created_at", ts_type),
        ])

        add_missing_columns("assets", [
            ("organization_id", "INTEGER"),
            ("site_id", "INTEGER"),
            ("utility_type", "VARCHAR(30)"),
        ])

        add_missing_columns("locations", [
            ("site_id", "INTEGER"),
        ])

        add_missing_columns("jobs", [
            ("breakdown_start_at", ts_type),
            ("breakdown_end_at", ts_type),
            ("downtime_minutes", "FLOAT DEFAULT 0"),
            ("downtime_type", "VARCHAR(30) DEFAULT 'unplanned'"),
            ("root_cause_analysis", "TEXT DEFAULT ''"),
            ("corrective_action", "TEXT DEFAULT ''"),
            ("preventive_action", "TEXT DEFAULT ''"),
            ("production_confirmed_by", "VARCHAR(100) DEFAULT ''"),
            ("production_confirmed_at", ts_type),
        ])

        conn.commit()


def run_all_migrations():
    """Runs Alembic migrations followed by the dialect-neutral self-healing schema check."""
    run_alembic_migrations()
    run_schema_self_heal()
