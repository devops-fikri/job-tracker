"""Business logic shared by the HTTP routes, the Celery jobs and (later) the MCP server."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from . import domain
from .config import get_settings
from .models import Application, Email, FollowUp, Interview, TimelineEvent, utcnow
from .schemas import ApplicationIn, ApplicationOut, Recruiter, StatsOut, TimelineEventOut, aware


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().timezone)


def today() -> date:
    return datetime.now(tz()).date()


def local_day(dt: datetime) -> date:
    return aware(dt).astimezone(tz()).date()


# ---------- serialisation ----------
def application_out(app: Application, next_follow_up: date | None = None) -> ApplicationOut:
    if next_follow_up is None:
        pending = [f.due for f in app.follow_ups if f.status == "pending"]
        next_follow_up = min(pending) if pending else None
    recruiter = Recruiter(name=app.recruiter_name, email=app.recruiter_email, phone=app.recruiter_phone) if app.recruiter_name else None
    return ApplicationOut(
        id=app.id,
        company=app.company,
        title=app.title,
        description=app.description,
        location=app.location,
        employment_type=app.employment_type,
        work_arrangement=app.work_arrangement,
        salary_min=app.salary_min,
        salary_max=app.salary_max,
        currency=app.currency,
        platform=app.platform,
        url=app.url,
        applied_at=app.applied_at,
        status=app.status,
        recruiter=recruiter,
        resume_version_id=app.resume_version_id,
        cover_letter=app.cover_letter,
        notes=app.notes,
        next_follow_up=next_follow_up,
        last_communication=app.last_communication,
        updated_at=app.updated_at,
        timeline=[TimelineEventOut.model_validate(e) for e in app.timeline],
    )


def load_applications(db: Session) -> list[Application]:
    q = (
        select(Application)
        .options(selectinload(Application.timeline), selectinload(Application.follow_ups))
        .order_by(Application.updated_at.desc())
    )
    return list(db.scalars(q))


# ---------- timeline ----------
def add_event(app: Application, kind: str, title: str, *, source: str = "manual", detail: str | None = None,
              status: str | None = None, at: datetime | None = None) -> TimelineEvent:
    ev = TimelineEvent(kind=kind, title=title, detail=detail, source=source, status=status, at=at or utcnow())
    app.timeline.insert(0, ev)
    app.updated_at = ev.at
    return ev


def apply_fields(app: Application, data: ApplicationIn) -> None:
    fields = data.model_dump(exclude={"recruiter", "status"})
    for k, v in fields.items():
        setattr(app, k, v)
    r = data.recruiter
    app.recruiter_name = r.name.strip() if r else None
    app.recruiter_email = r.email if r else None
    app.recruiter_phone = r.phone if r else None


def create_application(db: Session, data: ApplicationIn, *, app_id: str | None = None, source: str = "manual") -> Application:
    app = Application(id=app_id) if app_id else Application()
    app.timeline = []
    app.follow_ups = []
    apply_fields(app, data)
    app.status = data.status
    wishlist = domain.stage(data.status) == "wishlist"
    add_event(app, "created", "Saved to wishlist" if wishlist else f"Added ({data.platform})", source=source, status=data.status)
    db.add(app)
    return app


def update_application(db: Session, app: Application, data: ApplicationIn, *, source: str = "manual") -> Application:
    before = application_out(app).model_dump(exclude={"timeline", "updated_at", "next_follow_up", "last_communication", "status"})
    apply_fields(app, data)
    after = application_out(app).model_dump(exclude={"timeline", "updated_at", "next_follow_up", "last_communication", "status"})
    changed = [k for k in after if before.get(k) != after[k]]
    if changed:
        add_event(app, "note", "Details edited", source=source, detail=", ".join(changed))
    set_status(app, data.status, source=source)
    return app


def set_status(app: Application, status: str, *, source: str = "manual", detail: str | None = None) -> bool:
    if app.status == status:
        return False
    app.status = status
    add_event(app, "status", f"Status → {domain.label(status)}", source=source, status=status, detail=detail)
    if not domain.is_active(status) and domain.stage(status) != "wishlist":
        # Closed or accepted: automatic reminders no longer make sense.
        for f in app.follow_ups:
            if f.status == "pending" and f.rule != "custom":
                f.status = "not_required"
    return True


def add_note(app: Application, text: str, *, source: str = "manual") -> None:
    text = text.strip()
    app.notes = f"{app.notes}\n\n{text}" if app.notes else text
    add_event(app, "note", "Note added", source=source, detail=text)


def record_interview(app: Application, interview: Interview, *, created: bool, previous: Interview | None, source: str = "manual") -> None:
    if created:
        add_event(app, "interview", f"{interview.type} interview scheduled", source=source,
                  detail=aware(interview.start).astimezone(tz()).strftime("%d %b %Y, %I:%M %p"))
        if domain.stage(app.status) in {"applied", "assessment"}:
            set_status(app, "interview_scheduled", source="system", detail="Interview added")
    elif previous is not None and previous.status != interview.status:
        add_event(app, "interview", f"Interview {interview.status}", source=source)
        if interview.status == "completed" and app.status == "interview_scheduled":
            set_status(app, "interview_completed", source="system")
    elif previous is not None and (previous.start != interview.start or previous.end != interview.end):
        add_event(app, "interview", "Interview rescheduled", source=source,
                  detail=aware(interview.start).astimezone(tz()).strftime("%d %b %Y, %I:%M %p"))


# ---------- scheduled rules ----------
def _last_activity_day(app: Application) -> date:
    candidates = [app.updated_at] + ([app.last_communication] if app.last_communication else [])
    return max(local_day(c) for c in candidates)


def run_daily_rules(db: Session, *, on: date | None = None) -> dict[str, int]:
    """Create automatic follow-ups and mark long-silent applications as ghosted. Idempotent."""
    s = get_settings()
    on = on or today()
    created = ghosted = 0

    apps = list(db.scalars(select(Application).options(selectinload(Application.follow_ups), selectinload(Application.timeline))))
    for app in apps:
        if app.status not in domain.AWAITING:
            continue
        rules = {f.rule for f in app.follow_ups}
        idle = (on - _last_activity_day(app)).days

        if idle >= s.ghosted_after_days:
            set_status(app, "ghosted", source="system", detail=f"No response for {idle} days")
            ghosted += 1
            continue
        if "no_response_14d" not in rules and idle >= s.followup_no_response_days:
            app.follow_ups.append(FollowUp(due=on, rule="no_response_14d", reason=f"{idle} days without a response"))
            add_event(app, "followup", "Follow-up reminder created", source="system", detail="No response yet")
            created += 1
        elif "after_applied_7d" not in rules and "no_response_14d" not in rules \
                and (on - app.applied_at).days >= s.followup_after_applied_days:
            days = (on - app.applied_at).days
            app.follow_ups.append(FollowUp(due=on, rule="after_applied_7d", reason=f"{days} days since applying with no response"))
            add_event(app, "followup", "Follow-up reminder created", source="system", detail="Check in on the application")
            created += 1

    cutoff = on - timedelta(days=s.followup_after_interview_days)
    done = db.scalars(select(Interview).where(Interview.status == "completed"))
    by_id = {a.id: a for a in apps}
    for iv in done:
        app = by_id.get(iv.application_id)
        if app is None or domain.stage(app.status) != "interviewing" or local_day(iv.end) > cutoff:
            continue
        if any(f.interview_id == iv.id for f in app.follow_ups):
            continue
        app.follow_ups.append(FollowUp(due=on, rule="after_interview_7d", interview_id=iv.id,
                                       reason=f"No update since your {iv.type} interview on {local_day(iv.end):%d %b}"))
        add_event(app, "followup", "Follow-up reminder created", source="system", detail="After interview")
        created += 1

    db.commit()
    return {"followUpsCreated": created, "ghosted": ghosted}


# ---------- stats ----------
def stats(db: Session) -> StatsOut:
    apps = list(db.scalars(select(Application)))
    now = utcnow()
    upcoming = db.scalars(select(Interview).where(Interview.status == "scheduled")).all()
    pending_due = db.scalars(select(FollowUp).where(FollowUp.status == "pending", FollowUp.due <= today())).all()
    review = db.scalars(select(Email.id).where(Email.state == "needs_review")).all()
    submitted = [a for a in apps if domain.stage(a.status) != "wishlist"]
    by_status: dict[str, int] = {}
    by_platform: dict[str, int] = {}
    for a in apps:
        by_status[a.status] = by_status.get(a.status, 0) + 1
    for a in submitted:
        by_platform[a.platform] = by_platform.get(a.platform, 0) + 1
    return StatsOut(
        total=len(submitted),
        in_progress=sum(domain.is_active(a.status) for a in apps),
        interviews_scheduled=sum(aware(i.start) >= now for i in upcoming),
        offers=sum(a.status in {"offer_received", "offer_accepted"} for a in apps),
        rejected=sum(a.status == "rejected" for a in apps),
        awaiting=sum(a.status in domain.AWAITING for a in apps),
        follow_ups_due=len(pending_due),
        review_queue=len(review),
        by_status=by_status,
        by_platform=by_platform,
    )
