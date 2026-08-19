import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .auth import get_current_user
from .csv_export import csv_response
from .db import get_db
from .pagination import paginate

router = APIRouter(prefix="/v1", tags=["audit-log"])

_SUCCESS_STATUS_BY_METHOD = {"POST": 201, "PUT": 200, "DELETE": 204}
AUDIT_LOG_ENABLED = os.getenv("AUDIT_LOG_ENABLED", "true").lower() == "true"


def log_audit_event(
    request: Request,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Records one audit_log row for the wrapped endpoint after it runs.

    A dependency rather than middleware so `db`/`current_user` resolve through
    FastAPI's per-request dependency cache — the same instances the endpoint
    itself uses, meaning `app.dependency_overrides` (as used in tests) is
    honored automatically with no risk of writing through a different engine.
    """
    status_code = _SUCCESS_STATUS_BY_METHOD.get(request.method, 200)
    try:
        yield
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    except Exception:
        status_code = 500
        raise
    finally:
        if AUDIT_LOG_ENABLED:
            actor_service_member_id = db.execute(
                select(orm.User.service_member_id).where(orm.User.username == current_user)
            ).scalar_one_or_none()
            db.add(
                orm.AuditLogEntry(
                    username=current_user,
                    service_member_id=actor_service_member_id,
                    method=request.method,
                    path=request.url.path,
                    status_code=status_code,
                )
            )
            db.commit()


def _audit_log_query(q: str | None, username: str | None, service_member_id: str | None):
    stmt = select(orm.AuditLogEntry).order_by(orm.AuditLogEntry.id.desc())
    if q:
        stmt = stmt.where(orm.AuditLogEntry.path.ilike(f"%{q}%"))
    if username:
        stmt = stmt.where(orm.AuditLogEntry.username == username)
    if service_member_id:
        stmt = stmt.where(orm.AuditLogEntry.service_member_id == service_member_id)
    return stmt


@router.get("/audit-log", response_model=list[schemas.AuditLogEntryOut])
def list_audit_log(
    response: Response,
    q: str | None = None,
    username: str | None = None,
    service_member_id: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    return paginate(db, _audit_log_query(q, username, service_member_id), response, limit, offset)


@router.get("/audit-log/export")
def export_audit_log(
    q: str | None = None,
    username: str | None = None,
    service_member_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    rows = db.execute(_audit_log_query(q, username, service_member_id)).scalars().all()
    return csv_response(
        [schemas.AuditLogEntryOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.AuditLogEntryOut.model_fields),
        filename="audit_log.csv",
    )
