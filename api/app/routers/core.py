import csv
import io
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import services
from ..auth import current_user
from ..config import get_settings
from ..db import get_db
from ..models import AiAudit, Application, Email, FollowUp, Interview, Profile, ResumeVersion, utcnow
from ..schemas import (
    ApplicationIn, ApplicationOut, AuditOut, BackupOut, EmailOut, EmailResolveIn, FollowUpIn, FollowUpOut, FollowUpPatch,
    InterviewIn, InterviewOut, NoteIn, ProfileData, ProfileOut, ResumeOut, ResumePatch, StateOut, StatsOut, StatusIn,
)

router = APIRouter(dependencies=[Depends(current_user)])

ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _check_id(id: str) -> str:
    if not ID_RE.match(id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid id")
    return id


def _app_or_404(db: Session, id: str) -> Application:
    app = db.scalar(
        select(Application)
        .where(Application.id == id)
        .options(selectinload(Application.timeline), selectinload(Application.follow_ups))
    )
    if app is None:
        raise HTTPException(404, "Application not found")
    return app


def _check_resume(db: Session, resume_id: str | None) -> None:
    if resume_id and db.get(ResumeVersion, resume_id) is None:
        raise HTTPException(422, "Unknown resume version")


def _resume_out(r: ResumeVersion) -> ResumeOut:
    out = ResumeOut.model_validate(r)
    out.has_file = bool(r.stored_name)
    return out


# ---------- bootstrap ----------
@router.get("/state", response_model=StateOut, response_model_by_alias=True)
def state(db: Session = Depends(get_db)):
    """Everything the web UI needs in one round trip (single-user app, small data)."""
    return StateOut(
        now=utcnow(),
        applications=[services.application_out(a) for a in services.load_applications(db)],
        interviews=[InterviewOut.model_validate(i) for i in db.scalars(select(Interview).order_by(Interview.start))],
        follow_ups=[FollowUpOut.model_validate(f) for f in db.scalars(select(FollowUp).order_by(FollowUp.due))],
        emails=[EmailOut.model_validate(e) for e in db.scalars(select(Email).order_by(Email.received_at.desc()))],
        resumes=[_resume_out(r) for r in db.scalars(select(ResumeVersion).order_by(ResumeVersion.uploaded_at))],
        audit=[AuditOut.model_validate(a) for a in db.scalars(select(AiAudit).order_by(AiAudit.at.desc()).limit(200))],
    )


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    return services.stats(db)


# ---------- applications ----------
@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db)):
    return [services.application_out(a) for a in services.load_applications(db)]


@router.post("/applications", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationIn, db: Session = Depends(get_db)):
    _check_resume(db, body.resume_version_id)
    app = services.create_application(db, body)
    db.commit()
    return services.application_out(app)


@router.get("/applications/{id}", response_model=ApplicationOut)
def get_application(id: str, db: Session = Depends(get_db)):
    return services.application_out(_app_or_404(db, id))


@router.put("/applications/{id}", response_model=ApplicationOut)
def put_application(id: str, body: ApplicationIn, response: Response, db: Session = Depends(get_db)):
    """Create-or-replace. The web client generates ids so it can update optimistically."""
    _check_id(id)
    _check_resume(db, body.resume_version_id)
    existing = db.get(Application, id)
    if existing is None:
        app = services.create_application(db, body, app_id=id)
        response.status_code = 201
    else:
        app = services.update_application(db, _app_or_404(db, id), body)
    db.commit()
    return services.application_out(app)


@router.delete("/applications/{id}", status_code=204)
def delete_application(id: str, db: Session = Depends(get_db)):
    db.delete(_app_or_404(db, id))
    db.commit()


@router.post("/applications/{id}/status", response_model=ApplicationOut)
def set_status(id: str, body: StatusIn, db: Session = Depends(get_db)):
    app = _app_or_404(db, id)
    services.set_status(app, body.status)
    db.commit()
    return services.application_out(app)


@router.post("/applications/{id}/notes", response_model=ApplicationOut)
def add_note(id: str, body: NoteIn, db: Session = Depends(get_db)):
    app = _app_or_404(db, id)
    services.add_note(app, body.text)
    db.commit()
    return services.application_out(app)


