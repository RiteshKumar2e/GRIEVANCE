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


def upgrade() -> None:
    # batch mode so the same migration works on SQLite (no ALTER ... ADD CONSTRAINT) and PostgreSQL.
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("department_id", sa.Integer(), nullable=True))
        b.add_column(sa.Column("address", sa.String(length=300), nullable=True))
        b.add_column(sa.Column("ward", sa.String(length=80), nullable=True))
        b.add_column(sa.Column("notification_prefs", sa.JSON(), nullable=True))
        b.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
        b.create_foreign_key("fk_users_department_id", "departments", ["department_id"], ["id"])
        b.create_index("ix_users_department_id", ["department_id"])


def downgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.drop_index("ix_users_department_id")
        b.drop_constraint("fk_users_department_id", type_="foreignkey")
        for col in ("password_changed_at", "last_login_at", "notification_prefs", "ward", "address", "department_id"):
            b.drop_column(col)
