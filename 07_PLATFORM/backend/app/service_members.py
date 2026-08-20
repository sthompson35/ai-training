from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .audit import log_audit_event
from .auth import require_admin
from .csv_export import csv_response
from .csv_import import parse_csv_rows
from .db import get_db
from .identity_resolution import (
    apply_lifecycle_transition,
    apply_role_change,
    apply_verification,
    resolve_identifier,
    resolve_verifier_or_error,
)
from .pagination import paginate

router = APIRouter(prefix="/v1/service-members", tags=["service-members"])


def _list_query(q: str | None, member_class: str | None, lifecycle_state: str | None):
    stmt = select(orm.ServiceMember).order_by(orm.ServiceMember.service_member_id)
    if q:
        stmt = stmt.where(
            orm.ServiceMember.callsign.ilike(f"%{q}%") | orm.ServiceMember.display_name.ilike(f"%{q}%")
        )
    if member_class:
        stmt = stmt.where(orm.ServiceMember.member_class == member_class)
    if lifecycle_state:
        stmt = stmt.where(orm.ServiceMember.lifecycle_state == lifecycle_state)
    return stmt


@router.get("", response_model=list[schemas.ServiceMemberOut])
def list_service_members(
    response: Response,
    q: str | None = None,
    member_class: str | None = None,
    lifecycle_state: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginate(db, _list_query(q, member_class, lifecycle_state), response, limit, offset)


@router.get("/export")
def export_service_members(
    q: str | None = None,
    member_class: str | None = None,
    lifecycle_state: str | None = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(_list_query(q, member_class, lifecycle_state)).scalars().all()
    return csv_response(
        [schemas.ServiceMemberOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.ServiceMemberOut.model_fields),
        filename="service_members.csv",
    )


@router.get("/resolve", response_model=schemas.ServiceMemberOut)
def resolve_service_member(identifier: str, db: Session = Depends(get_db)):
    """The canonical 4-tier lookup, exposed read-only for pickers and verification.

    Exact match only at every tier — a near-miss identifier (e.g. a typo'd
    callsign) returns 404 rather than the nearest match.
    """
    member = resolve_identifier(db, identifier)
    if member is None:
        raise HTTPException(status_code=404, detail="No canonical identity resolves to this identifier")
    return member


@router.get("/{service_member_id}", response_model=schemas.ServiceMemberOut)
def get_service_member(service_member_id: str, db: Session = Depends(get_db)):
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")
    return member


@router.get("/{service_member_id}/role-history", response_model=list[schemas.RoleAssignmentHistoryOut])
def get_role_history(service_member_id: str, db: Session = Depends(get_db)):
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")
    return (
        db.execute(
            select(orm.RoleAssignmentHistory)
            .where(orm.RoleAssignmentHistory.service_member_id == service_member_id)
            .order_by(orm.RoleAssignmentHistory.role_version)
        )
        .scalars()
        .all()
    )


def _check_uniqueness(db: Session, payload: schemas.ServiceMemberCreate) -> None:
    conflict_filters = [
        orm.ServiceMember.service_member_id == payload.service_member_id,
        orm.ServiceMember.callsign_id == payload.callsign_id,
        orm.ServiceMember.callsign == payload.callsign,
    ]
    if payload.legacy_alias:
        conflict_filters.append(orm.ServiceMember.legacy_alias == payload.legacy_alias)
    for condition in conflict_filters:
        if db.execute(select(orm.ServiceMember).where(condition)).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail="A service member with this service_member_id, callsign_id, callsign, or legacy_alias already exists",
            )


@router.post("", response_model=schemas.ServiceMemberOut, status_code=201)
def create_service_member(
    payload: schemas.ServiceMemberCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    _check_uniqueness(db, payload)
    creator = db.execute(select(orm.User.service_member_id).where(orm.User.username == current_user)).scalar_one_or_none()
    member = orm.ServiceMember(**payload.model_dump(), created_by_service_member_id=creator)
    db.add(member)
    db.flush()
    db.add(
        orm.RoleAssignmentHistory(
            service_member_id=member.service_member_id,
            role_version=member.role_version,
            role=member.current_role,
            command_layer=member.command_layer,
            readiness_state=member.readiness_state,
            change_reason="Initial identity creation",
        )
    )
    db.commit()
    db.refresh(member)
    return member


@router.post("/import", response_model=schemas.ImportResult)
async def import_service_members(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    creator = db.execute(select(orm.User.service_member_id).where(orm.User.username == current_user)).scalar_one_or_none()
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.ServiceMemberCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        existing = db.execute(
            select(orm.ServiceMember).where(
                (orm.ServiceMember.service_member_id == payload.service_member_id)
                | (orm.ServiceMember.callsign_id == payload.callsign_id)
                | (orm.ServiceMember.callsign == payload.callsign)
            )
        ).scalar_one_or_none()
        if existing is not None:
            skipped.append({"row": i, "reason": "A service member with this identity already exists"})
            continue
        member = orm.ServiceMember(**payload.model_dump(), created_by_service_member_id=creator)
        db.add(member)
        db.flush()
        db.add(
            orm.RoleAssignmentHistory(
                service_member_id=member.service_member_id,
                role_version=member.role_version,
                role=member.current_role,
                command_layer=member.command_layer,
                readiness_state=member.readiness_state,
                change_reason="Imported identity",
            )
        )
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/{service_member_id}", response_model=schemas.ServiceMemberOut)
def update_service_member(
    service_member_id: str,
    payload: schemas.ServiceMemberUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    """Updates only display_name/readiness_state/legacy_alias.

    Identity fields (service_member_id, callsign_id, callsign), role fields
    (current_role, role_version, command_layer), lifecycle_state, and
    production_verification_state are not part of this schema and can never
    be changed here — identity is immutable, role changes only happen
    through POST /{id}/role-change, lifecycle transitions only through
    POST /{id}/deactivate|reactivate|discharge (reason required, recorded
    history), and verification state only through POST /{id}/verify
    (evidence + verifier + method + separation-of-duties) — none of these
    are bare label flips.
    """
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")
    for field, value in payload.model_dump().items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


@router.post("/{service_member_id}/role-change", response_model=schemas.RoleAssignmentHistoryOut)
def change_role(
    service_member_id: str,
    payload: schemas.RoleChangeRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")

    actor = db.execute(select(orm.User.service_member_id).where(orm.User.username == current_user)).scalar_one_or_none()
    return apply_role_change(
        db,
        member,
        new_role=payload.new_role,
        new_command_layer=payload.new_command_layer.value,
        changed_by_id=actor,
        reason=payload.reason,
    )


@router.post("/{service_member_id}/verify", response_model=schemas.IdentityVerificationOut)
def verify_identity(
    service_member_id: str,
    payload: schemas.IdentityVerificationRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    """The only way to move production_verification_state to verified/revoked.

    Requires an evidence reference, a verification method, and an outcome.
    The verifier is derived from the caller's own linked identity (never a
    free-text field) so the separation-of-duties checks in apply_verification
    — an identity cannot verify itself, and whoever onboarded a record cannot
    also verify it — actually mean something.
    """
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")

    verifier = resolve_verifier_or_error(db, current_user)
    return apply_verification(
        db,
        member,
        verifier,
        evidence_reference=payload.evidence_reference,
        verification_method=payload.verification_method,
        outcome=payload.outcome.value,
        notes=payload.notes,
    )


@router.get("/{service_member_id}/verifications", response_model=list[schemas.IdentityVerificationOut])
def get_verifications(service_member_id: str, db: Session = Depends(get_db)):
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")
    return (
        db.execute(
            select(orm.IdentityVerification)
            .where(orm.IdentityVerification.service_member_id == service_member_id)
            .order_by(orm.IdentityVerification.verified_at)
        )
        .scalars()
        .all()
    )


def _transition_lifecycle(
    service_member_id: str,
    to_state: str,
    payload: schemas.LifecycleTransitionRequest,
    db: Session,
    current_user: str,
) -> orm.LifecycleTransitionHistory:
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")
    actor = db.execute(select(orm.User.service_member_id).where(orm.User.username == current_user)).scalar_one_or_none()
    return apply_lifecycle_transition(db, member, to_state, changed_by_id=actor, reason=payload.reason)


@router.post("/{service_member_id}/deactivate", response_model=schemas.LifecycleTransitionHistoryOut)
def deactivate_service_member(
    service_member_id: str,
    payload: schemas.LifecycleTransitionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    """Stand down an active identity to inactive. Reversible via /reactivate."""
    return _transition_lifecycle(service_member_id, "inactive", payload, db, current_user)


@router.post("/{service_member_id}/reactivate", response_model=schemas.LifecycleTransitionHistoryOut)
def reactivate_service_member(
    service_member_id: str,
    payload: schemas.LifecycleTransitionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    """Bring an inactive identity back to active. Not valid from discharged."""
    return _transition_lifecycle(service_member_id, "active", payload, db, current_user)


@router.post("/{service_member_id}/discharge", response_model=schemas.LifecycleTransitionHistoryOut)
def discharge_service_member(
    service_member_id: str,
    payload: schemas.LifecycleTransitionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    """Terminal transition to discharged. This registry's substitute for
    deletion: the identity and its full history remain, permanently marked
    as no longer active, rather than removed."""
    return _transition_lifecycle(service_member_id, "discharged", payload, db, current_user)


@router.get("/{service_member_id}/lifecycle-history", response_model=list[schemas.LifecycleTransitionHistoryOut])
def get_lifecycle_history(service_member_id: str, db: Session = Depends(get_db)):
    member = db.get(orm.ServiceMember, service_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Service member not found")
    return (
        db.execute(
            select(orm.LifecycleTransitionHistory)
            .where(orm.LifecycleTransitionHistory.service_member_id == service_member_id)
            .order_by(orm.LifecycleTransitionHistory.effective_at)
        )
        .scalars()
        .all()
    )
