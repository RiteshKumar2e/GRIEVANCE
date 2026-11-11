from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover
        return self.value


class Role(StrEnum):
    CITIZEN = "citizen"
    OFFICER = "officer"
    DEPT_ADMIN = "dept_admin"   # manages one department (users.department_id)
    ADMIN = "admin"             # system administrator


STAFF_ROLES = {Role.OFFICER.value, Role.DEPT_ADMIN.value, Role.ADMIN.value}


class DataSource(StrEnum):
    SYNTHETIC = "SYNTHETIC"   # generated demo data — never presented as official
    OFFICIAL = "OFFICIAL"     # imported official HackFusion datasets
    LIVE = "LIVE"             # submitted through this application


class GrievanceStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    PENDING_REVIEW = "PENDING_REVIEW"   # human review required before assignment
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"               # officer marked resolved; awaiting citizen
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"


OPEN_STATUSES = {
    GrievanceStatus.SUBMITTED,
    GrievanceStatus.PENDING_REVIEW,
    GrievanceStatus.ASSIGNED,
    GrievanceStatus.IN_PROGRESS,
    GrievanceStatus.REOPENED,
}


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActorType(StrEnum):
    AI = "AI_SYSTEM"
    CITIZEN = "CITIZEN"
    OFFICER = "OFFICER"
    DEPT_ADMIN = "DEPT_ADMIN"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"  # deterministic scheduled jobs that are not AI decisions


AI_ACTOR = "AI_SYSTEM"


class SlaState(StrEnum):
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BREACHED = "breached"
    MET = "met"
    MISSED = "missed"   # resolved after the deadline
