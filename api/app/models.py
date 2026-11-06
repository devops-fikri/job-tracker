"""Database tables. Portable types only (Postgres in production, SQLite in tests)."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


ID = String(64)
TS = DateTime(timezone=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class UserSession(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ID, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TS)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    file_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str | None] = mapped_column(String(255))  # null for seeded rows without a file
    content_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    company: Mapped[str] = mapped_column(String(200), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(200), default="")
    employment_type: Mapped[str] = mapped_column(String(32), default="Full-time")
    work_arrangement: Mapped[str] = mapped_column(String(32), default="Hybrid")
    salary_min: Mapped[float | None] = mapped_column(Float)
    salary_max: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="MYR")
    platform: Mapped[str] = mapped_column(String(32), default="Other")
    url: Mapped[str | None] = mapped_column(Text)
    applied_at: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), index=True)
    recruiter_name: Mapped[str | None] = mapped_column(String(200))
    recruiter_email: Mapped[str | None] = mapped_column(String(320))
    recruiter_phone: Mapped[str | None] = mapped_column(String(64))
    resume_version_id: Mapped[str | None] = mapped_column(ID, ForeignKey("resume_versions.id", ondelete="SET NULL"))
    cover_letter: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text, default="")
    last_communication: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow)

    timeline: Mapped[list["TimelineEvent"]] = relationship(
        back_populates="application", cascade="all, delete-orphan", order_by="TimelineEvent.at.desc()"
    )
    interviews: Mapped[list["Interview"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    follow_ups: Mapped[list["FollowUp"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)


class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(ID, ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(TS, default=utcnow, index=True)
    kind: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(16), default="manual")
    status: Mapped[str | None] = mapped_column(String(32))  # set for kind == "status"

    application: Mapped[Application] = relationship(back_populates="timeline")


class Interview(Base):
    __tablename__ = "interviews"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(ID, ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    start: Mapped[datetime] = mapped_column(TS, index=True)
    end: Mapped[datetime] = mapped_column(TS)
    time_zone: Mapped[str] = mapped_column(String(64), default="Asia/Kuala_Lumpur")
    type: Mapped[str] = mapped_column(String(32))
    platform: Mapped[str] = mapped_column(String(32))
    meeting_url: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    interviewers: Mapped[str] = mapped_column(Text, default="")
    prep_notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="scheduled")
    calendar_synced: Mapped[bool] = mapped_column(Boolean, default=False)


class FollowUp(Base):
    __tablename__ = "follow_ups"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(ID, ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    due: Mapped[date] = mapped_column(Date, index=True)
    reason: Mapped[str] = mapped_column(String(300))
    rule: Mapped[str] = mapped_column(String(32), default="custom")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    interview_id: Mapped[str | None] = mapped_column(ID)  # for after_interview rule de-duplication
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow)


class Email(Base):
    """Filled by the Gmail integration in Phase 2."""

    __tablename__ = "emails"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    gmail_message_id: Mapped[str] = mapped_column(String(64), unique=True)
    thread_id: Mapped[str] = mapped_column(String(64), index=True)
    received_at: Mapped[datetime] = mapped_column(TS)
    sender: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str] = mapped_column(Text)
    snippet: Mapped[str] = mapped_column(Text, default="")
    classification: Mapped[str] = mapped_column(String(40))
    confidence: Mapped[float] = mapped_column(Float, default=0)
    extracted: Mapped[dict] = mapped_column(JSON, default=dict)
    matched_application_id: Mapped[str | None] = mapped_column(ID, ForeignKey("applications.id", ondelete="SET NULL"))
    state: Mapped[str] = mapped_column(String(16), default="needs_review")


class AiAudit(Base):
    """Filled by the Hermes MCP integration in Phase 4."""

    __tablename__ = "ai_audit"
    id: Mapped[str] = mapped_column(ID, primary_key=True, default=new_id)
    at: Mapped[datetime] = mapped_column(TS, default=utcnow, index=True)
    tool: Mapped[str] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(8))
    approved: Mapped[bool] = mapped_column(Boolean, default=True)


class Profile(Base):
    """Single-row career profile (id is always 1). Stored as JSON; shape lives in schemas.ProfileData."""

    __tablename__ = "profile"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow)
