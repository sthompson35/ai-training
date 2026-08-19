from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .audit import log_audit_event
from .auth import get_current_user
from .csv_export import csv_response
from .csv_import import parse_csv_rows
from .db import get_db
from .pagination import paginate

router = APIRouter(prefix="/v1", tags=["certification"])


@router.get("/certifications", response_model=list[schemas.CertificationOut])
def list_certifications(db: Session = Depends(get_db)):
    return db.execute(select(orm.Certification).order_by(orm.Certification.code)).scalars().all()


@router.get("/certifications/export")
def export_certifications(db: Session = Depends(get_db)):
    rows = db.execute(select(orm.Certification).order_by(orm.Certification.code)).scalars().all()
    return csv_response(
        [schemas.CertificationOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.CertificationOut.model_fields),
        filename="certifications.csv",
    )


@router.get("/certifications/{code}", response_model=schemas.CertificationDetailOut)
def get_certification(code: str, db: Session = Depends(get_db)):
    certification = db.get(orm.Certification, code)
    if certification is None:
        raise HTTPException(status_code=404, detail="Certification not found")
    return certification


def _learner_query(q: str | None):
    stmt = select(orm.Learner).order_by(orm.Learner.id)
    if q:
        stmt = stmt.where(orm.Learner.name.ilike(f"%{q}%"))
    return stmt


@router.get("/learners", response_model=list[schemas.LearnerOut])
def list_learners(
    response: Response,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginate(db, _learner_query(q), response, limit, offset)


@router.get("/learners/export")
def export_learners(q: str | None = None, db: Session = Depends(get_db)):
    rows = db.execute(_learner_query(q)).scalars().all()
    return csv_response(
        [schemas.LearnerOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.LearnerOut.model_fields),
        filename="learners.csv",
    )


@router.post("/learners", response_model=schemas.LearnerOut, status_code=201)
def create_learner(
    payload: schemas.LearnerCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    existing = db.execute(select(orm.Learner).where(orm.Learner.email == payload.email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A learner with this email already exists")
    learner = orm.Learner(**payload.model_dump())
    db.add(learner)
    db.commit()
    db.refresh(learner)
    return learner


@router.post("/learners/import", response_model=schemas.ImportResult)
async def import_learners(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.LearnerCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        existing = db.execute(select(orm.Learner).where(orm.Learner.email == payload.email)).scalar_one_or_none()
        if existing is not None:
            skipped.append({"row": i, "reason": f"A learner with email {payload.email} already exists"})
            continue
        db.add(orm.Learner(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.get("/learners/{learner_id}", response_model=schemas.LearnerDetailOut)
def get_learner(learner_id: int, db: Session = Depends(get_db)):
    learner = db.get(orm.Learner, learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail="Learner not found")
    return learner


@router.delete("/learners/{learner_id}", status_code=204)
def delete_learner(
    learner_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    learner = db.get(orm.Learner, learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail="Learner not found")
    db.delete(learner)
    db.commit()


@router.post("/learners/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_learners(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for learner_id in payload.ids:
        learner = db.get(orm.Learner, learner_id)
        if learner is None:
            skipped.append({"id": str(learner_id), "reason": "Not found"})
            continue
        db.delete(learner)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


def _enrollment_query(certification_code: str | None, learner_id: int | None):
    stmt = select(orm.Enrollment).order_by(orm.Enrollment.id)
    if certification_code:
        stmt = stmt.where(orm.Enrollment.certification_code == certification_code)
    if learner_id:
        stmt = stmt.where(orm.Enrollment.learner_id == learner_id)
    return stmt


@router.get("/enrollments", response_model=list[schemas.EnrollmentOut])
def list_enrollments(
    certification_code: str | None = None,
    learner_id: int | None = None,
    db: Session = Depends(get_db),
):
    return db.execute(_enrollment_query(certification_code, learner_id)).scalars().all()


@router.get("/enrollments/export")
def export_enrollments(
    certification_code: str | None = None,
    learner_id: int | None = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(_enrollment_query(certification_code, learner_id)).scalars().all()
    return csv_response(
        [schemas.EnrollmentOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.EnrollmentOut.model_fields),
        filename="enrollments.csv",
    )


@router.post("/enrollments", response_model=schemas.EnrollmentOut, status_code=201)
def create_enrollment(
    payload: schemas.EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    if db.get(orm.Learner, payload.learner_id) is None:
        raise HTTPException(status_code=422, detail="Unknown learner_id")
    if db.get(orm.Certification, payload.certification_code) is None:
        raise HTTPException(status_code=422, detail="Unknown certification_code")
    enrollment = orm.Enrollment(**payload.model_dump())
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.post("/enrollments/import", response_model=schemas.ImportResult)
async def import_enrollments(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.EnrollmentCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        if db.get(orm.Learner, payload.learner_id) is None:
            skipped.append({"row": i, "reason": f"Unknown learner_id {payload.learner_id}"})
            continue
        if db.get(orm.Certification, payload.certification_code) is None:
            skipped.append({"row": i, "reason": f"Unknown certification_code {payload.certification_code}"})
            continue
        db.add(orm.Enrollment(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/enrollments/{enrollment_id}", response_model=schemas.EnrollmentOut)
def update_enrollment(
    enrollment_id: int,
    payload: schemas.EnrollmentUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    enrollment = db.get(orm.Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    for field, value in payload.model_dump().items():
        setattr(enrollment, field, value)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.delete("/enrollments/{enrollment_id}", status_code=204)
def delete_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    enrollment = db.get(orm.Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(enrollment)
    db.commit()


@router.post("/enrollments/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_enrollments(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for enrollment_id in payload.ids:
        enrollment = db.get(orm.Enrollment, enrollment_id)
        if enrollment is None:
            skipped.append({"id": str(enrollment_id), "reason": "Not found"})
            continue
        db.delete(enrollment)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.post("/enrollments/bulk-update-status", response_model=schemas.BulkUpdateResult)
def bulk_update_enrollment_status(
    payload: schemas.BulkUpdateEnrollmentStatusRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    updated = 0
    skipped: list[dict] = []
    for enrollment_id in payload.ids:
        enrollment = db.get(orm.Enrollment, enrollment_id)
        if enrollment is None:
            skipped.append({"id": str(enrollment_id), "reason": "Not found"})
            continue
        enrollment.status = payload.status.value
        updated += 1
    db.commit()
    return schemas.BulkUpdateResult(updated=updated, skipped=skipped)