# ---------- interviews ----------
@router.get("/interviews", response_model=list[InterviewOut])
def list_interviews(db: Session = Depends(get_db)):
    return db.scalars(select(Interview).order_by(Interview.start)).all()


@router.put("/interviews/{id}", response_model=InterviewOut)
def put_interview(id: str, body: InterviewIn, response: Response, db: Session = Depends(get_db)):
    _check_id(id)
    if body.end <= body.start:
        raise HTTPException(422, "Interview must end after it starts")
    app = _app_or_404(db, body.application_id)
    iv = db.get(Interview, id)
    previous = None
    if iv is None:
        iv = Interview(id=id)
        db.add(iv)
        response.status_code = 201
    else:
        if iv.application_id != body.application_id:
            raise HTTPException(422, "An interview can't be moved to another application")
        previous = Interview(status=iv.status, start=iv.start, end=iv.end)
    for k, v in body.model_dump().items():
        setattr(iv, k, v)
    if previous is not None:
        previous.start, previous.end = services.aware(previous.start), services.aware(previous.end)
    services.record_interview(app, iv, created=previous is None, previous=previous)
    db.commit()
    return iv


@router.delete("/interviews/{id}", status_code=204)
def delete_interview(id: str, db: Session = Depends(get_db)):
    iv = db.get(Interview, id)
    if iv is None:
        raise HTTPException(404, "Interview not found")
    db.delete(iv)
    db.commit()


# ---------- follow-ups ----------
@router.get("/follow-ups", response_model=list[FollowUpOut])
def list_follow_ups(db: Session = Depends(get_db)):
    return db.scalars(select(FollowUp).order_by(FollowUp.due)).all()


@router.post("/follow-ups", response_model=FollowUpOut, status_code=201)
def create_follow_up(body: FollowUpIn, db: Session = Depends(get_db)):
    app = _app_or_404(db, body.application_id)
    if body.id:
        _check_id(body.id)
        if db.get(FollowUp, body.id):
            raise HTTPException(409, "Follow-up already exists")
    f = FollowUp(id=body.id or uuid.uuid4().hex, application_id=app.id, due=body.due, reason=body.reason.strip() or "Custom follow-up", rule="custom")
    app.follow_ups.append(f)
    services.add_event(app, "followup", "Follow-up added", detail=f"{f.reason} (due {f.due:%d %b})")
    db.commit()
    return f


@router.patch("/follow-ups/{id}", response_model=FollowUpOut)
def patch_follow_up(id: str, body: FollowUpPatch, db: Session = Depends(get_db)):
    f = db.get(FollowUp, id)
    if f is None:
        raise HTTPException(404, "Follow-up not found")
    for k, v in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return f


@router.delete("/follow-ups/{id}", status_code=204)
def delete_follow_up(id: str, db: Session = Depends(get_db)):
    f = db.get(FollowUp, id)
    if f is None:
        raise HTTPException(404, "Follow-up not found")
    db.delete(f)
    db.commit()


# ---------- emails (populated in Phase 2) ----------
@router.get("/emails", response_model=list[EmailOut])
def list_emails(db: Session = Depends(get_db)):
    return db.scalars(select(Email).order_by(Email.received_at.desc())).all()


@router.post("/emails/{id}/resolve", response_model=EmailOut)
def resolve_email(id: str, body: EmailResolveIn, db: Session = Depends(get_db)):
    email = db.get(Email, id)
    if email is None:
        raise HTTPException(404, "Email not found")
    email.state = body.state
    if body.application_id:
        app = _app_or_404(db, body.application_id)
        email.matched_application_id = app.id
        services.add_event(app, "email", "Email linked from review queue", source="gmail", detail=email.subject)
        app.last_communication = max(filter(None, [services.aware(app.last_communication), services.aware(email.received_at)]))
    db.commit()
    return email


