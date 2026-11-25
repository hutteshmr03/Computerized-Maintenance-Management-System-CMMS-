import os
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

try:
    from dotenv import load_dotenv
    # Load backend/.env if present (useful for MilesWeb cPanel / VPS deployments)
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
    else:
        load_dotenv()
except ImportError:
    pass


def normalize_database_url(url: str) -> str:
    """Normalize shorthand DB URLs for SQLAlchemy 2.0 compatibility across SQLite, PostgreSQL, and MySQL."""
    if not url:
        return "sqlite:///./cmms.db"
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    return url


# SQLite by default so local dev runs with no setup.
# For MilesWeb PostgreSQL set: DATABASE_URL=postgresql://user:pass@localhost:5432/cmms
# For MilesWeb MySQL/MariaDB set: DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/cmms
DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./cmms.db"))
IS_SQLITE = DATABASE_URL.startswith("sqlite")


def build_engine_kwargs(db_url: str) -> dict:
    """Return SQLAlchemy create_engine keyword args tuned for SQLite vs pooled PostgreSQL/MySQL."""
    if db_url.startswith("sqlite"):
        return {
            "connect_args": {"check_same_thread": False, "timeout": 15},
            "pool_pre_ping": True,
        }
    return {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "300")),
        "pool_pre_ping": True,
    }


engine = create_engine(DATABASE_URL, **build_engine_kwargs(DATABASE_URL))

if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.execute("PRAGMA cache_size = -64000")  # 64MB memory cache
        cursor.execute("PRAGMA temp_store = MEMORY")
        cursor.execute("PRAGMA mmap_size = 268435456")  # 256MB memory mapped I/O
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 10000")  # 10s wait on locks
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def utcnow() -> datetime:
    """Naive UTC now (stored without tzinfo in the database)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
