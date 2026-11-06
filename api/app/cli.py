"""Admin commands, run inside the api container:

    python -m app.cli create-user you@example.com      (prompts for the password)
    python -m app.cli set-password you@example.com
    python -m app.cli seed-demo [--force]               (fictional sample data, shifted to today)
    python -m app.cli run-rules                         (run the daily follow-up rules now)
"""

import argparse
import getpass
import json
import sys
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import func, select

from . import services
from .auth import hash_password
from .db import SessionLocal
from .models import AiAudit, Application, Email, FollowUp, Interview, ResumeVersion, TimelineEvent, User

DEMO = Path(__file__).parent / "seed" / "demo.json"


def _password(confirm: bool = True) -> str:
    pw = getpass.getpass("Password (min 12 chars): ")
    if len(pw) < 12:
        sys.exit("Password must be at least 12 characters.")
    if confirm and getpass.getpass("Repeat password: ") != pw:
        sys.exit("Passwords don't match.")
    return pw


def create_user(email: str) -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            sys.exit("A user already exists. This app is single-user; use set-password to change it.")
        db.add(User(email=email.lower(), password_hash=hash_password(_password())))
        db.commit()
    print(f"Created {email.lower()}")


def set_password(email: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if user is None:
            sys.exit("No such user.")
        user.password_hash = hash_password(_password())
        db.commit()
    print("Password updated. Existing sessions stay valid until they expire.")


def seed_demo(force: bool) -> None:
    data = json.loads(DEMO.read_text())
    shift = date.today() - date.fromisoformat(data["anchor"])

    def d(s: str | None):
        return None if s is None else date.fromisoformat(s) + shift

    def ts(s: str | None):
        return None if s is None else datetime.fromisoformat(s) + shift

    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Application)) and not force:
            sys.exit("The database already has applications. Re-run with --force to add the demo data anyway.")
        for r in data["resumes"]:
            db.merge(ResumeVersion(id=r["id"], name=r["name"], file_name=r["fileName"], notes=r["notes"], uploaded_at=ts(r["uploadedAt"])))
        db.flush()
        for a in data["applications"]:
            rec = a.get("recruiter") or {}
            app = Application(
                id=a["id"], company=a["company"], title=a["title"], description=a["description"], location=a["location"],
                employment_type=a["employmentType"], work_arrangement=a["workArrangement"], salary_min=a.get("salaryMin"),
                salary_max=a.get("salaryMax"), currency=a["currency"], platform=a["platform"], url=a.get("url"),
                applied_at=d(a["appliedAt"]), status=a["status"], recruiter_name=rec.get("name"),
                recruiter_email=rec.get("email"), recruiter_phone=rec.get("phone"),
                resume_version_id=a.get("resumeVersionId"), notes=a["notes"],
                last_communication=ts(a.get("lastCommunication")), updated_at=ts(a["updatedAt"]),
            )
            app.timeline = [
                TimelineEvent(kind=e["kind"], title=e["title"], detail=e.get("detail"), source=e["source"], at=ts(e["at"]))
                for e in a["timeline"]
            ]
            db.merge(app)
        db.flush()
        for i in data["interviews"]:
            db.merge(Interview(
                id=i["id"], application_id=i["applicationId"], start=ts(i["start"]), end=ts(i["end"]), time_zone=i["timeZone"],
                type=i["type"], platform=i["platform"], meeting_url=i.get("meetingUrl"), location=i.get("location"),
                interviewers=i["interviewers"], prep_notes=i["prepNotes"], status=i["status"], calendar_synced=i["calendarSynced"],
            ))
        for f in data["followUps"]:
            db.merge(FollowUp(id=f["id"], application_id=f["applicationId"], due=d(f["due"]), reason=f["reason"], rule=f["rule"], status=f["status"]))
        for m in data["emails"]:
            db.merge(Email(
                id=m["id"], gmail_message_id=m["gmailMessageId"], thread_id=m["threadId"], received_at=ts(m["receivedAt"]),
                sender=m["from"], subject=m["subject"], snippet=m["snippet"], classification=m["classification"],
                confidence=m["confidence"], extracted={k: (str(ts(v).isoformat()) if k == "interviewAt" else v) for k, v in m["extracted"].items()},
                matched_application_id=m.get("matchedApplicationId"), state=m["state"],
            ))
        for x in data["audit"]:
            db.merge(AiAudit(id=x["id"], at=ts(x["at"]), tool=x["tool"], summary=x["summary"], kind=x["kind"], approved=x["approved"]))
        db.commit()
    print(f"Seeded demo data (dates shifted by {shift.days} days).")


def run_rules() -> None:
    with SessionLocal() as db:
        print(services.run_daily_rules(db))


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("create-user").add_argument("email")
    sub.add_parser("set-password").add_argument("email")
    sub.add_parser("seed-demo").add_argument("--force", action="store_true")
    sub.add_parser("run-rules")
    a = p.parse_args(argv)
    if a.cmd == "create-user":
        create_user(a.email)
    elif a.cmd == "set-password":
        set_password(a.email)
    elif a.cmd == "seed-demo":
        seed_demo(a.force)
    elif a.cmd == "run-rules":
        run_rules()


if __name__ == "__main__":
    main()
