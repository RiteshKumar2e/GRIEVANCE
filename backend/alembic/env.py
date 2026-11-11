"""Alembic environment — URL from app settings; pgvector extension created on PostgreSQL."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text

import app.models  # noqa: F401  (register models)
from app.db.session import Base, get_engine

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    from app.core.config import get_settings

    context.configure(url=get_settings().database_url, target_metadata=target_metadata, literal_binds=True,
                      dialect_opts={"paramstyle": "named"}, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    if connection.dialect.name == "postgresql":
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.commit()
    context.configure(connection=connection, target_metadata=target_metadata,
                      render_as_batch=connection.dialect.name == "sqlite", compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    given = config.attributes.get("connection")
    if given is not None:
        _run(given)
        return
    with get_engine().connect() as connection:
        _run(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
