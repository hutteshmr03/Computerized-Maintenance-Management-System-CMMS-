import os
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# SQLite by default so the POC runs with no setup.
# For PostgreSQL set: DATABASE_URL=postgresql+psycopg2://user:pass@localhost/cmms
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cmms.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
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
