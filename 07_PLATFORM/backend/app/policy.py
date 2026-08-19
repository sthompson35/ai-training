import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .audit import log_audit_event
from .auth import require_admin
from .db import get_db
from .pagination import paginate

router = APIRouter(prefix="/v1/policy", tags=["policy"])


def _approval_query(status: str | None):
    stmt = select(orm.ApprovalRequest).order_by(orm.ApprovalRequest.id.desc())
    if status:
        stmt = stmt.where(orm.ApprovalRequest.status == status)
    return stmt


@router.get("/approvals", response_model=list[schemas.ApprovalRequestOut])
def list_approvals(
    response: Response,
    status: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
):
    return paginate(db, _approval_query(status), response, limit, offset)


@router.get("/approvals/{approval_id}", response_model=schemas.ApprovalRequestOut)
def get_approval(approval_id: int, db: Session = Depends(get_db), current_user: str = Depends(require_admin)):
    approval = db.get(orm.ApprovalRequest, approval_id)
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return approval


def _decide_approval(
    approval_id: int,
    new_status: str,
    payload: schemas.ApprovalDecisionRequest,
    db: Session,
    current_user: str,
) -> orm.ApprovalRequest:
    approval = db.get(orm.ApprovalRequest, approval_id)
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if approval.status != "pending":
        raise HTTPException(status_code=409, detail=f"Approval request is already {approval.status}")
    approval.status = new_status
    approval.decided_at = datetime.now(timezone.utc)
    approval.decided_by = current_user
    approval.decided_by_service_member_id = db.execute(
        select(orm.User.service_member_id).where(orm.User.username == current_user)
    ).scalar_one_or_none()
    approval.decision_note = payload.note
    db.commit()
    db.refresh(approval)
    return approval


@router.post("/approvals/{approval_id}/approve", response_model=schemas.ApprovalRequestOut)
def approve_approval(
    approval_id: int,
    payload: schemas.ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    return _decide_approval(approval_id, "approved", payload, db, current_user)


@router.post("/approvals/{approval_id}/reject", response_model=schemas.ApprovalRequestOut)
def reject_approval(
    approval_id: int,
    payload: schemas.ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
    _audit: None = Depends(log_audit_event),
):
    return _decide_approval(approval_id, "rejected", payload, db, current_user)


@router.get("/config", response_model=schemas.PolicyConfigOut)
def get_policy_config() -> schemas.PolicyConfigOut:
    return schemas.PolicyConfigOut(
        approval_tier=int(os.getenv("REQUIRE_HUMAN_APPROVAL_TIER", "2")),
        cost_per_1k_chars_usd=float(os.getenv("AI_SERVER_COST_PER_1K_CHARS_USD", "0.002")),
    )
