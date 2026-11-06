from fastapi import FastAPI
from sqlalchemy import text

from .db import engine
from .routers import auth, core

app = FastAPI(title="Job Tracker API", version="1.0.0", docs_url="/docs", redoc_url=None)
app.include_router(auth.router)
app.include_router(core.router)


@app.get("/healthz", tags=["meta"])
def healthz():
    with engine.connect() as conn:
        conn.execute(text("select 1"))
    return {"ok": True}
