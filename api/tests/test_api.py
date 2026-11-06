from datetime import date, timedelta

from app import services
from app.db import SessionLocal
from app.models import Application, Interview
from tests.conftest import EMAIL, PASSWORD, new_app


# ---------- auth ----------
def test_requires_login(anon):
    assert anon.get("/state").status_code == 401
    assert anon.get("/healthz").status_code == 200


def test_login_wrong_password(anon):
    r = anon.post("/auth/login", json={"email": EMAIL, "password": "nope"})
    assert r.status_code == 401
    assert "jt_session" not in r.cookies


def test_login_cookie_flags(anon):
    r = anon.post("/auth/login", json={"email": EMAIL.upper(), "password": PASSWORD})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_logout(client):
    assert client.get("/auth/me").json()["email"] == EMAIL
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


# ---------- applications ----------
def test_create_and_state_shape(client):
    r = client.post("/applications", json=new_app(recruiter={"name": "Aina", "email": "", "phone": ""}, salaryMin=9000))
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["company"] == "Acme" and a["recruiter"] == {"name": "Aina", "email": None, "phone": None}
    assert a["timeline"][0]["kind"] == "created"
    s = client.get("/state").json()
    assert set(s) == {"now", "applications", "interviews", "followUps", "emails", "resumes", "audit"}
    assert s["applications"][0]["id"] == a["id"]
    assert s["applications"][0]["updatedAt"].endswith("+00:00")


def test_put_upsert_with_client_id(client):
    r = client.put("/applications/abc123", json=new_app())
    assert r.status_code == 201
    r = client.put("/applications/abc123", json=new_app(title="Senior Cloud Engineer", status="under_review"))
    assert r.status_code == 200
    t = r.json()["timeline"]
    assert [e["title"] for e in t[:2]] == ["Status → Under Review", "Details edited"]
    assert client.put("/applications/bad id!", json=new_app()).status_code == 422


def test_validation(client):
    assert client.post("/applications", json=new_app(company="   ")).status_code == 422
    assert client.post("/applications", json=new_app(status="hired")).status_code == 422
    assert client.post("/applications", json=new_app(resumeVersionId="nope")).status_code == 422


def test_status_and_notes(client):
    aid = client.post("/applications", json=new_app()).json()["id"]
    r = client.post(f"/applications/{aid}/status", json={"status": "rejected"})
    assert r.json()["status"] == "rejected"
    r = client.post(f"/applications/{aid}/notes", json={"text": "Asked for feedback"})
    assert r.json()["notes"] == "Asked for feedback"
    assert r.json()["timeline"][0]["title"] == "Note added"


def test_delete_cascades(client):
    aid = client.post("/applications", json=new_app()).json()["id"]
    client.post("/follow-ups", json={"applicationId": aid, "due": "2026-11-10", "reason": "ping"})
    assert client.delete(f"/applications/{aid}").status_code == 204
    s = client.get("/state").json()
    assert s["applications"] == [] and s["followUps"] == []


# ---------- interviews ----------
def test_interview_moves_status(client):
    aid = client.post("/applications", json=new_app()).json()["id"]
    iv = {"applicationId": aid, "start": "2026-11-12T10:00:00+08:00", "end": "2026-11-12T11:00:00+08:00",
          "type": "Technical", "platform": "Zoom"}
    assert client.put("/interviews/iv1", json=iv).status_code == 201
    app = client.get(f"/applications/{aid}").json()
    assert app["status"] == "interview_scheduled"
    client.put("/interviews/iv1", json={**iv, "status": "completed"})
    assert client.get(f"/applications/{aid}").json()["status"] == "interview_completed"
    bad = {**iv, "end": iv["start"]}
    assert client.put("/interviews/iv2", json=bad).status_code == 422
    assert client.put("/interviews/iv3", json={**iv, "start": "2026-11-12T10:00:00"}).status_code == 422


# ---------- follow-ups ----------
def test_followups(client):
    aid = client.post("/applications", json=new_app()).json()["id"]
    f = client.post("/follow-ups", json={"id": "f1", "applicationId": aid, "due": "2026-11-10", "reason": "Send portfolio"}).json()
    assert f["rule"] == "custom" and f["status"] == "pending"
    assert client.get(f"/applications/{aid}").json()["nextFollowUp"] == "2026-11-10"
    assert client.patch("/follow-ups/f1", json={"status": "completed"}).json()["status"] == "completed"
    assert client.get(f"/applications/{aid}").json()["nextFollowUp"] is None


