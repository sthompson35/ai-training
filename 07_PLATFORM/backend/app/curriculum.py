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

router = APIRouter(prefix="/v1", tags=["curriculum"])


@router.get("/levels", response_model=list[schemas.LevelOut])
def list_levels(db: Session = Depends(get_db)):
    return db.execute(select(orm.Level).order_by(orm.Level.id)).scalars().all()


@router.get("/levels/export")
def export_levels(db: Session = Depends(get_db)):
    rows = db.execute(select(orm.Level).order_by(orm.Level.id)).scalars().all()
    return csv_response(
        [schemas.LevelOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.LevelOut.model_fields),
        filename="levels.csv",
    )


@router.get("/levels/{level_id}", response_model=schemas.LevelDetailOut)
def get_level(level_id: str, db: Session = Depends(get_db)):
    level = db.get(orm.Level, level_id)
    if level is None:
        raise HTTPException(status_code=404, detail="Level not found")
    return level


def _module_query(level_id: str | None):
    stmt = select(orm.Module).order_by(orm.Module.id)
    if level_id:
        stmt = stmt.where(orm.Module.level_id == level_id)
    return stmt


@router.get("/modules", response_model=list[schemas.ModuleOut])
def list_modules(level_id: str | None = None, db: Session = Depends(get_db)):
    return db.execute(_module_query(level_id)).scalars().all()


@router.get("/modules/export")
def export_modules(level_id: str | None = None, db: Session = Depends(get_db)):
    rows = db.execute(_module_query(level_id)).scalars().all()
    return csv_response(
        [schemas.ModuleOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.ModuleOut.model_fields),
        filename="modules.csv",
    )


@router.get("/modules/{module_id}", response_model=schemas.ModuleOut)
def get_module(module_id: str, db: Session = Depends(get_db)):
    module = db.get(orm.Module, module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@router.post("/modules", response_model=schemas.ModuleOut, status_code=201)
def create_module(
    payload: schemas.ModuleCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    if db.get(orm.Module, payload.id) is not None:
        raise HTTPException(status_code=409, detail="Module already exists")
    if db.get(orm.Level, payload.level_id) is None:
        raise HTTPException(status_code=422, detail="Unknown level_id")
    module = orm.Module(**payload.model_dump())
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


@router.post("/modules/import", response_model=schemas.ImportResult)
async def import_modules(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.ModuleCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        if db.get(orm.Module, payload.id) is not None:
            skipped.append({"row": i, "reason": f"Module {payload.id} already exists"})
            continue
        if db.get(orm.Level, payload.level_id) is None:
            skipped.append({"row": i, "reason": f"Unknown level_id {payload.level_id}"})
            continue
        db.add(orm.Module(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/modules/{module_id}", response_model=schemas.ModuleOut)
def update_module(
    module_id: str,
    payload: schemas.ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    module = db.get(orm.Module, module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    for field, value in payload.model_dump().items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)
    return module


@router.delete("/modules/{module_id}", status_code=204)
def delete_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    module = db.get(orm.Module, module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    db.delete(module)
    db.commit()


@router.post("/modules/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_modules(
    payload: schemas.BulkDeleteRequestStr,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for module_id in payload.ids:
        module = db.get(orm.Module, module_id)
        if module is None:
            skipped.append({"id": module_id, "reason": "Not found"})
            continue
        db.delete(module)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


def _lab_query(domain: str | None):
    stmt = select(orm.Lab).order_by(orm.Lab.id)
    if domain:
        stmt = stmt.where(orm.Lab.domain == domain)
    return stmt


@router.get("/labs", response_model=list[schemas.LabOut])
def list_labs(domain: str | None = None, db: Session = Depends(get_db)):
    return db.execute(_lab_query(domain)).scalars().all()


@router.get("/labs/export")
def export_labs(domain: str | None = None, db: Session = Depends(get_db)):
    rows = db.execute(_lab_query(domain)).scalars().all()
    return csv_response(
        [schemas.LabOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.LabOut.model_fields),
        filename="labs.csv",
    )


@router.get("/labs/{lab_id}", response_model=schemas.LabOut)
def get_lab(lab_id: str, db: Session = Depends(get_db)):
    lab = db.get(orm.Lab, lab_id)
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab not found")
    return lab


@router.post("/labs", response_model=schemas.LabOut, status_code=201)
def create_lab(
    payload: schemas.LabCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    if db.get(orm.Lab, payload.id) is not None:
        raise HTTPException(status_code=409, detail="Lab already exists")
    lab = orm.Lab(**payload.model_dump())
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return lab


@router.post("/labs/import", response_model=schemas.ImportResult)
async def import_labs(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.LabCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        if db.get(orm.Lab, payload.id) is not None:
            skipped.append({"row": i, "reason": f"Lab {payload.id} already exists"})
            continue
        db.add(orm.Lab(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/labs/{lab_id}", response_model=schemas.LabOut)
def update_lab(
    lab_id: str,
    payload: schemas.LabUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    lab = db.get(orm.Lab, lab_id)
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab not found")
    for field, value in payload.model_dump().items():
        setattr(lab, field, value)
    db.commit()
    db.refresh(lab)
    return lab


@router.delete("/labs/{lab_id}", status_code=204)
def delete_lab(
    lab_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    lab = db.get(orm.Lab, lab_id)
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab not found")
    db.delete(lab)
    db.commit()


@router.post("/labs/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_labs(
    payload: schemas.BulkDeleteRequestStr,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for lab_id in payload.ids:
        lab = db.get(orm.Lab, lab_id)
        if lab is None:
            skipped.append({"id": lab_id, "reason": "Not found"})
            continue
        db.delete(lab)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)
