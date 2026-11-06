"""JSON shapes. Field names are camelCase on the wire to match web/src/lib/types.ts."""

from datetime import date, datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, field_validator
from pydantic.alias_generators import to_camel

from .domain import (
    EmailClass, EmailState, EmploymentType, EventKind, EventSource, FollowUpRule, FollowUpStatus,
    InterviewPlatform, InterviewStatus, InterviewType, Platform, StatusId, WorkArrangement,
)


def aware(dt: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; treat naive values as UTC."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    @field_serializer("*", when_used="json")
    def _ts(self, v):
        if isinstance(v, datetime):
            return aware(v).isoformat()
        return v


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


# ---------- auth ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class PasswordIn(BaseModel):
    current: str = Field(min_length=1, max_length=1024)
    new: str = Field(min_length=12, max_length=1024)


class MeOut(Camel):
    id: str
    email: str


# ---------- applications ----------
class Recruiter(Camel):
    name: str = Field(max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=64)

    _blank = field_validator("email", "phone", mode="before")(_blank_to_none)


class TimelineEventOut(Camel):
    id: str
    at: datetime
    kind: EventKind
    title: str
    detail: str | None = None
    source: EventSource


class ApplicationIn(Camel):
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    location: str = Field(default="", max_length=200)
    employment_type: EmploymentType = "Full-time"
    work_arrangement: WorkArrangement = "Hybrid"
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    currency: str = Field(default="MYR", min_length=3, max_length=8)
    platform: Platform = "Other"
    url: str | None = None
    applied_at: date
    status: StatusId = "applied"
    recruiter: Recruiter | None = None
    resume_version_id: str | None = None
    cover_letter: str | None = None
    notes: str = ""

    _blank = field_validator("url", "resume_version_id", "cover_letter", mode="before")(_blank_to_none)

    @field_validator("company", "title", mode="after")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("recruiter", mode="before")
    @classmethod
    def _empty_recruiter(cls, v):
        if isinstance(v, dict) and not (v.get("name") or "").strip():
            return None
        return v


class ApplicationOut(ApplicationIn):
    id: str
    next_follow_up: date | None = None
    last_communication: datetime | None = None
    updated_at: datetime
    timeline: list[TimelineEventOut] = []


class StatusIn(BaseModel):
    status: StatusId


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


# ---------- interviews ----------
class InterviewIn(Camel):
    application_id: str
    start: datetime
    end: datetime
    time_zone: str = "Asia/Kuala_Lumpur"
    type: InterviewType
    platform: InterviewPlatform
    meeting_url: str | None = None
    location: str | None = None
    interviewers: str = ""
    prep_notes: str = ""
    status: InterviewStatus = "scheduled"

    _blank = field_validator("meeting_url", "location", mode="before")(_blank_to_none)

    @field_validator("start", "end")
    @classmethod
    def _tz(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("timestamp must include a timezone offset")
        return v


class InterviewOut(InterviewIn):
    id: str
    calendar_synced: bool = False

    @field_validator("start", "end")
    @classmethod
    def _tz(cls, v: datetime) -> datetime:  # overrides the input check: DB values are trusted
        return aware(v)


# ---------- follow-ups ----------
class FollowUpIn(Camel):
    id: str | None = Field(default=None, max_length=64)
    application_id: str
    due: date
    reason: str = Field(default="Custom follow-up", max_length=300)


class FollowUpPatch(Camel):
    status: FollowUpStatus | None = None
    due: date | None = None
    reason: str | None = Field(default=None, max_length=300)


class FollowUpOut(Camel):
    id: str
    application_id: str
    due: date
    reason: str
    rule: FollowUpRule
    status: FollowUpStatus


# ---------- emails ----------
class EmailOut(Camel):
    id: str
    gmail_message_id: str
    thread_id: str
    received_at: datetime
    sender: str = Field(serialization_alias="from")
    subject: str
    snippet: str
    classification: EmailClass
    confidence: float
    extracted: dict
    matched_application_id: str | None = None
    state: EmailState


class EmailResolveIn(Camel):
    state: EmailState
    application_id: str | None = None


# ---------- resumes ----------
class ResumeOut(Camel):
    id: str
    name: str
    file_name: str
    uploaded_at: datetime
    notes: str
    has_file: bool = False
    size_bytes: int | None = None


class ResumePatch(Camel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None


# ---------- profile ----------
Str200 = Annotated[str, Field(max_length=200)]


class Experience(Camel):
    company: Str200 = ""
    role: Str200 = ""
    start: Annotated[str, Field(max_length=7)] = ""  # YYYY-MM
    end: Annotated[str, Field(max_length=7)] = ""  # YYYY-MM, blank = present
    highlights: Annotated[str, Field(max_length=5000)] = ""


class Education(Camel):
    institution: Str200 = ""
    qualification: Str200 = ""
    year: Annotated[str, Field(max_length=10)] = ""


class ProfileData(Camel):
    full_name: Str200 = ""
    headline: Str200 = ""
    current_position: Str200 = ""
    summary: Annotated[str, Field(max_length=5000)] = ""
    skills: Annotated[list[Str200], Field(max_length=100)] = []
    certifications: Annotated[list[Str200], Field(max_length=100)] = []
    experience: Annotated[list[Experience], Field(max_length=30)] = []
    education: Annotated[list[Education], Field(max_length=20)] = []
    preferred_locations: Annotated[list[Str200], Field(max_length=50)] = []
    career_interests: Annotated[str, Field(max_length=1000)] = ""
    expected_salary: Annotated[float | None, Field(ge=0)] = None
    notice_period: Annotated[str, Field(max_length=40)] = ""
    work_arrangements: list[WorkArrangement] = []


class ProfileOut(ProfileData):
    updated_at: datetime | None = None


# ---------- misc ----------
class AuditOut(Camel):
    id: str
    at: datetime
    tool: str
    summary: str
    kind: str
    approved: bool


class StateOut(Camel):
    now: datetime
    applications: list[ApplicationOut]
    interviews: list[InterviewOut]
    follow_ups: list[FollowUpOut]
    emails: list[EmailOut]
    resumes: list[ResumeOut]
    audit: list[AuditOut]


class BackupOut(Camel):
    name: str
    size_bytes: int
    created_at: datetime


class StatsOut(Camel):
    total: int
    in_progress: int
    interviews_scheduled: int
    offers: int
    rejected: int
    awaiting: int
    follow_ups_due: int
    review_queue: int
    by_status: dict[str, int]
    by_platform: dict[str, int]