def test_daily_rules_idempotent():
    today = services.today()
    with SessionLocal() as db:
        from app.schemas import ApplicationIn

        a7 = services.create_application(db, ApplicationIn(company="A", title="T", applied_at=today - timedelta(days=8)))
        old = services.create_application(db, ApplicationIn(company="B", title="T", applied_at=today - timedelta(days=60)))
        db.flush()
        # pretend nothing has happened for a while
        a7.updated_at = services.utcnow() - timedelta(days=8)
        for e in a7.timeline:
            e.at = a7.updated_at
        old.updated_at = services.utcnow() - timedelta(days=45)
        iv_app = services.create_application(db, ApplicationIn(company="C", title="T", applied_at=today - timedelta(days=20), status="interview_completed"))
        db.flush()
        db.add(Interview(application_id=iv_app.id, start=services.utcnow() - timedelta(days=10, hours=1),
                         end=services.utcnow() - timedelta(days=10), type="HR", platform="Zoom", status="completed"))
        db.commit()
        ids = a7.id, old.id, iv_app.id

    with SessionLocal() as db:
        first = services.run_daily_rules(db, on=services.today())
    with SessionLocal() as db:
        second = services.run_daily_rules(db, on=services.today())
    assert first == {"followUpsCreated": 2, "ghosted": 1}
    assert second == {"followUpsCreated": 0, "ghosted": 0}
    with SessionLocal() as db:
        assert db.get(Application, ids[1]).status == "ghosted"


def test_closing_application_clears_auto_followups(client):
    aid = client.post("/applications", json=new_app()).json()["id"]
    with SessionLocal() as db:
        from app.models import FollowUp

        db.add(FollowUp(id="auto1", application_id=aid, due=date.today(), reason="x", rule="after_applied_7d"))
        db.commit()
    client.post(f"/applications/{aid}/status", json={"status": "rejected"})
    fu = {f["id"]: f for f in client.get("/follow-ups").json()}
    assert fu["auto1"]["status"] == "not_required"


# ---------- resumes ----------
def test_resume_upload_download_delete(client):
    r = client.post("/resumes", files={"file": ("my cv.pdf", b"%PDF-1.7 hello", "application/pdf")}, data={"name": "General"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["hasFile"] is True
    got = client.get(f"/resumes/{rid}/file")
    assert got.status_code == 200 and got.content == b"%PDF-1.7 hello"
    assert client.delete(f"/resumes/{rid}").status_code == 204
    assert client.get(f"/resumes/{rid}/file").status_code == 404


def test_resume_rejects_bad_files(client):
    assert client.post("/resumes", files={"file": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 415
    assert client.post("/resumes", files={"file": ("x.pdf", b"not a pdf", "application/pdf")}).status_code == 415


# ---------- export / stats ----------
def test_csv_export_escapes_formulas(client):
    client.post("/applications", json=new_app(company="=HYPERLINK(\"x\")"))
    r = client.get("/export/applications.csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "'=HYPERLINK" in r.text


def test_stats(client):
    client.post("/applications", json=new_app())
    client.post("/applications", json=new_app(status="interested"))
    client.post("/applications", json=new_app(status="offer_received"))
    s = client.get("/stats").json()
    assert s["total"] == 2 and s["offers"] == 1 and s["awaiting"] == 1 and s["byStatus"]["interested"] == 1


def test_seed_demo(client):
    from app.cli import seed_demo

    seed_demo(force=False)
    s = client.get("/state").json()
    assert len(s["applications"]) == 22 and len(s["interviews"]) == 7 and len(s["emails"]) == 8
    assert s["emails"][0]["from"]
    assert len(s["resumes"]) == 2 and s["resumes"][0]["hasFile"] is False


def test_change_password_signs_out_others(client, anon):
    other = anon.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert other.status_code == 200
    assert client.post("/auth/password", json={"current": "wrong", "new": "x" * 12}).status_code == 400
    assert client.post("/auth/password", json={"current": PASSWORD, "new": "short"}).status_code == 422
    assert client.post("/auth/password", json={"current": PASSWORD, "new": "a brand new passphrase"}).status_code == 204
    assert client.get("/auth/me").status_code == 200  # this device stays signed in
    assert anon.get("/auth/me").status_code == 401  # the other one is signed out


def test_backups_list(client, tmp_path, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "backup_dir", str(tmp_path))
    assert client.get("/backups").json() == []
    (tmp_path / "jobtracker-20261106-0300.dump").write_bytes(b"x" * 10)
    (tmp_path / "other.txt").write_text("ignore")
    b = client.get("/backups").json()
    assert [x["name"] for x in b] == ["jobtracker-20261106-0300.dump"] and b[0]["sizeBytes"] == 10


def test_profile_roundtrip(client):
    assert client.get("/profile").json()["fullName"] == ""
    body = {
        "fullName": "Test User", "skills": ["AWS", "Linux"], "expectedSalary": 10000, "noticePeriod": "1 month",
        "workArrangements": ["Remote", "Hybrid"],
        "experience": [{"company": "Acme", "role": "DevOps", "start": "2024-01", "end": "", "highlights": "CI/CD"}],
        "education": [{"institution": "UiTM", "qualification": "BSc", "year": "2023"}],
    }
    r = client.put("/profile", json=body)
    assert r.status_code == 200 and r.json()["updatedAt"]
    got = client.get("/profile").json()
    assert got["skills"] == ["AWS", "Linux"] and got["experience"][0]["company"] == "Acme"
    assert client.put("/profile", json={"workArrangements": ["Mars"]}).status_code == 422


def test_migrations_match_models():
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.db import Base, engine

    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], diff
