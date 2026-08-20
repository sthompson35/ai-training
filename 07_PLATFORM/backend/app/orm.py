from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _require_resolved_identity(member: "ServiceMember | None", *, model: str, record_id, member_id: str | None) -> "ServiceMember":
    """Backs the read-only owner/approver properties below. member_service_id
    is nullable at the schema level (ON DELETE SET NULL) as a defensive
    safety valve, but no code path in this application ever deletes a
    ServiceMember row -- every write site resolves a real identity before
    persisting the FK, so this should be unreachable in practice. Raising a
    clear, specific error here beats letting that invariant violation surface
    as an opaque AttributeError deeper in Pydantic serialization."""
    if member is None:
        raise ValueError(
            f"{model} {record_id!r}: service_member_id={member_id!r} does not resolve to a "
            "ServiceMember row. This should be unreachable -- no code path deletes a "
            "ServiceMember -- so if this fires, the FK was set to a nonexistent id somehow."
        )
    return member


class Level(Base):
    __tablename__ = "levels"

    id: Mapped[str] = mapped_column(String(8), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    modules: Mapped[list["Module"]] = relationship(
        back_populates="level", cascade="all, delete-orphan", order_by="Module.id"
    )


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    level_id: Mapped[str] = mapped_column(ForeignKey("levels.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    learning_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    assessment: Mapped[str] = mapped_column(String(120), nullable=False)

    level: Mapped["Level"] = relationship(back_populates="modules")


class Lab(Base):
    __tablename__ = "labs"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    domain: Mapped[str] = mapped_column(String(120), nullable=False)
    deliverable: Mapped[str] = mapped_column(Text, nullable=False)


class Certification(Base):
    __tablename__ = "certifications"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    required_levels: Mapped[str] = mapped_column(String(16), nullable=False)
    written_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    practical: Mapped[str] = mapped_column(Text, nullable=False)
    passing_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    recert_months: Mapped[int] = mapped_column(Integer, nullable=False)

    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="certification")


class Learner(Base):
    __tablename__ = "learners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)

    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="learner", cascade="all, delete-orphan"
    )


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("learners.id"), nullable=False)
    certification_code: Mapped[str] = mapped_column(ForeignKey("certifications.code"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="enrolled")
    written_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    learner: Mapped["Learner"] = relationship(back_populates="enrollments")
    certification: Mapped["Certification"] = relationship(back_populates="enrollments")


class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    term: Mapped[str] = mapped_column(String(120), primary_key=True)
    definition: Mapped[str] = mapped_column(Text, nullable=False)


class KBArticle(Base):
    __tablename__ = "kb_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    domain: Mapped[str] = mapped_column(String(200), nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="draft")
    owner: Mapped[str] = mapped_column(String(120), nullable=False)
    review_date: Mapped[str] = mapped_column(String(20), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    why_it_matters: Mapped[str] = mapped_column(Text, nullable=False)
    when_to_use: Mapped[str] = mapped_column(Text, nullable=False)
    when_not_to_use: Mapped[str] = mapped_column(Text, nullable=False)
    architecture: Mapped[str] = mapped_column(Text, nullable=False)
    inputs_and_outputs: Mapped[str] = mapped_column(Text, nullable=False)
    risks_and_controls: Mapped[str] = mapped_column(Text, nullable=False)
    examples: Mapped[str] = mapped_column(Text, nullable=False)
    evaluation_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[str] = mapped_column(Text, nullable=False)


class ServiceMember(Base):
    __tablename__ = "service_members"

    service_member_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    callsign_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    callsign: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    member_class: Mapped[str] = mapped_column(String(32), nullable=False)
    current_role: Mapped[str] = mapped_column(String(120), nullable=False)
    role_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    command_layer: Mapped[str] = mapped_column(String(120), nullable=False)
    lifecycle_state: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    readiness_state: Mapped[str] = mapped_column(String(32), nullable=False, default="ready")
    production_verification_state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="unverified"
    )
    legacy_alias: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    source_lineage: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    role_history: Mapped[list["RoleAssignmentHistory"]] = relationship(
        back_populates="service_member",
        cascade="all, delete-orphan",
        order_by="RoleAssignmentHistory.role_version",
        foreign_keys="RoleAssignmentHistory.service_member_id",
    )
    verifications: Mapped[list["IdentityVerification"]] = relationship(
        back_populates="service_member",
        cascade="all, delete-orphan",
        order_by="IdentityVerification.verified_at",
        foreign_keys="IdentityVerification.service_member_id",
    )
    lifecycle_history: Mapped[list["LifecycleTransitionHistory"]] = relationship(
        back_populates="service_member",
        cascade="all, delete-orphan",
        order_by="LifecycleTransitionHistory.effective_at",
        foreign_keys="LifecycleTransitionHistory.service_member_id",
    )


class RoleAssignmentHistory(Base):
    __tablename__ = "role_assignment_history"
    __table_args__ = (UniqueConstraint("service_member_id", "role_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_member_id: Mapped[str] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="CASCADE"), nullable=False
    )
    role_version: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    command_layer: Mapped[str] = mapped_column(String(120), nullable=False)
    readiness_state: Mapped[str] = mapped_column(String(32), nullable=False)
    effective_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    changed_by: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    service_member: Mapped["ServiceMember"] = relationship(
        back_populates="role_history", foreign_keys=[service_member_id]
    )


class IdentityVerification(Base):
    """The governed independent-verification record.

    `ServiceMember.production_verification_state` is only ever written by
    the transaction that inserts one of these rows (see
    identity_resolution.apply_verification) — never by the generic PUT
    /v1/service-members/{id} update. A "verified" label with no
    corresponding row here is exactly the ungoverned state this table exists
    to prevent; app/canary.py checks for that condition independently.
    """

    __tablename__ = "identity_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_member_id: Mapped[str] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="CASCADE"), nullable=False
    )
    evidence_reference: Mapped[str] = mapped_column(Text, nullable=False)
    verification_method: Mapped[str] = mapped_column(String(120), nullable=False)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    verifier_service_member_id: Mapped[str] = mapped_column(
        ForeignKey("service_members.service_member_id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    service_member: Mapped["ServiceMember"] = relationship(
        back_populates="verifications", foreign_keys=[service_member_id]
    )


class LifecycleTransitionHistory(Base):
    """The governed record of every lifecycle_state change.

    `ServiceMember.lifecycle_state` is only ever written by the transaction
    that inserts one of these rows (see identity_resolution.apply_lifecycle_
    transition) — never by the generic PUT /v1/service-members/{id} update,
    which excludes this field for exactly that reason. "discharged" is
    terminal (no further transitions are valid from it) and is this
    registry's substitute for deletion: identities are never removed, only
    moved to a state that means they're no longer active.
    """

    __tablename__ = "lifecycle_transition_history"
    __table_args__ = (
        Index("ix_lifecycle_history_member_effective", "service_member_id", "effective_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_member_id: Mapped[str] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="CASCADE"), nullable=False
    )
    from_state: Mapped[str] = mapped_column(String(32), nullable=False)
    to_state: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    effective_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    service_member: Mapped["ServiceMember"] = relationship(
        back_populates="lifecycle_history", foreign_keys=[service_member_id]
    )


class AgentCard(Base):
    __tablename__ = "agent_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    owner_service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True, unique=True
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    non_goals: Mapped[str] = mapped_column(Text, nullable=False)
    risk_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    approved_models: Mapped[str] = mapped_column(Text, nullable=False)
    approved_tools: Mapped[str] = mapped_column(Text, nullable=False)
    data_access: Mapped[str] = mapped_column(Text, nullable=False)
    action_permissions: Mapped[str] = mapped_column(Text, nullable=False)
    approval_requirements: Mapped[str] = mapped_column(Text, nullable=False)
    budgets: Mapped[str] = mapped_column(Text, nullable=False)
    fallback: Mapped[str] = mapped_column(Text, nullable=False)
    monitoring: Mapped[str] = mapped_column(Text, nullable=False)
    kill_switch: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    approval_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    evaluation_set: Mapped[str] = mapped_column(Text, nullable=False)
    last_review: Mapped[str] = mapped_column(String(20), nullable=False)

    owner_service_member: Mapped["ServiceMember"] = relationship(foreign_keys=[owner_service_member_id])

    @property
    def owner(self) -> str:
        """Derived from owner_service_member_id, not a stored column -- the
        free-text duplicate was dropped once every write path was proven to
        always populate a resolved owner_service_member_id (see
        identity_resolution.resolve_identifier_or_422, required on create).
        Read-only: nothing may setattr('owner', ...) on this model anymore."""
        return _require_resolved_identity(
            self.owner_service_member, model="AgentCard", record_id=self.id, member_id=self.owner_service_member_id
        ).callsign


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="contributor")
    service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="detected")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrective_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("agent_cards.id", ondelete="SET NULL"), nullable=True
    )
    release_id: Mapped[int | None] = mapped_column(
        ForeignKey("releases.id", ondelete="SET NULL"), nullable=True
    )
    capa_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[str | None] = mapped_column(String(20), nullable=True)

    owner_service_member: Mapped["ServiceMember"] = relationship(foreign_keys=[owner_service_member_id])

    @property
    def owner(self) -> str:
        """Derived from owner_service_member_id -- see AgentCard.owner's
        docstring for why the free-text duplicate was dropped. Read-only."""
        return _require_resolved_identity(
            self.owner_service_member, model="Incident", record_id=self.id, member_id=self.owner_service_member_id
        ).callsign