# ---------- resumes ----------
ALLOWED = {".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


@router.get("/resumes", response_model=list[ResumeOut])
def list_resumes(db: Session = Depends(get_db)):
    return [_resume_out(r) for r in db.scalars(select(ResumeVersion).order_by(ResumeVersion.uploaded_at))]


@router.post("/resumes", response_model=ResumeOut, status_code=201)
def upload_resume(file: UploadFile = File(...), name: str = Form(""), notes: str = Form(""), db: Session = Depends(get_db)):
    s = get_settings()
    original = Path(file.filename or "resume").name[:200]
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(415, "Only PDF and DOCX files are accepted")
    data = file.file.read(s.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {s.max_upload_mb} MB")
    magic_ok = data.startswith(b"%PDF-") if ext == ".pdf" else data.startswith(b"PK\x03\x04")
    if not magic_ok:
        raise HTTPException(415, "File content doesn't match its extension")
    rid = uuid.uuid4().hex
    stored = f"{rid}{ext}"
    os.makedirs(s.upload_dir, exist_ok=True)
    path = Path(s.upload_dir) / stored
    with open(path, "xb") as fh:
        fh.write(data)
    r = ResumeVersion(id=rid, name=(name.strip() or Path(original).stem)[:200], file_name=original, stored_name=stored,
                      content_type=ALLOWED[ext], size_bytes=len(data), notes=notes.strip())
    db.add(r)
    db.commit()
    return _resume_out(r)


@router.patch("/resumes/{id}", response_model=ResumeOut)
def patch_resume(id: str, body: ResumePatch, db: Session = Depends(get_db)):
    r = db.get(ResumeVersion, id)
    if r is None:
        raise HTTPException(404, "Resume not found")
    for k, v in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    return _resume_out(r)


@router.get("/resumes/{id}/file")
def download_resume(id: str, db: Session = Depends(get_db)):
    r = db.get(ResumeVersion, id)
    if r is None or not r.stored_name:
        raise HTTPException(404, "File not found")
    path = Path(get_settings().upload_dir) / r.stored_name
    if not path.is_file():
        raise HTTPException(404, "File missing on disk")
    return FileResponse(path, media_type=r.content_type, filename=r.file_name)


@router.delete("/resumes/{id}", status_code=204)
def delete_resume(id: str, db: Session = Depends(get_db)):
    r = db.get(ResumeVersion, id)
    if r is None:
        raise HTTPException(404, "Resume not found")
    stored = r.stored_name
    db.delete(r)
    db.commit()
    if stored:
        (Path(get_settings().upload_dir) / stored).unlink(missing_ok=True)


# ---------- profile ----------
@router.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)):
    p = db.get(Profile, 1)
    if p is None:
        return ProfileOut()
    return ProfileOut(**ProfileData.model_validate(p.data).model_dump(), updated_at=p.updated_at)


@router.put("/profile", response_model=ProfileOut)
def put_profile(body: ProfileData, db: Session = Depends(get_db)):
    p = db.get(Profile, 1) or Profile(id=1)
    p.data = body.model_dump(mode="json")
    p.updated_at = utcnow()
    db.add(p)
    db.commit()
    return ProfileOut(**body.model_dump(), updated_at=p.updated_at)


# ---------- backups (read-only view of the backup container's output) ----------
@router.get("/backups", response_model=list[BackupOut])
def list_backups():
    d = Path(get_settings().backup_dir)
    if not d.is_dir():
        return []
    files = sorted(d.glob("jobtracker-*.dump"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [BackupOut(name=f.name, size_bytes=f.stat().st_size,
                      created_at=datetime.fromtimestamp(f.stat().st_mtime, timezone.utc)) for f in files]


# ---------- export ----------
CSV_COLUMNS = [
    "company", "title", "status", "appliedAt", "platform", "location", "workArrangement", "employmentType",
    "salaryMin", "salaryMax", "currency", "url", "recruiterName", "recruiterEmail", "nextFollowUp", "updatedAt", "notes",
]


def _csv_safe(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s  # block spreadsheet formula injection


@router.get("/export/applications.csv")
def export_csv(db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_COLUMNS)
    for a in services.load_applications(db):
        o = services.application_out(a).model_dump(mode="json", by_alias=True)
        r = o.get("recruiter") or {}
        o["recruiterName"], o["recruiterEmail"] = r.get("name"), r.get("email")
        w.writerow([_csv_safe(o.get(c)) for c in CSV_COLUMNS])
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="applications-{services.today()}.csv"'},
    )
