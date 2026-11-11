"""Engine / session factory. Works with PostgreSQL (+pgvector) and SQLite (tests, quick dev)."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
SessionLocal: sessionmaker[Session] = sessionmaker(autoflush=False, expire_on_commit=False)


def _make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        eng = create_engine(url, connect_args={"check_same_thread": False}, future=True)

        @event.listens_for(eng, "connect")
        def _fk_on(dbapi_conn, _):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

        return eng
    return create_engine(url, pool_pre_ping=True, pool_size=10, max_overflow=10, future=True)


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        configure_engine(get_settings().database_url)
    assert _engine is not None
    return _engine


def configure_engine(url: str) -> Engine:
    """(Re)bind the global engine — used by the app at start-up and by tests."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = _make_engine(url)
    SessionLocal.configure(bind=_engine)
    return _engine


def is_postgres() -> bool:
    return get_engine().dialect.name == "postgresql"


def get_db() -> Iterator[Session]:
    get_engine()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
