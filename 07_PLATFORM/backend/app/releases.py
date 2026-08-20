from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from . import orm, schemas
from .audit import log_audit_event
from .auth import get_current_user
from .csv_export import csv_response
from .csv_import import parse_csv_rows
from .db import get_db
from .identity_resolution import resolve_identifier, resolve_identifier_or_422
from .pagination import paginate

router = APIRouter(prefix="/v1", tags=["releases"])


def _release_query(status: str | None, q: str | None):
    stmt = select(orm.Release).options(joinedload(orm.Release.approver_service_member)).order_by(orm.Release.id)
    if status:
        stmt = stmt.where(orm.Release.status == status)
    if q:
        stmt = stmt.where(orm.Release.title.ilike(f"%{q}%"))
    return stmt


@router.get("/releases", response_model=list[schemas.ReleaseOut])
def list_releases(
    response: Response,
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginate(db, _release_query(status, q), response, limit, offset)


@router.get("/releases/export")
def export_releases(status: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    rows = db.execute(_release_query(status, q)).scalars().all()
    return csv_response(
        [schemas.ReleaseOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.ReleaseOut.model_fields),
        filename="releases.csv",
    )


@router.get("/releases/{release_id}", response_model=schemas.ReleaseOut)
def get_release(release_id: int, db: Session = Depends(get_db)):
    release = db.get(orm.Release, release_id, options=[joinedload(orm.Release.approver_service_member)])
    if release is None:
        raise HTTPException(status_code=404, detail="Release not found")
    return release


@router.post("/releases", response_model=schemas.ReleaseOut, status_code=201)
def create_release(
    payload: schemas.ReleaseCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    approver_member = resolve_identifier_or_422(db, payload.approver, "approver")
    data = payload.model_dump()
    data.pop("approver", None)  # read-only derived property, never a constructor kwarg
    release = orm.Release(**data, approver_service_member_id=approver_member.service_member_id)
    db.add(release)
    db.commit()
    db.refresh(release)
    return release


@router.post("/releases/import", response_model=schemas.ImportResult)
async def import_releases(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.ReleaseCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        approver_member = resolve_identifier(db, payload.approver)
        if approver_member is None:
            skipped.append({"row": i, "reason": f"approver '{payload.approver}' does not resolve to a known canonical identity"})
            continue
        data = payload.model_dump()
        data.pop("approver", None)  # read-only derived property, never a constructor kwarg
        db.add(orm.Release(**data, approver_service_member_id=approver_member.service_member_id))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/releases/{release_id}", response_model=schemas.ReleaseOut)
def update_release(
    release_id: int,
    payload: schemas.ReleaseUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    release = db.get(orm.Release, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Release not found")
    approver_member = resolve_identifier_or_422(db, payload.approver, "approver")
    update_data = payload.model_dump()
    update_data.pop("approver", None)  # read-only derived property, never a settable attribute
    for field, value in update_data.items():
        setattr(release, field, value)
    release.approver_service_member_id = approver_member.service_member_id
    db.commit()
    db.refresh(release)
    return release


@router.delete("/releases/{release_id}", status_code=204)
def delete_release(
    release_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    release = db.get(orm.Release, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Release not found")
    db.delete(release)
    db.commit()


@router.post("/releases/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_releases(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for release_id in payload.ids:
        release = db.get(orm.Release, release_id)
        if release is None:
            skipped.append({"id": str(release_id), "reason": "Not found"})
            continue
        db.delete(release)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.post("/releases/bulk-update-status", response_model=schemas.BulkUpdateResult)
def bulk_update_release_status(
    payload: schemas.BulkUpdateReleaseStatusRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    updated = 0
    skipped: list[dict] = []
    for release_id in payload.ids:
        release = db.get(orm.Release, release_id)
        if release is None:
            skipped.append({"id": str(release_id), "reason": "Not found"})
            continue
        release.status = payload.status.value
        updated += 1
    db.commit()
    return schemas.BulkUpdateResult(updated=updated, skipped=skipped)
