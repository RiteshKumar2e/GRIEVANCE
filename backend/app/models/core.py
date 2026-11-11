"""Users, departments, officers and the category master."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utcnow
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    data_source: Mapped[str] = mapped_column(String(16), default="LIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Department managed by a department administrator (role dept_admin); null for every other role.
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ward: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # {"status_updates": bool, "sla_alerts": bool, "escalations": bool}; missing keys mean "on".
    notification_prefs: Mapped[dict] = mapped_column(JSON, default=dict)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    officer: Mapped["Officer | None"] = relationship(back_populates="user", uselist=False)
    managed_department: Mapped["Department | None"] = relationship(foreign_keys=[department_id])


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    name_hi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name_mr: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    head_officer_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    escalation_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    data_source: Mapped[str] = mapped_column(String(16), default="SYNTHETIC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    officers: Mapped[list["Officer"]] = relationship(back_populates="department")
    categories: Mapped[list["GrievanceCategory"]] = relationship(back_populates="department")


class Officer(Base):
    __tablename__ = "officers"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    designation: Mapped[str] = mapped_column(String(120), default="Officer")
    wards: Mapped[list] = mapped_column(JSON, default=list)  # ward coverage; empty = all wards
    max_active_cases: Mapped[int] = mapped_column(Integer, default=25)
    handles_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    data_source: Mapped[str] = mapped_column(String(16), default="SYNTHETIC")

    user: Mapped[User | None] = relationship(back_populates="officer")
    department: Mapped[Department] = relationship(back_populates="officers")


class GrievanceCategory(Base):
    """The Category Master. Drives department mapping, SLA, sensitivity, identity hiding
    and the confidence threshold used by the policy gate."""

    __tablename__ = "grievance_categories"
    __table_args__ = (UniqueConstraint("code", name="uq_category_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), index=True)
    name_en: Mapped[str] = mapped_column(String(200))
    name_hi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name_mr: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    sla_hours: Mapped[int] = mapped_column(Integer, default=72)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    hide_identity: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.7)
    auto_close_allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    default_urgency: Mapped[str] = mapped_column(String(10), default="medium")
    keywords: Mapped[dict] = mapped_column(JSON, default=dict)  # {"en": [...], "hi": [...], "mr": [...]}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    data_source: Mapped[str] = mapped_column(String(16), default="SYNTHETIC")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    department: Mapped[Department | None] = relationship(back_populates="categories")
