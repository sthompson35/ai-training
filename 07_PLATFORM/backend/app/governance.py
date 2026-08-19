from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .audit import log_audit_event
from .auth import get_current_user
from .csv_export import csv_response
from .csv_import import parse_csv_rows
from .db import get_db

router = APIRouter(prefix="/v1/governance", tags=["governance"])


def _raci_query(activity: str | None):
    stmt = select(orm.RaciEntry).order_by(orm.RaciEntry.id)
    if activity:
        stmt = stmt.where(orm.RaciEntry.activity == activity)
    return stmt


@router.get("/raci", response_model=list[schemas.RaciEntryOut])
def list_raci_entries(activity: str | None = None, db: Session = Depends(get_db)):
    return db.execute(_raci_query(activity)).scalars().all()


@router.get("/raci/export")
def export_raci_entries(activity: str | None = None, db: Session = Depends(get_db)):
    rows = db.execute(_raci_query(activity)).scalars().all()
    return csv_response(
        [schemas.RaciEntryOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.RaciEntryOut.model_fields),
        filename="governance_raci.csv",
    )


@router.post("/raci", response_model=schemas.RaciEntryOut, status_code=201)
def create_raci_entry(
    payload: schemas.RaciEntryCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    entry = orm.RaciEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/raci/import", response_model=schemas.ImportResult)
async def import_raci_entries(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.RaciEntryCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        db.add(orm.RaciEntry(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/raci/{entry_id}", response_model=schemas.RaciEntryOut)
def update_raci_entry(
    entry_id: int,
    payload: schemas.RaciEntryUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    entry = db.get(orm.RaciEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="RACI entry not found")
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/raci/{entry_id}", status_code=204)
def delete_raci_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    entry = db.get(orm.RaciEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="RACI entry not found")
    db.delete(entry)
    db.commit()


@router.post("/raci/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_raci_entries(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for entry_id in payload.ids:
        entry = db.get(orm.RaciEntry, entry_id)
        if entry is None:
            skipped.append({"id": str(entry_id), "reason": "Not found"})
            continue
        db.delete(entry)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)
