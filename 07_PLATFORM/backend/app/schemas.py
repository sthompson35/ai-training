from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ModuleBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    learning_outcome: str = Field(min_length=2)
    estimated_hours: int = Field(ge=0, le=200)
    assessment: str = Field(min_length=2, max_length=120)


class ModuleCreate(ModuleBase):
    id: str = Field(min_length=1, max_length=16)
    level_id: str = Field(min_length=1, max_length=8)


class ModuleUpdate(ModuleBase):
    pass


class ModuleOut(ModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    level_id: str


class LevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str


class LevelDetailOut(LevelOut):
    modules: list[ModuleOut] = []


class LabBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    domain: str = Field(min_length=2, max_length=120)
    deliverable: str = Field(min_length=2)


class LabCreate(LabBase):
    id: str = Field(min_length=1, max_length=16)


class LabUpdate(LabBase):
    pass


class LabOut(LabBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


class CertificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    title: str
    required_levels: str
    written_questions: int
    practical: str
    passing_percent: int
    recert_months: int


class LearnerBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr


class LearnerCreate(LearnerBase):
    pass


class LearnerOut(LearnerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class EnrollmentStatus(str, Enum):
    enrolled = "enrolled"
    written_passed = "written_passed"
    practical_submitted = "practical_submitted"
    practical_passed = "practical_passed"
    board_review = "board_review"
    certified = "certified"
    failed = "failed"


class EnrollmentCreate(BaseModel):
    learner_id: int
    certification_code: str = Field(min_length=1, max_length=16)


class EnrollmentUpdate(BaseModel):
    status: EnrollmentStatus
    written_score: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class EnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int
    certification_code: str
    status: EnrollmentStatus
    written_score: int | None
    notes: str | None
    enrolled_at: datetime
    updated_at: datetime


class LearnerDetailOut(LearnerOut):
    enrollments: list[EnrollmentOut] = []


class CertificationDetailOut(CertificationOut):
    enrollments: list[EnrollmentOut] = []


class GlossaryTermBase(BaseModel):
    definition: str = Field(min_length=2)


class GlossaryTermCreate(GlossaryTermBase):
    term: str = Field(min_length=1, max_length=120)


class GlossaryTermUpdate(GlossaryTermBase):
    pass


class GlossaryTermOut(GlossaryTermBase):
    model_config = ConfigDict(from_attributes=True)

    term: str


class KBArticleBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    domain: str = Field(min_length=1, max_length=200)
    content_type: str = Field(min_length=1, max_length=40)
    status: str = Field(min_length=1, max_length=40)
    owner: str = Field(min_length=1, max_length=120)
    review_date: str = Field(min_length=1, max_length=20)
    version: str = Field(min_length=1, max_length=20)
    definition: str
    why_it_matters: str
    when_to_use: str
    when_not_to_use: str
    architecture: str
    inputs_and_outputs: str
    risks_and_controls: str
    examples: str
    evaluation_criteria: str
    sources: str


class KBArticleCreate(KBArticleBase):
    pass


class KBArticleUpdate(KBArticleBase):
    pass


class KBArticleOut(KBArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ApprovalStatus(str, Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    suspended = "suspended"
    retired = "retired"


class MemberClass(str, Enum):
    human_trooper = "human_trooper"
    ai_agent = "ai_agent"


class CommandLayer(str, Enum):
    command = "command"
    field_operations = "field_operations"
    support = "support"
    training = "training"
    executive = "executive"


class LifecycleState(str, Enum):
    active = "active"
    inactive = "inactive"
    discharged = "discharged"


class ReadinessState(str, Enum):
    ready = "ready"
    not_ready = "not_ready"
    in_training = "in_training"
    stand_down = "stand_down"


class ProductionVerificationState(str, Enum):
    unverified = "unverified"
    verified = "verified"
    revoked = "revoked"


class ServiceMemberBase(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    member_class: MemberClass
    command_layer: CommandLayer
    current_role: str = Field(min_length=1, max_length=120)
    lifecycle_state: LifecycleState = LifecycleState.active
    readiness_state: ReadinessState = ReadinessState.ready
    legacy_alias: str | None = Field(default=None, max_length=32)
    source_lineage: str | None = None


class ServiceMemberCreate(ServiceMemberBase):
    service_member_id: str = Field(min_length=1, max_length=64)
    callsign_id: str = Field(min_length=1, max_length=64)
    callsign: str = Field(min_length=1, max_length=64)


class ServiceMemberUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    lifecycle_state: LifecycleState
    readiness_state: ReadinessState
    legacy_alias: str | None = Field(default=None, max_length=32)


class ServiceMemberOut(ServiceMemberBase):
    model_config = ConfigDict(from_attributes=True)

    service_member_id: str
    callsign_id: str
    callsign: str
    role_version: int
    production_verification_state: ProductionVerificationState
    created_by_service_member_id: str | None = None
    created_at: datetime
    updated_at: datetime


class RoleAssignmentHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_member_id: str
    role_version: int
    role: str
    command_layer: str
    readiness_state: str
    effective_at: datetime
    changed_by: str | None
    change_reason: str | None


class RoleChangeRequest(BaseModel):
    new_role: str = Field(min_length=1, max_length=120)
    new_command_layer: CommandLayer
    reason: str | None = Field(default=None, max_length=500)


class VerificationOutcome(str, Enum):
    verified = "verified"
    rejected = "rejected"
    revoked = "revoked"


class IdentityVerificationRequest(BaseModel):
    evidence_reference: str = Field(min_length=1, max_length=2000)
    verification_method: str = Field(min_length=1, max_length=120)
    outcome: VerificationOutcome
    notes: str | None = Field(default=None, max_length=2000)


class IdentityVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_member_id: str
    evidence_reference: str
    verification_method: str
    outcome: VerificationOutcome
    verifier_service_member_id: str
    notes: str | None
    verified_at: datetime


class AgentCardBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    owner: str = Field(min_length=1, max_length=120)
    service_member_id: str | None = Field(default=None, max_length=64)
    version: str = Field(min_length=1, max_length=20)
    purpose: str
    non_goals: str
    risk_tier: int = Field(ge=0, le=4)
    approved_models: str
    approved_tools: str
    data_access: str
    action_permissions: str
    approval_requirements: str
    budgets: str
    fallback: str
    monitoring: str
    kill_switch: str
    active: bool = True
    approval_status: ApprovalStatus = ApprovalStatus.draft
    evaluation_set: str
    last_review: str = Field(min_length=1, max_length=20)


class AgentCardCreate(AgentCardBase):
    pass


class AgentCardUpdate(AgentCardBase):
    pass


class AgentCardOut(AgentCardBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_service_member_id: str | None = None


class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1)


class UserRole(str, Enum):
    admin = "admin"
    contributor = "contributor"


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1)
    role: UserRole = UserRole.contributor
    identifier: str | None = Field(default=None, max_length=64)


class UserUpdate(BaseModel):
    role: UserRole


class UserIdentityLink(BaseModel):
    identifier: str = Field(min_length=1, max_length=64)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=1)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole
    service_member_id: str | None = None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: UserRole


class IncidentSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, Enum):
    detected = "detected"
    contained = "contained"
    investigating = "investigating"
    corrected = "corrected"
    resolved = "resolved"


class CapaStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    verified = "verified"
    closed = "closed"


class IncidentBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    severity: IncidentSeverity = IncidentSeverity.medium
    status: IncidentStatus = IncidentStatus.detected
    description: str = Field(min_length=2)
    impact: str = Field(min_length=2)
    root_cause: str | None = None
    corrective_action: str | None = None
    owner: str = Field(min_length=1, max_length=120)
    agent_id: int | None = None
    release_id: int | None = None
    capa_status: CapaStatus | None = None
    resolved_at: str | None = None


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(IncidentBase):
    pass


class IncidentOut(IncidentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    opened_at: datetime
    owner_service_member_id: str | None = None


class ReleaseStatus(str, Enum):
    proposed = "proposed"
    approved = "approved"
    released = "released"
    rolled_back = "rolled_back"


class ReleaseBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    version: str = Field(min_length=1, max_length=20)
    rationale: str = Field(min_length=2)
    expected_impact: str = Field(min_length=2)
    test_evidence: str = Field(min_length=2)
    approver: str = Field(min_length=1, max_length=120)
    risk_tier: int = Field(default=1, ge=0, le=4)
    release_date: str = Field(min_length=1, max_length=20)
    rollback_target: str = Field(min_length=2)
    status: ReleaseStatus = ReleaseStatus.proposed


class ReleaseCreate(ReleaseBase):
    pass


class ReleaseUpdate(ReleaseBase):
    pass


class ReleaseOut(ReleaseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    approver_service_member_id: str | None = None


class RaciEntryBase(BaseModel):
    activity: str = Field(min_length=2, max_length=200)
    role: str = Field(min_length=1, max_length=120)
    responsibility: str = Field(min_length=1, max_length=20)


class RaciEntryCreate(RaciEntryBase):
    pass


class RaciEntryUpdate(RaciEntryBase):
    pass


class RaciEntryOut(RaciEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class AuditLogEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    username: str
    service_member_id: str | None = None
    method: str
    path: str
    status_code: int


class ImportRowError(BaseModel):
    row: int
    reason: str


class ImportResult(BaseModel):
    created: int
    skipped: list[ImportRowError]


class BulkDeleteRequestStr(BaseModel):
    ids: list[str]


class BulkDeleteRequestInt(BaseModel):
    ids: list[int]


class BulkDeleteSkip(BaseModel):
    id: str
    reason: str


class BulkDeleteResult(BaseModel):
    deleted: int
    skipped: list[BulkDeleteSkip]


class SearchResultOut(BaseModel):
    type: str
    id: str
    title: str
    subtitle: str | None = None
    path: str


class CountByLabel(BaseModel):
    label: str
    count: int


class CostByDay(BaseModel):
    date: str
    cost_usd: float


class AnalyticsOut(BaseModel):
    modules_by_level: list[CountByLabel]
    raci_by_responsibility: list[CountByLabel]
    incidents_by_severity: list[CountByLabel]
    incidents_by_status: list[CountByLabel]
    releases_by_status: list[CountByLabel]
    enrollments_by_status: list[CountByLabel]
    cost_today_usd: float
    cost_daily_limit_usd: float
    cost_remaining_usd: float
    cost_last_7_days: list[CostByDay]


class BulkUpdateSkip(BaseModel):
    id: str
    reason: str


class BulkUpdateResult(BaseModel):
    updated: int
    skipped: list[BulkUpdateSkip]


class BulkUpdateIncidentStatusRequest(BaseModel):
    ids: list[int]
    status: IncidentStatus


class BulkUpdateIncidentCapaStatusRequest(BaseModel):
    ids: list[int]
    capa_status: CapaStatus


class BulkUpdateReleaseStatusRequest(BaseModel):
    ids: list[int]
    status: ReleaseStatus


class BulkUpdateEnrollmentStatusRequest(BaseModel):
    ids: list[int]
    status: EnrollmentStatus


class BulkUpdateKBArticleStatusRequest(BaseModel):
    ids: list[int]
    status: str = Field(min_length=1, max_length=40)


class BulkUpdateUserRoleRequest(BaseModel):
    ids: list[int]
    role: UserRole


class ApprovalRequestStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ApprovalRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_type: str
    route: str
    risk_tier: int
    input_chars: int
    reason: str
    status: ApprovalRequestStatus
    requested_at: datetime
    decided_at: datetime | None
    decided_by: str | None
    decided_by_service_member_id: str | None = None
    decision_note: str | None


class ApprovalDecisionRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class PolicyConfigOut(BaseModel):
    approval_tier: int
    cost_per_1k_chars_usd: float
