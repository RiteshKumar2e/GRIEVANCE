"""Grievances and everything attached to an individual grievance."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utcnow
from app.db.session import Base
from app.db.types import EmbeddingVector


class Grievance(Base):
    __tablename__ = "grievances"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    external_ref: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)

    citizen_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(5), default="en")
    input_mode: Mapped[str] = mapped_column(String(10), default="text")  # text | voice | import

    location_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ward: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    category_id: Mapped[int | None] = mapped_column(ForeignKey("grievance_categories.id"), nullable=True, index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    assigned_officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), nullable=True, index=True)

    urgency: Mapped[str] = mapped_column(String(10), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="SUBMITTED", index=True)

    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_provider: Mapped[str | None] = mapped_column(String(60), nullable=True)
    policy_explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    needs_human_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    review_reasons: Mapped[list] = mapped_column(JSON, default=list)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    identity_hidden: Mapped[bool] = mapped_column(Boolean, default=False)

    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    reopen_count: Mapped[int] = mapped_column(Integer, default=0)
    resolution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    citizen_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    citizen_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_historical: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    data_source: Mapped[str] = mapped_column(String(16), default="LIVE", index=True)
    embedding: Mapped[list | None] = mapped_column(EmbeddingVector(384), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(120), nullable=True)

    duplicate_group_id: Mapped[int | None] = mapped_column(ForeignKey("duplicate_groups.id"), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    citizen = relationship("User", foreign_keys=[citizen_id])
    category = relationship("GrievanceCategory")
    department = relationship("Department")
    assigned_officer = relationship("Officer")
    duplicate_group = relationship("DuplicateGroup", back_populates="grievances", foreign_keys=[duplicate_group_id])
    status_history: Mapped[list["StatusHistory"]] = relationship(
        back_populates="grievance", order_by="StatusHistory.created_at", cascade="all, delete-orphan"
    )
    sla_record: Mapped["SlaRecord | None"] = relationship(back_populates="grievance", uselist=False, cascade="all, delete-orphan")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), nullable=True)
    actor: Mapped[str] = mapped_column(String(120))
    actor_type: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    department = relationship("Department")
    officer = relationship("Officer")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20))
    actor: Mapped[str] = mapped_column(String(120))
    actor_type: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    grievance: Mapped[Grievance] = relationship(back_populates="status_history")


class OfficerNote(Base):
    __tablename__ = "officer_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    author = relationship("User")


class DuplicateGroup(Base):
    """A *link* between related grievances. Members keep their own IDs, status, notifications
    and audit history — nothing is merged or deleted."""

    __tablename__ = "duplicate_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("grievance_categories.id"), nullable=True)
    ward: Mapped[str | None] = mapped_column(String(80), nullable=True)
    label: Mapped[str] = mapped_column(String(300))
    created_by: Mapped[str] = mapped_column(String(120), default="AI_SYSTEM")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    grievances: Mapped[list[Grievance]] = relationship(back_populates="duplicate_group", foreign_keys=[Grievance.duplicate_group_id])
    members: Mapped[list["DuplicateGroupMember"]] = relationship(back_populates="group", cascade="all, delete-orphan")


class DuplicateGroupMember(Base):
    __tablename__ = "duplicate_group_members"
    __table_args__ = (UniqueConstraint("group_id", "grievance_id", name="uq_group_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("duplicate_groups.id", ondelete="CASCADE"), index=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), index=True)
    matched_grievance_id: Mapped[int | None] = mapped_column(ForeignKey("grievances.id"), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    signals: Mapped[dict] = mapped_column(JSON, default=dict)  # semantic / geo / time / category
    linked_by: Mapped[str] = mapped_column(String(120), default="AI_SYSTEM")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    group: Mapped[DuplicateGroup] = relationship(back_populates="members")
    grievance = relationship("Grievance", foreign_keys=[grievance_id])


class RetrievedPrecedent(Base):
    __tablename__ = "retrieved_precedents"

    id: Mapped[int] = mapped_column(primary_key=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), index=True)
    precedent_id: Mapped[int] = mapped_column(ForeignKey("grievances.id"), index=True)
    rank: Mapped[int] = mapped_column(Integer)
    similarity: Mapped[float] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(Text)
    filter_scope: Mapped[str] = mapped_column(String(40), default="category")
    trace_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    precedent = relationship("Grievance", foreign_keys=[precedent_id])


class SlaRecord(Base):
    __tablename__ = "sla_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), unique=True)
    sla_hours: Mapped[int] = mapped_column(Integer)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(12), default="on_track", index=True)
    predicted_resolution_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    breach_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    prediction_basis: Mapped[dict] = mapped_column(JSON, default=dict)
    warnings_sent: Mapped[int] = mapped_column(Integer, default=0)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    breached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    grievance: Mapped[Grievance] = relationship(back_populates="sla_record")
