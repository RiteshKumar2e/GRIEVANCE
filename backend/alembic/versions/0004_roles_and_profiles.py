"""department admin role and profile fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-11 18:30:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = (
    ("address", sa.String(length=300)),
    ("ward", sa.String(length=80)),
    ("notification_prefs", sa.JSON()),
    ("last_login_at", sa.DateTime(timezone=True)),
    ("password_changed_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    # Plain ADD COLUMN (no table rebuild): safe on SQLite with foreign keys on and a live server, and on PostgreSQL.
    sqlite = op.get_bind().dialect.name == "sqlite"
    if sqlite:
        # SQLite accepts an inline REFERENCES clause on ADD COLUMN when the default is NULL.
        op.execute("ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)")
    else:
        op.add_column("users", sa.Column("department_id", sa.Integer(), nullable=True))
        op.create_foreign_key("fk_users_department_id", "users", "departments", ["department_id"], ["id"])
    for name, type_ in COLUMNS:
        op.add_column("users", sa.Column(name, type_, nullable=True))
    op.create_index("ix_users_department_id", "users", ["department_id"])


def downgrade() -> None:
    op.drop_index("ix_users_department_id", table_name="users")
    with op.batch_alter_table("users") as b:
        for name, _ in reversed(COLUMNS):
            b.drop_column(name)
        b.drop_column("department_id")
