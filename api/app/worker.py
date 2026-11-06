from celery import Celery
from celery.schedules import crontab

from . import services
from .config import get_settings
from .db import SessionLocal

s = get_settings()
celery = Celery("jobtracker", broker=s.redis_url, backend=s.redis_url)
celery.conf.update(
    timezone=s.timezone,
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=86400,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "daily-rules": {"task": "jobtracker.daily_rules", "schedule": crontab(hour=8, minute=0)},
    },
)


@celery.task(name="jobtracker.daily_rules")
def daily_rules() -> dict[str, int]:
    with SessionLocal() as db:
        return services.run_daily_rules(db)