class Release(Base):
    __tablename__ = "releases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    expected_impact: Mapped[str] = mapped_column(Text, nullable=False)
    test_evidence: Mapped[str] = mapped_column(Text, nullable=False)
    approver_service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    risk_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    release_date: Mapped[str] = mapped_column(String(20), nullable=False)
    rollback_target: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="proposed")

    approver_service_member: Mapped["ServiceMember"] = relationship(foreign_keys=[approver_service_member_id])

    @property
    def approver(self) -> str:
        """Derived from approver_service_member_id -- see AgentCard.owner's
        docstring for why the free-text duplicate was dropped. Read-only."""
        return _require_resolved_identity(
            self.approver_service_member, model="Release", record_id=self.id, member_id=self.approver_service_member_id
        ).callsign


class RaciEntry(Base):
    __tablename__ = "raci_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    activity: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    responsibility: Mapped[str] = mapped_column(String(20), nullable=False)


class AuditLogEntry(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(200), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)


class RouteCostLog(Base):
    __tablename__ = "route_cost_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    task_type: Mapped[str] = mapped_column(String(80), nullable=False)
    route: Mapped[str] = mapped_column(String(20), nullable=False)
    input_chars: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_type: Mapped[str] = mapped_column(String(80), nullable=False)
    route: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_tier: Mapped[int] = mapped_column(Integer, nullable=False)
    input_chars: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    decided_by_service_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("service_members.service_member_id", ondelete="SET NULL"), nullable=True
    )
    decision_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
