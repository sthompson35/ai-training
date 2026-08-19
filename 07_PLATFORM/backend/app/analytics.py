import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import orm, schemas
from .db import get_db

router = APIRouter(prefix="/v1", tags=["analytics"])


def _count_by(db: Session, column) -> list[schemas.CountByLabel]:
    rows = db.execute(select(column, func.count()).group_by(column).order_by(column)).all()
    return [schemas.CountByLabel(label=str(label), count=count) for label, count in rows]


def _cost_last_7_days(db: Session) -> list[schemas.CostByDay]:
    # Bucketed in Python, not SQL: a GROUP BY date_trunc(...) would need
    # dialect-specific functions (Postgres vs this app's SQLite test/CI
    # fallback), which this app avoids everywhere else too.
    since = datetime.now(timezone.utc) - timedelta(days=6)
    rows = db.execute(
        select(orm.RouteCostLog.timestamp, orm.RouteCostLog.estimated_cost_usd).where(
            orm.RouteCostLog.timestamp >= since
        )
    ).all()

    totals: dict[str, float] = {}
    for ts, cost in rows:
        day = ts.date().isoformat()
        totals[day] = totals.get(day, 0.0) + cost

    days = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        days.append(schemas.CostByDay(date=day, cost_usd=round(totals.get(day, 0.0), 4)))
    return days


@router.get("/analytics", response_model=schemas.AnalyticsOut)
def get_analytics(db: Session = Depends(get_db)):
    cost_last_7_days = _cost_last_7_days(db)
    cost_today = cost_last_7_days[-1].cost_usd
    cost_limit = float(os.getenv("AI_DAILY_COST_LIMIT_USD", "25.00"))

    return schemas.AnalyticsOut(
        modules_by_level=_count_by(db, orm.Module.level_id),
        raci_by_responsibility=_count_by(db, orm.RaciEntry.responsibility),
        incidents_by_severity=_count_by(db, orm.Incident.severity),
        incidents_by_status=_count_by(db, orm.Incident.status),
        releases_by_status=_count_by(db, orm.Release.status),
        enrollments_by_status=_count_by(db, orm.Enrollment.status),
        cost_today_usd=cost_today,
        cost_daily_limit_usd=cost_limit,
        cost_remaining_usd=max(0.0, round(cost_limit - cost_today, 4)),
        cost_last_7_days=cost_last_7_days,
    )
