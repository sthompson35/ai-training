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

router = APIRouter(prefix="/v1", tags=["incidents"])


def _incident_query(
    status: str | None, severity: str | None, agent_id: int | None, release_id: int | None, q: str | None
):
    stmt = select(orm.Incident).options(joinedload(orm.Incident.owner_service_member)).order_by(orm.Incident.id)
    if status:
        stmt = stmt.where(orm.Incident.status == status)
    if severity:
        stmt = stmt.where(orm.Incident.severity == severity)
    if agent_id:
        stmt = stmt.where(orm.Incident.agent_id == agent_id)
    if release_id:
        stmt = stmt.where(orm.Incident.release_id == release_id)
    if q:
        stmt = stmt.where(orm.Incident.title.ilike(f"%{q}%"))
    return stmt


@router.get("/incidents", response_model=list[schemas.IncidentOut])
def list_incidents(
    response: Response,
    status: str | None = None,
    severity: str | None = None,
    agent_id: int | None = None,
    release_id: int | None = None,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginate(db, _incident_query(status, severity, agent_id, release_id, q), response, limit, offset)


@router.get("/incidents/export")
def export_incidents(
    status: str | None = None,
    severity: str | None = None,
    agent_id: int | None = None,
    release_id: int | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(_incident_query(status, severity, agent_id, release_id, q)).scalars().all()
    return csv_response(
        [schemas.IncidentOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.IncidentOut.model_fields),
        filename="incidents.csv",
    )


@router.get("/incidents/{incident_id}", response_model=schemas.IncidentOut)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(orm.Incident, incident_id, options=[joinedload(orm.Incident.owner_service_member)])
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("/incidents", response_model=schemas.IncidentOut, status_code=201)
def create_incident(
    payload: schemas.IncidentCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    if payload.agent_id is not None and db.get(orm.AgentCard, payload.agent_id) is None:
        raise HTTPException(status_code=422, detail="Unknown agent_id")
    if payload.release_id is not None and db.get(orm.Release, payload.release_id) is None:
        raise HTTPException(status_code=422, detail="Unknown release_id")
    owner_member = resolve_identifier_or_422(db, payload.owner, "owner")
    data = payload.model_dump()
    data.pop("owner", None)  # read-only derived property, never a constructor kwarg
    incident = orm.Incident(**data, owner_service_member_id=owner_member.service_member_id)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post("/incidents/import", response_model=schemas.ImportResult)
async def import_incidents(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.IncidentCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        if payload.agent_id is not None and db.get(orm.AgentCard, payload.agent_id) is None:
            skipped.append({"row": i, "reason": f"Unknown agent_id {payload.agent_id}"})
            continue
        if payload.release_id is not None and db.get(orm.Release, payload.release_id) is None:
            skipped.append({"row": i, "reason": f"Unknown release_id {payload.release_id}"})
            continue
        owner_member = resolve_identifier(db, payload.owner)
        if owner_member is None:
            skipped.append({"row": i, "reason": f"owner '{payload.owner}' does not resolve to a known canonical identity"})
            continue
        data = payload.model_dump()
        data.pop("owner", None)  # read-only derived property, never a constructor kwarg
        db.add(orm.Incident(**data, owner_service_member_id=owner_member.service_member_id))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/incidents/{incident_id}", response_model=schemas.IncidentOut)
def update_incident(
    incident_id: int,
    payload: schemas.IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    incident = db.get(orm.Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if payload.agent_id is not None and db.get(orm.AgentCard, payload.agent_id) is None:
        raise HTTPException(status_code=422, detail="Unknown agent_id")
    if payload.release_id is not None and db.get(orm.Release, payload.release_id) is None:
        raise HTTPException(status_code=422, detail="Unknown release_id")
    owner_member = resolve_identifier_or_422(db, payload.owner, "owner")
    update_data = payload.model_dump()
    update_data.pop("owner", None)  # read-only derived property, never a settable attribute
    for field, value in update_data.items():
        setattr(incident, field, value)
    incident.owner_service_member_id = owner_member.service_member_id
    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/incidents/{incident_id}", status_code=204)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    incident = db.get(orm.Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()


@router.post("/incidents/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_incidents(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for incident_id in payload.ids:
        incident = db.get(orm.Incident, incident_id)
        if incident is None:
            skipped.append({"id": str(incident_id), "reason": "Not found"})
            continue
        db.delete(incident)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.post("/incidents/bulk-update-status", response_model=schemas.BulkUpdateResult)
def bulk_update_incident_status(
    payload: schemas.BulkUpdateIncidentStatusRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    updated = 0
    skipped: list[dict] = []
    for incident_id in payload.ids:
        incident = db.get(orm.Incident, incident_id)
        if incident is None:
            skipped.append({"id": str(incident_id), "reason": "Not found"})
            continue
        incident.status = payload.status.value
        updated += 1
    db.commit()
    return schemas.BulkUpdateResult(updated=updated, skipped=skipped)


@router.post("/incidents/bulk-update-capa-status", response_model=schemas.BulkUpdateResult)
def bulk_update_incident_capa_status(
    payload: schemas.BulkUpdateIncidentCapaStatusRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    updated = 0
    skipped: list[dict] = []
    for incident_id in payload.ids:
        incident = db.get(orm.Incident, incident_id)
        if incident is None:
            skipped.append({"id": str(incident_id), "reason": "Not found"})
            continue
        incident.capa_status = payload.capa_status.value
        updated += 1
    db.commit()
    return schemas.BulkUpdateResult(updated=updated, skipped=skipped)
