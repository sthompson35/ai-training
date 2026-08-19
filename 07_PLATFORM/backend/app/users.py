from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import orm, schemas
from .audit import log_audit_event
from .auth import get_current_user, hash_password, require_admin, verify_password
from .csv_export import csv_response
from .csv_import import parse_csv_rows
from .db import get_db
from .identity_resolution import resolve_identifier, resolve_identifier_or_422

router = APIRouter(prefix="/v1/users", tags=["users"])


def _check_identity_not_linked(db: Session, service_member_id: str, current_user_id: int | None = None) -> None:
    already_linked = db.execute(
        select(orm.User).where(orm.User.service_member_id == service_member_id)
    ).scalar_one_or_none()
    if already_linked is not None and already_linked.id != current_user_id:
        raise HTTPException(status_code=409, detail="This identity is already linked to another account")


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), current_user: str = Depends(require_admin)):
    return db.execute(select(orm.User).order_by(orm.User.id)).scalars().all()


@router.get("/export")
def export_users(db: Session = Depends(get_db), current_user: str = Depends(require_admin)):
    rows = db.execute(select(orm.User).order_by(orm.User.id)).scalars().all()
    return csv_response(
        [schemas.UserOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.UserOut.model_fields),
        filename="users.csv",
    )


@router.post("", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    existing = db.execute(select(orm.User).where(orm.User.username == payload.username)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A user with this username already exists")
    service_member_id = None
    if payload.identifier:
        member = resolve_identifier_or_422(db, payload.identifier, "identifier")
        _check_identity_not_linked(db, member.service_member_id)
        service_member_id = member.service_member_id
    user = orm.User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
        service_member_id=service_member_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/import", response_model=schemas.ImportResult)
async def import_users(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.UserCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        existing = db.execute(select(orm.User).where(orm.User.username == payload.username)).scalar_one_or_none()
        if existing is not None:
            skipped.append({"row": i, "reason": f"A user with username {payload.username} already exists"})
            continue
        service_member_id = None
        if payload.identifier:
            member = resolve_identifier(db, payload.identifier)
            if member is None:
                skipped.append(
                    {"row": i, "reason": f"identifier '{payload.identifier}' does not resolve to a known canonical identity"}
                )
                continue
            already_linked = db.execute(
                select(orm.User).where(orm.User.service_member_id == member.service_member_id)
            ).scalar_one_or_none()
            if already_linked is not None:
                skipped.append({"row": i, "reason": "This identity is already linked to another account"})
                continue
            service_member_id = member.service_member_id
        db.add(
            orm.User(
                username=payload.username,
                password_hash=hash_password(payload.password),
                role=payload.role.value,
                service_member_id=service_member_id,
            )
        )
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/me/password", status_code=204)
def change_my_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    user = db.execute(select(orm.User).where(orm.User.username == current_user)).scalar_one()
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.commit()


@router.put("/{user_id}/password", status_code=204)
def reset_user_password(
    user_id: int,
    payload: schemas.PasswordReset,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    user = db.get(orm.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user_role(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    user = db.get(orm.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role.value
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/identity", response_model=schemas.UserOut)
def link_user_identity(
    user_id: int,
    payload: schemas.UserIdentityLink,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    user = db.get(orm.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    member = resolve_identifier_or_422(db, payload.identifier, "identifier")
    _check_identity_not_linked(db, member.service_member_id, current_user_id=user_id)
    user.service_member_id = member.service_member_id
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    user = db.get(orm.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        admin_count = db.execute(
            select(func.count()).select_from(orm.User).where(orm.User.role == "admin")
        ).scalar_one()
        if admin_count <= 1:
            raise HTTPException(status_code=409, detail="Cannot delete the last remaining admin")
    db.delete(user)
    db.commit()


@router.post("/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_users(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    # Tracked as a local counter, not re-queried per iteration: this app's
    # sessions all use autoflush=False (see db.py), so a SELECT COUNT(*)
    # here wouldn't see db.delete() calls from earlier in this same loop
    # until commit — it would silently undercount already-processed
    # deletions and let a batch delete every admin in one request.
    remaining_admins = db.execute(
        select(func.count()).select_from(orm.User).where(orm.User.role == "admin")
    ).scalar_one()
    deleted = 0
    skipped: list[dict] = []
    for user_id in payload.ids:
        user = db.get(orm.User, user_id)
        if user is None:
            skipped.append({"id": str(user_id), "reason": "Not found"})
            continue
        if user.role == "admin":
            if remaining_admins <= 1:
                skipped.append({"id": str(user_id), "reason": "Cannot delete the last remaining admin"})
                continue
            remaining_admins -= 1
        db.delete(user)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.post("/bulk-update-role", response_model=schemas.BulkUpdateResult)
def bulk_update_user_role(
    payload: schemas.BulkUpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    # Same local-counter reasoning as bulk_delete_users: a re-queried
    # SELECT COUNT(*) wouldn't see role changes made earlier in this same
    # loop (autoflush=False), so it could let a batch demote every admin.
    remaining_admins = db.execute(
        select(func.count()).select_from(orm.User).where(orm.User.role == "admin")
    ).scalar_one()
    updated = 0
    skipped: list[dict] = []
    for user_id in payload.ids:
        user = db.get(orm.User, user_id)
        if user is None:
            skipped.append({"id": str(user_id), "reason": "Not found"})
            continue
        if user.role == "admin" and payload.role != schemas.UserRole.admin:
            if remaining_admins <= 1:
                skipped.append({"id": str(user_id), "reason": "Cannot demote the last remaining admin"})
                continue
            remaining_admins -= 1
        user.role = payload.role.value
        updated += 1
    db.commit()
    return schemas.BulkUpdateResult(updated=updated, skipped=skipped)
