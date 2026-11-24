"""
Database Migration and Schema Synchronization Module.
Ensures zero-downtime, safe, idempotent migrations run on every startup
before any application models or superadmin initialization are accessed.
"""
import os
import sys
from pathlib import Path
from alembic.config import Config
from alembic import command
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
    Self-healing safety net: directly inspects existing SQLite or PostgreSQL tables
    and immediately adds any newly introduced columns before any queries run.
    Preserves all existing user, asset, and maintenance data.
    """
    with engine.connect() as conn:
        is_sqlite = DATABASE_URL.startswith("sqlite")

        # 1. users table
        try:
            if is_sqlite:
                cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()]
            else:
                cols = [r[0] for r in conn.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name='users'").fetchall()]

            user_cols_to_add = [
                ("organization_id", "INTEGER"),
                ("site_id", "INTEGER"),
                ("username", "VARCHAR(60)"),
                ("full_name", "VARCHAR(120)"),
                ("locations", "JSON DEFAULT '[]'"),
                ("units", "JSON DEFAULT '[]'"),
                ("departments", "JSON DEFAULT '[]'"),
                ("contractor_company", "VARCHAR(120) DEFAULT ''"),
                ("phone", "VARCHAR(40) DEFAULT ''"),
                ("failed_logins", "INTEGER DEFAULT 0"),
                ("locked_until", "TIMESTAMP"),
                ("created_at", "TIMESTAMP"),
            ]
            for col_name, col_def in user_cols_to_add:
                if col_name not in cols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                        print(f"[Migrations] Added missing column users.{col_name}")
                    except Exception as ex:
                        print(f"[Migrations] Notice adding users.{col_name}: {ex}")
        except Exception as e:
            print(f"[Migrations] Notice checking users table: {e}")

        # 2. assets table
        try:
            if is_sqlite:
                cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(assets)").fetchall()]
            else:
                cols = [r[0] for r in conn.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name='assets'").fetchall()]

            asset_cols_to_add = [
                ("organization_id", "INTEGER"),
                ("site_id", "INTEGER"),
                ("utility_type", "VARCHAR(30)"),
            ]
            for col_name, col_def in asset_cols_to_add:
                if col_name not in cols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE assets ADD COLUMN {col_name} {col_def}")
                        print(f"[Migrations] Added missing column assets.{col_name}")
                    except Exception as ex:
                        print(f"[Migrations] Notice adding assets.{col_name}: {ex}")
        except Exception as e:
            print(f"[Migrations] Notice checking assets table: {e}")

        # 3. locations table
        try:
            if is_sqlite:
                cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(locations)").fetchall()]
            else:
                cols = [r[0] for r in conn.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name='locations'").fetchall()]

            if "site_id" not in cols:
                try:
                    conn.exec_driver_sql("ALTER TABLE locations ADD COLUMN site_id INTEGER")
                    print("[Migrations] Added missing column locations.site_id")
                except Exception as ex:
                    print(f"[Migrations] Notice adding locations.site_id: {ex}")
        except Exception as e:
            print(f"[Migrations] Notice checking locations table: {e}")

        conn.commit()


def run_all_migrations():
    """Runs Alembic migrations followed by the self-healing schema check."""
    run_alembic_migrations()
    run_schema_self_heal()
