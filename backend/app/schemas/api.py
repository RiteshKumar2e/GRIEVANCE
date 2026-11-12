"""Request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Lang = Literal["en", "hi", "mr"]
UrgencyT = Literal["low", "medium", "high", "critical"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- auth
class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=72)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9\- ]{7,20}$")
    preferred_language: Lang = "en"
    website: str | None = Field(default=None, max_length=200)  # honeypot: humans never fill this
    # Officer sign-ups are requests: the account stays inactive until a system admin approves it.
    # Department and system administrators are created only by a system administrator.
    role: Literal["citizen", "officer"] = "citizen"
    department_code: str | None = Field(default=None, max_length=40)
    designation: str | None = Field(default=None, max_length=120)

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not (any(c.isdigit() for c in v) and any(c.isalpha() for c in v)):
            raise ValueError("Password must contain letters and numbers")
        return v

    @field_validator("full_name")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    phone: str | None = None
    role: str
    preferred_language: str
    officer_code: str | None = None
    department_code: str | None = None
    department_name: str | None = None
    designation: str | None = None
    handles_sensitive: bool | None = None
    address: str | None = None
    ward: str | None = None
    notification_prefs: dict[str, bool] = {}
    created_at: datetime | None = None
    last_login_at: datetime | None = None
    password_changed_at: datetime | None = None
    permissions: list[str] = []
    editable_fields: list[str] = []


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


def _strong_password(v: str) -> str:
    if not (any(c.isdigit() for c in v) and any(c.isalpha() for c in v)):
        raise ValueError("Password must contain letters and numbers")
    return v


class ProfileUpdate(BaseModel):
    """Self-service profile edit. Which of these fields a role may change is enforced in api.auth."""
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9\- ]{7,20}$")
    preferred_language: Lang | None = None
    address: str | None = Field(default=None, max_length=300)
    ward: str | None = Field(default=None, max_length=80)
    notification_prefs: dict[str, bool] | None = None

    @field_validator("full_name", "address", "ward")
    @classmethod
    def strip(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        return _strong_password(v)


# ---------------------------------------------------------------- intake
class IntakeIn(BaseModel):
    text: str = Field(min_length=10, max_length=5000)
    language: Lang | None = None
    location: str | None = Field(default=None, max_length=300)
    input_mode: Literal["text", "voice"] = "text"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)


class ConverseIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    language: Lang | None = None
    input_mode: Literal["text", "voice"] = "text"
    finish: bool = False  # citizen asks for the draft now, without more questions


class DraftOut(BaseModel):
    draft_token: str
    expires_at: datetime
    trace_id: str | None
    raw_text: str
    extraction: dict[str, Any]


class ConfirmIn(BaseModel):
    confirmed: bool
    title: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, min_length=10, max_length=8000)
    category_code: str | None = Field(default=None, max_length=60)
    location_text: str | None = Field(default=None, max_length=300)
    ward: str | None = Field(default=None, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    urgency: UrgencyT | None = None


class TranscriptOut(BaseModel):
    text: str
    language: str
    confidence: float
    provider: str


# ---------------------------------------------------------------- grievances
class StatusHistoryOut(ORM):
    from_status: str | None
    to_status: str
    actor_label: str
    actor_type: str
    note: str
    created_at: datetime


class FeedbackIn(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class DisputeIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


class StatusUpdateIn(BaseModel):
    status: Literal["IN_PROGRESS", "RESOLVED", "CLOSED"]
    note: str = Field(default="", max_length=2000)
    resolution_summary: str | None = Field(default=None, max_length=4000)


class NoteIn(BaseModel):
    body: str = Field(min_length=2, max_length=4000)


class ReviewDecisionIn(BaseModel):
    category_code: str | None = Field(default=None, max_length=60)
    officer_code: str | None = Field(default=None, max_length=40)
    note: str = Field(min_length=3, max_length=2000)


class ReassignIn(BaseModel):
    officer_code: str = Field(max_length=40)
    note: str = Field(min_length=3, max_length=2000)


class EscalateIn(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)


class UnlinkIn(BaseModel):
    note: str = Field(min_length=3, max_length=1000)


# ---------------------------------------------------------------- admin
class CategoryUpdate(BaseModel):
    sla_hours: int | None = Field(default=None, ge=1, le=24 * 60)
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    is_sensitive: bool | None = None
    hide_identity: bool | None = None
    auto_close_allowed: bool | None = None
    is_active: bool | None = None
    department_code: str | None = None


class OfficerCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=72)
    officer_code: str = Field(pattern=r"^[A-Z0-9\-]{3,40}$")
    department_code: str
    designation: str = "Officer"
    wards: list[str] = []
    max_active_cases: int = Field(default=25, ge=1, le=500)
    handles_sensitive: bool = False


class OfficerUpdate(BaseModel):
    is_active: bool | None = None
    max_active_cases: int | None = Field(default=None, ge=1, le=500)
    handles_sensitive: bool | None = None
    wards: list[str] | None = None


class WebhookIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    url: str = Field(pattern=r"^https?://", max_length=500)
    events: list[str] = []
    is_active: bool = True


class ConverseOut(BaseModel):
    reply: str
    ready: bool
    language: str
    missing: list[str]
    trace_id: str | None = None
    draft: DraftOut | None = None


# ---------------------------------------------------------------- administration: users, departments, team
class UserCreateIn(BaseModel):
    """System-admin account creation for citizen, dept_admin and admin roles (officers use OfficerCreate)."""
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=72)
    role: Literal["citizen", "dept_admin", "admin"]
    department_code: str | None = Field(default=None, max_length=40)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9\- ]{7,20}$")

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        return _strong_password(v)


class UserAdminUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool | None = None
    department_code: str | None = Field(default=None, max_length=40)  # only for dept_admin accounts


class DepartmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9\- ]{7,20}$")
    escalation_contact: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class TeamOfficerUpdate(BaseModel):
    """What a department administrator may change about an officer in their own department."""
    model_config = ConfigDict(extra="forbid")

    is_active: bool | None = None
    max_active_cases: int | None = Field(default=None, ge=1, le=500)
    wards: list[str] | None = None
