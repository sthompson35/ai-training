import os
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from . import orm, seed
from .agents import router as agents_router
from .analytics import router as analytics_router
from .audit import router as audit_router
from .auth import router as auth_router
from .certification import router as certification_router
from .curriculum import router as curriculum_router
from .db import Base, SessionLocal, engine, get_db
from .governance import router as governance_router
from .incidents import router as incidents_router
from .knowledge_base import router as knowledge_base_router
from .models import RouteDecision, RouteRequest, RouteResponse
from .policy import router as policy_router
from .rate_limit import RateLimitMiddleware
from .releases import router as releases_router
from .router import decide_route
from .search import router as search_router
from .service_members import router as service_members_router
from .users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        # create_all() only creates missing tables, not missing columns on
        # tables that already existed in a persisted volume from before the
        # `role` column was added. This is a one-off patch, not a migration
        # framework — the SQLite fallback needs no equivalent since it's
        # rebuilt fresh via create_all() on every process start.
        #
        # Backfill default is 'admin', not the app-level default of
        # 'contributor': any row that already existed before this column did
        # can only be the pre-existing seeded bootstrap account (there was no
        # way to create other users before this feature), so backfilling it
        # to anything other than 'admin' would silently strip the only admin
        # account of its role.
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin'")
            )
            conn.execute(
                text(
                    "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS release_id "
                    "INTEGER REFERENCES releases(id) ON DELETE SET NULL"
                )
            )
            conn.execute(text("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS capa_status VARCHAR(20)"))

            # R2 canonical identity cutover: service_members/role_assignment_history
            # are brand-new tables, already created by create_all() above on a
            # fresh database. This block only backfills them — and the FK columns
            # that reference them — onto an already-persisted Postgres volume that
            # predates this feature, same role as the three statements above it.
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS service_members (
                        service_member_id VARCHAR(64) PRIMARY KEY,
                        callsign_id VARCHAR(64) NOT NULL,
                        callsign VARCHAR(64) NOT NULL,
                        display_name VARCHAR(200) NOT NULL,
                        member_class VARCHAR(32) NOT NULL,
                        "current_role" VARCHAR(120) NOT NULL,
                        role_version INTEGER NOT NULL DEFAULT 1,
                        command_layer VARCHAR(120) NOT NULL,
                        lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'active',
                        readiness_state VARCHAR(32) NOT NULL DEFAULT 'ready',
                        production_verification_state VARCHAR(32) NOT NULL DEFAULT 'unverified',
                        legacy_alias VARCHAR(32),
                        source_lineage TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_service_members_callsign_id ON service_members (callsign_id)")
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_service_members_callsign ON service_members (callsign)")
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_service_members_legacy_alias ON service_members (legacy_alias)")
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS role_assignment_history (
                        id SERIAL PRIMARY KEY,
                        service_member_id VARCHAR(64) NOT NULL REFERENCES service_members(service_member_id) ON DELETE CASCADE,
                        role_version INTEGER NOT NULL,
                        role VARCHAR(120) NOT NULL,
                        command_layer VARCHAR(120) NOT NULL,
                        readiness_state VARCHAR(32) NOT NULL,
                        effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        changed_by VARCHAR(64) REFERENCES service_members(service_member_id) ON DELETE SET NULL,
                        change_reason TEXT
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_role_history_member_version "
                    "ON role_assignment_history (service_member_id, role_version)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS owner_service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_agent_cards_service_member_id ON agent_cards (service_member_id)")
            )
            conn.execute(
                text(
                    "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS owner_service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS approver_service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS decided_by_service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_service_member_id ON users (service_member_id)")
            )
            conn.execute(
                text(
                    "ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )

            # Governed independent-verification workflow: production_verification_state
            # is never written by a generic UPDATE — only by the transaction that
            # inserts a row here (see identity_resolution.apply_verification).
            conn.execute(
                text(
                    "ALTER TABLE service_members ADD COLUMN IF NOT EXISTS created_by_service_member_id VARCHAR(64) "
                    "REFERENCES service_members(service_member_id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS identity_verifications (
                        id SERIAL PRIMARY KEY,
                        service_member_id VARCHAR(64) NOT NULL REFERENCES service_members(service_member_id) ON DELETE CASCADE,
                        evidence_reference TEXT NOT NULL,
                        verification_method VARCHAR(120) NOT NULL,
                        outcome VARCHAR(20) NOT NULL,
                        verifier_service_member_id VARCHAR(64) NOT NULL REFERENCES service_members(service_member_id),
                        notes TEXT,
                        verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
            )

            # Governed lifecycle_state transitions (active/inactive/discharged):
            # lifecycle_state is only ever written by the transaction that
            # inserts one of these rows (see identity_resolution.apply_
            # lifecycle_transition) -- never by the generic PUT update.
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS lifecycle_transition_history (
                        id SERIAL PRIMARY KEY,
                        service_member_id VARCHAR(64) NOT NULL REFERENCES service_members(service_member_id) ON DELETE CASCADE,
                        from_state VARCHAR(32) NOT NULL,
                        to_state VARCHAR(32) NOT NULL,
                        reason TEXT NOT NULL,
                        changed_by VARCHAR(64) REFERENCES service_members(service_member_id) ON DELETE SET NULL,
                        effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_lifecycle_history_member_effective "
                    "ON lifecycle_transition_history (service_member_id, effective_at)"
                )
            )
    db = SessionLocal()
    try:
        seed.seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="AI Training Academy API",
    version=os.getenv("APP_VERSION", "2.4.0"),
    description="Reference API for hybrid AI routing and academy operations.",
    lifespan=lifespan,
)

# Middleware order matters: Starlette applies the LAST-added middleware outermost.
# RateLimitMiddleware is added first so CORSMiddleware (added second, below) wraps
# it — that way a 429 from the rate limiter still gets CORS headers attached,
# instead of the browser seeing a confusing CORS failure instead of the 429.
app.add_middleware(RateLimitMiddleware)

_allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(curriculum_router)
app.include_router(certification_router)
app.include_router(knowledge_base_router)
app.include_router(agents_router)
app.include_router(service_members_router)
app.include_router(incidents_router)
app.include_router(releases_router)
app.include_router(governance_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(search_router)
app.include_router(analytics_router)
app.include_router(policy_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "academy-api"}


@app.get("/ready")
def ready() -> dict:
    return {
        "status": "ready",
        "policy_version": os.getenv("POLICY_VERSION", "2.0.0"),
        "local_ai_enabled": os.getenv("AI_LOCAL_ENABLED", "true").lower() == "true",
    }


@app.post("/v1/route", response_model=RouteResponse)
def route_ai_request(
    payload: RouteRequest,
    db: Session = Depends(get_db),
    x_request_id: str | None = Header(default=None),
) -> RouteResponse:
    request_id = x_request_id or f"req_{uuid.uuid4().hex}"
    decision = decide_route(payload)
    # Production implementation should emit a structured audit event here.
    _ = request_id

    if decision.requires_human_approval:
        bypassed = False
        if payload.approval_request_id is not None:
            existing = db.get(orm.ApprovalRequest, payload.approval_request_id)
            if existing is not None and existing.status == "approved" and existing.task_type == payload.task_type:
                bypassed = True
        if not bypassed:
            approval = orm.ApprovalRequest(
                task_type=payload.task_type,
                route=decision.route.value,
                risk_tier=payload.risk_tier,
                input_chars=payload.input_chars,
                reason=decision.reason,
            )
            db.add(approval)
            db.commit()
            db.refresh(approval)
            decision.route = RouteDecision.pending_approval
            decision.reason = "Awaiting human approval before this request can proceed."
            decision.estimated_cost_usd = 0.0
            decision.approval_request_id = approval.id
            return decision

    db.add(
        orm.RouteCostLog(
            task_type=payload.task_type,
            route=decision.route.value,
            input_chars=payload.input_chars,
            estimated_cost_usd=decision.estimated_cost_usd,
        )
    )
    db.commit()
    return decision
