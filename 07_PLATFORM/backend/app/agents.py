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


def _resolve_agent_identity_fields(db, payload: schemas.AgentCardBase, current_agent_id: int | None = None) -> dict:
    """Resolves `owner` (required) and the optional AI-agent identity link.

    Returns the fields to merge into the ORM kwargs: `owner_service_member_id`
    (the resolved owner -- `owner` itself is a read-only derived property, no
    longer a settable column) and `service_member_id` (None if not linking
    this card to a registry identity). `current_agent_id` should be passed on
    update so an agent keeping its own existing link isn't rejected as a
    conflict with itself.
    """
    owner_member = resolve_identifier_or_422(db, payload.owner, "owner")
    fields = {"owner_service_member_id": owner_member.service_member_id}
    if payload.service_member_id:
        link_member = resolve_identifier_or_422(db, payload.service_member_id, "service_member_id")
        already_linked = db.execute(
            select(orm.AgentCard).where(orm.AgentCard.service_member_id == link_member.service_member_id)
        ).scalar_one_or_none()
        if already_linked is not None and already_linked.id != current_agent_id:
            raise HTTPException(
                status_code=409, detail="This identity is already linked to another agent card"
            )
        fields["service_member_id"] = link_member.service_member_id
    else:
        fields["service_member_id"] = None
    return fields


router = APIRouter(prefix="/v1", tags=["agents"])


def _agent_query(q: str | None):
    stmt = select(orm.AgentCard).options(joinedload(orm.AgentCard.owner_service_member)).order_by(orm.AgentCard.id)
    if q:
        stmt = stmt.where(orm.AgentCard.name.ilike(f"%{q}%"))
    return stmt


@router.get("/agents", response_model=list[schemas.AgentCardOut])
def list_agents(
    response: Response,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginate(db, _agent_query(q), response, limit, offset)


@router.get("/agents/export")
def export_agents(q: str | None = None, db: Session = Depends(get_db)):
    rows = db.execute(_agent_query(q)).scalars().all()
    return csv_response(
        [schemas.AgentCardOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.AgentCardOut.model_fields),
        filename="agents.csv",
    )


@router.get("/agents/{agent_id}", response_model=schemas.AgentCardOut)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = db.get(orm.AgentCard, agent_id, options=[joinedload(orm.AgentCard.owner_service_member)])
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("/agents", response_model=schemas.AgentCardOut, status_code=201)
def create_agent(
    payload: schemas.AgentCardCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    existing = db.execute(select(orm.AgentCard).where(orm.AgentCard.name == payload.name)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An agent with this name already exists")
    identity_fields = _resolve_agent_identity_fields(db, payload)
    data = payload.model_dump()
    data.pop("owner", None)  # read-only derived property, never a constructor kwarg
    data.update(identity_fields)
    agent = orm.AgentCard(**data)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/agents/import", response_model=schemas.ImportResult)
async def import_agents(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.AgentCardCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        existing = db.execute(select(orm.AgentCard).where(orm.AgentCard.name == payload.name)).scalar_one_or_none()
        if existing is not None:
            skipped.append({"row": i, "reason": f"An agent named {payload.name} already exists"})
            continue
        owner_member = resolve_identifier(db, payload.owner)
        if owner_member is None:
            skipped.append({"row": i, "reason": f"owner '{payload.owner}' does not resolve to a known canonical identity"})
            continue
        data = payload.model_dump()
        data.pop("owner", None)  # read-only derived property, never a constructor kwarg
        data["owner_service_member_id"] = owner_member.service_member_id
        link_member = None
        if payload.service_member_id:
            link_member = resolve_identifier(db, payload.service_member_id)
            if link_member is None:
                skipped.append(
                    {"row": i, "reason": f"service_member_id '{payload.service_member_id}' does not resolve to a known canonical identity"}
                )
                continue
            already_linked = db.execute(
                select(orm.AgentCard).where(orm.AgentCard.service_member_id == link_member.service_member_id)
            ).scalar_one_or_none()
            if already_linked is not None:
                skipped.append({"row": i, "reason": "This identity is already linked to another agent card"})
                continue
        data["service_member_id"] = link_member.service_member_id if link_member else None
        db.add(orm.AgentCard(**data))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/agents/{agent_id}", response_model=schemas.AgentCardOut)
def update_agent(
    agent_id: int,
    payload: schemas.AgentCardUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    agent = db.get(orm.AgentCard, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    identity_fields = _resolve_agent_identity_fields(db, payload, current_agent_id=agent_id)
    update_data = payload.model_dump()
    update_data.pop("owner", None)  # read-only derived property, never a settable attribute
    for field, value in update_data.items():
        setattr(agent, field, value)
    for field, value in identity_fields.items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/agents/{agent_id}", status_code=204)
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    agent = db.get(orm.AgentCard, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()


@router.post("/agents/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_agents(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for agent_id in payload.ids:
        agent = db.get(orm.AgentCard, agent_id)
        if agent is None:
            skipped.append({"id": str(agent_id), "reason": "Not found"})
            continue
        db.delete(agent)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)
