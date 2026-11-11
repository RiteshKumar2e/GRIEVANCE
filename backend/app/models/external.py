"""External public datasets, kept in their own tables.

They never mix with the HackFusion Category Master, Mock Grievance History or Department Directory
(`grievance_categories`, `grievances`, `departments`): the agents' RAG, duplicate detection and SLA
prediction keep using those tables only. External data is reference evidence shown with its source.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utcnow
from app.db.session import Base


class ExternalDataset(Base):
    """Provenance record for one external dataset (or one fetched resource)."""

    __tablename__ = "external_datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    publisher: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(20))  # individual_records | aggregate_statistics | directory
    source_url: Mapped[str] = mapped_column(String(500))
    download_url: Mapped[str | None] = mapped_column(String(800), nullable=True)
    licence: Mapped[str] = mapped_column(String(200))
    licence_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    attribution: Mapped[str] = mapped_column(Text, default="")
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rows_in_source: Mapped[int] = mapped_column(Integer, default=0)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    coverage_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    coverage_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    columns: Mapped[list] = mapped_column(JSON, default=list)
    unavailable_fields: Mapped[list] = mapped_column(JSON, default=list)
    transformations: Mapped[list] = mapped_column(JSON, default=list)
    quality: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="registered")  # registered | imported | needs_credentials | failed
    notes: Mapped[str] = mapped_column(Text, default="")


class ExternalGrievanceRecord(Base):
    """One publicly released grievance record (e.g. BBMP Sahaaya 2.0), minimised and PII-redacted."""

    __tablename__ = "external_grievance_records"
    __table_args__ = (UniqueConstraint("dataset_id", "source_record_id", name="uq_external_record"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("external_datasets.id", ondelete="CASCADE"), index=True)
    source_record_id: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(120), index=True)
    sub_category: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    filed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    date_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    zone: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    ward: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    channel: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_status: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)  # verbatim status from the source
    staff_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)  # PII-redacted
    citizen_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)


class OfficialDatasetRow(Base):
    """Rows fetched from data.gov.in (OGD) resources, stored verbatim as JSON with their field metadata.
    Used for aggregate statistics (receipts/disposals) and the nodal officer directory."""

    __tablename__ = "official_dataset_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("external_datasets.id", ondelete="CASCADE"), index=True)
    resource_id: Mapped[str] = mapped_column(String(60), index=True)
    row: Mapped[dict] = mapped_column(JSON, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
