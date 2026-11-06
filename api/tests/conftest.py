import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="jt-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.auth import hash_password  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

EMAIL, PASSWORD = "me@example.com", "correct horse battery"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    command.upgrade(cfg, "head")  # exercises the real migration
    with SessionLocal() as db:
        db.add(User(email=EMAIL, password_hash=hash_password(PASSWORD)))
        db.commit()
    yield


@pytest.fixture
def anon():
    return TestClient(app)


@pytest.fixture
def client():
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return c


def new_app(**over):
    body = {"company": "Acme", "title": "Cloud Engineer", "appliedAt": "2026-11-01", "platform": "LinkedIn", "status": "applied"}
    body.update(over)
    return body
