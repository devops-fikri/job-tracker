# Job Tracker

Self-hosted job application tracker. Phase 1: core app (web UI, API, database, follow-up rules, backups).

| Service | Purpose | Reachable at |
|---|---|---|
| `web` | Next.js UI; proxies `/api/*` to the API | `WEB_BIND:3000` (tailnet IP in `.env`) |
| `api` | FastAPI; runs DB migrations on start | `127.0.0.1:8000` (docs at `/docs`) |
| `db` | Postgres 17 (volume `jobtracker_pgdata`) | internal only |
| `redis` | Celery broker | internal only |
| `worker`, `beat` | Daily rules at 08:00 MYT: follow-up reminders, auto-ghosting | — |
| `backup` | `pg_dump` nightly at 03:00 MYT into `./backups`, newest 14 kept | — |

## First start

Needs Docker with the Compose plugin. All config and secrets live in `.env`, which is git-ignored: never commit it.

```sh
git clone https://github.com/devops-fikri/job-tracker.git && cd job-tracker
cp .env.example .env && chmod 600 .env
# edit .env: set a strong POSTGRES_PASSWORD (e.g. `openssl rand -hex 24`) and WEB_BIND (your Tailscale IP, or 127.0.0.1)
sudo docker compose up -d --build
sudo docker compose exec api python -m app.cli create-user you@example.com   # prompts for a password (12+ chars)
# optional, fictional sample data with dates shifted to today:
sudo docker compose exec api python -m app.cli seed-demo
```

## Everyday commands

```sh
sudo docker compose ps                        # status / health
sudo docker compose logs -f api worker        # logs
sudo docker compose up -d --build             # deploy after code changes
sudo docker compose exec api python -m app.cli run-rules          # run follow-up rules now
sudo docker compose exec api python -m app.cli set-password you@example.com
sudo docker compose exec backup /bin/sh /backup.sh now            # take a backup now
```

## Restore a backup

```sh
sudo docker compose stop api worker beat web
sudo docker compose exec -T db pg_restore -U jobtracker -d jobtracker --clean --if-exists < backups/jobtracker-YYYYMMDD-HHMM.dump
sudo docker compose start api worker beat web
```

Uploaded résumés live in `./data/uploads` (not inside the database dump). Back that folder up too.

## Rules (change via env vars on `api`/`worker`)

| Rule | Default |
|---|---|
| Follow-up after applying with no response (`FOLLOWUP_AFTER_APPLIED_DAYS`) | 7 days |
| Follow-up after no activity (`FOLLOWUP_NO_RESPONSE_DAYS`) | 14 days |
| Follow-up after a completed interview (`FOLLOWUP_AFTER_INTERVIEW_DAYS`) | 7 days |
| Mark as ghosted (`GHOSTED_AFTER_DAYS`) | 30 days without activity |

Moving an application to a closed status marks its pending automatic follow-ups as not required.

## Tests

```sh
cd api && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/pytest -q
cd web && npm run lint && npx tsc --noEmit && npm run build
```

API tests run against SQLite and apply the real Alembic migration.

## Docs

- [Git & GitHub guide](docs/git-guide.md)

## Notes

- Binding `web` to the Tailscale IP needs `tailscaled` up before Docker starts the container at boot.
  If the UI is missing after a reboot, run `sudo docker compose up -d web`. Switching to Tailscale Serve removes this.
- `COOKIE_SECURE=true` once the UI is served over HTTPS.
