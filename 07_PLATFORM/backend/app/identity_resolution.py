from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm

RESOLUTION_TIERS = "service_member_id, callsign_id, callsign, legacy_alias"


def resolve_identifier(db: Session, identifier: str) -> orm.ServiceMember | None:
    """Canonical resolution: service_member_id -> callsign_id -> callsign -> legacy_alias.

    Every tier is an exact-equality lookup. The only normalization performed is
    prepending "@" to the callsign tier if the caller omitted it — fuzzy/partial/
    case-insensitive matching is deliberately never used (R2: "Fuzzy identity
    matching is prohibited for controlled execution").
    """
    identifier = identifier.strip()
    if not identifier:
        return None

    member = db.execute(
        select(orm.ServiceMember).where(orm.ServiceMember.service_member_id == identifier)
    ).scalar_one_or_none()
    if member is not None:
        return member

    member = db.execute(
        select(orm.ServiceMember).where(orm.ServiceMember.callsign_id == identifier)
    ).scalar_one_or_none()
    if member is not None:
        return member

    callsign = identifier if identifier.startswith("@") else f"@{identifier}"
    member = db.execute(select(orm.ServiceMember).where(orm.ServiceMember.callsign == callsign)).scalar_one_or_none()
    if member is not None:
        return member

    return db.execute(
        select(orm.ServiceMember).where(orm.ServiceMember.legacy_alias == identifier)
    ).scalar_one_or_none()


def resolve_identifier_or_422(db: Session, identifier: str, field_name: str) -> orm.ServiceMember:
    member = resolve_identifier(db, identifier)
    if member is None:
        raise HTTPException(
            status_code=422,
            detail=(
                f"{field_name}: '{identifier}' does not resolve to a known canonical identity "
                f"(checked {RESOLUTION_TIERS} — exact match only)"
            ),
        )
    return member


def apply_role_change(
    db: Session,
    service_member: orm.ServiceMember,
    new_role: str,
    new_command_layer: str,
    changed_by_id: str | None,
    reason: str | None,
) -> orm.RoleAssignmentHistory:
    """The only code path allowed to change current_role/role_version/command_layer.

    Increments role_version and appends a new role_assignment_history row in the
    same transaction — the identity row itself and every prior history row are
    left untouched, which is what guarantees a role change never creates a
    second identity.
    """
    service_member.current_role = new_role
    service_member.command_layer = new_command_layer
    service_member.role_version += 1

    history_row = orm.RoleAssignmentHistory(
        service_member_id=service_member.service_member_id,
        role_version=service_member.role_version,
        role=new_role,
        command_layer=new_command_layer,
        readiness_state=service_member.readiness_state,
        changed_by=changed_by_id,
        change_reason=reason,
    )
    db.add(history_row)
    db.commit()
    db.refresh(service_member)
    db.refresh(history_row)
    return history_row


def resolve_verifier_or_error(db: Session, username: str) -> orm.ServiceMember:
    """The verifier is never a free-text/caller-supplied field — it is always
    derived from the authenticated admin's own linked identity, so a
    separation-of-duties check actually means something (an arbitrary typed
    name could otherwise claim to be anyone)."""
    user = db.execute(select(orm.User).where(orm.User.username == username)).scalar_one_or_none()
    if user is None or user.service_member_id is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Your account must be linked to a canonical identity "
                "(PUT /v1/users/{id}/identity) before you can record an independent verification."
            ),
        )
    verifier = db.get(orm.ServiceMember, user.service_member_id)
    if verifier is None:
        raise HTTPException(status_code=422, detail="Your linked identity no longer exists in the registry.")
    return verifier


def apply_verification(
    db: Session,
    service_member: orm.ServiceMember,
    verifier: orm.ServiceMember,
    evidence_reference: str,
    verification_method: str,
    outcome: str,
    notes: str | None,
) -> orm.IdentityVerification:
    """The only code path allowed to move production_verification_state to
    "verified" or "revoked" — the generic PUT /v1/service-members/{id}
    update does not accept this field at all. Every transition is backed by
    an evidence reference, a named verifier, a method, and a timestamp, and
    is subject to separation of duties: an identity cannot verify itself,
    and the identity that onboarded a record cannot also verify it.
    """
    if verifier.service_member_id == service_member.service_member_id:
        raise HTTPException(status_code=409, detail="Separation of duties: an identity cannot verify itself")
    if (
        service_member.created_by_service_member_id is not None
        and verifier.service_member_id == service_member.created_by_service_member_id
    ):
        raise HTTPException(
            status_code=409,
            detail="Separation of duties: the identity that onboarded this record cannot also verify it",
        )

    record = orm.IdentityVerification(
        service_member_id=service_member.service_member_id,
        evidence_reference=evidence_reference,
        verification_method=verification_method,
        outcome=outcome,
        verifier_service_member_id=verifier.service_member_id,
        notes=notes,
    )
    db.add(record)

    # "rejected" leaves production_verification_state untouched — a rejected
    # attempt is recorded history, not a state change. "verified"/"revoked"
    # are the only outcomes that move the label, and only from here.
    if outcome in ("verified", "revoked"):
        service_member.production_verification_state = outcome

    db.commit()
    db.refresh(record)
    return record
