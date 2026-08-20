from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import orm, seed
from app.auth import hash_password
from app.db import Base, get_db
from app.main import app

# Synthetic test/demo identities only — never the production seed source.
# See 07_PLATFORM/backend/tests/fixtures/synthetic_personnel/README.md and
# 11_PERSONNEL/Personnel_Roster.md for why these are kept separate.
SYNTHETIC_PERSONNEL_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "synthetic_personnel"


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def member_payload(**overrides):
    payload = {
        "service_member_id": "ATA-VICTOR-000",
        "callsign_id": "ATA-SM-VICTOR-001",
        "callsign": "@VICTOR",
        "display_name": "Priya Moreno",
        "member_class": "human_trooper",
        "command_layer": "support",
        "current_role": "Support Technician",
        "legacy_alias": "ATA-SM-023",
    }
    payload.update(overrides)
    return payload


def test_create_requires_admin(client, auth_headers):
    response = client.post("/v1/service-members", json=member_payload(), headers=auth_headers)
    assert response.status_code == 403


def test_create_and_get_roundtrip(client, admin_headers):
    create = client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    assert create.status_code == 201
    body = create.json()
    assert body["role_version"] == 1
    assert body["lifecycle_state"] == "active"
    assert body["readiness_state"] == "ready"
    assert body["production_verification_state"] == "unverified"

    fetched = client.get("/v1/service-members/ATA-VICTOR-000")
    assert fetched.status_code == 200
    assert fetched.json()["callsign"] == "@VICTOR"


def test_resolution_hits_the_same_record_at_every_tier(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    for identifier in ["ATA-VICTOR-000", "ATA-SM-VICTOR-001", "@VICTOR", "VICTOR", "ATA-SM-023"]:
        response = client.get("/v1/service-members/resolve", params={"identifier": identifier})
        assert response.status_code == 200, identifier
        assert response.json()["service_member_id"] == "ATA-VICTOR-000", identifier


def test_resolution_rejects_a_near_miss_instead_of_fuzzy_matching(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    response = client.get("/v1/service-members/resolve", params={"identifier": "@VICTORY"})
    assert response.status_code == 404

    response = client.get("/v1/service-members/resolve", params={"identifier": "ATA-SM-024"})
    assert response.status_code == 404


def test_victor_and_trooper_victor_are_distinct_identities(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    client.post(
        "/v1/service-members",
        json=member_payload(
            service_member_id="ATA-TROOPER_VICTOR-000",
            callsign_id="ATA-SM-TROOPER_VICTOR-001",
            callsign="@TROOPER_VICTOR",
            display_name="Victor Reyes",
            legacy_alias="ATA-SM-028",
        ),
        headers=admin_headers,
    )

    victor = client.get("/v1/service-members/resolve", params={"identifier": "@VICTOR"}).json()
    trooper_victor = client.get(
        "/v1/service-members/resolve", params={"identifier": "@TROOPER_VICTOR"}
    ).json()
    assert victor["service_member_id"] != trooper_victor["service_member_id"]
    assert victor["display_name"] != trooper_victor["display_name"]


@pytest.mark.parametrize(
    "conflict_field,conflict_value",
    [
        ("service_member_id", "ATA-VICTOR-000"),
        ("callsign_id", "ATA-SM-VICTOR-001"),
        ("callsign", "@VICTOR"),
        ("legacy_alias", "ATA-SM-023"),
    ],
)
def test_create_rejects_uniqueness_collisions(client, admin_headers, conflict_field, conflict_value):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    colliding = member_payload(
        service_member_id="ATA-OTHER-000",
        callsign_id="ATA-SM-OTHER-001",
        callsign="@OTHER",
        legacy_alias="ATA-SM-099",
    )
    colliding[conflict_field] = conflict_value

    response = client.post("/v1/service-members", json=colliding, headers=admin_headers)
    assert response.status_code == 409


def test_role_change_increments_version_and_appends_history_without_a_new_identity(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    change = client.post(
        "/v1/service-members/ATA-VICTOR-000/role-change",
        json={"new_role": "Field Coordinator", "new_command_layer": "field_operations", "reason": "promotion"},
        headers=admin_headers,
    )
    assert change.status_code == 200
    assert change.json()["role_version"] == 2
    assert change.json()["role"] == "Field Coordinator"

    identity = client.get("/v1/service-members/ATA-VICTOR-000").json()
    assert identity["service_member_id"] == "ATA-VICTOR-000"
    assert identity["role_version"] == 2
    assert identity["current_role"] == "Field Coordinator"
    assert identity["command_layer"] == "field_operations"

    history = client.get("/v1/service-members/ATA-VICTOR-000/role-history").json()
    assert [row["role_version"] for row in history] == [1, 2]
    assert history[0]["role"] == "Support Technician"
    assert history[1]["role"] == "Field Coordinator"


def test_create_never_accepts_a_caller_supplied_verification_state(client, admin_headers):
    """production_verification_state isn't even part of ServiceMemberCreate —
    a caller cannot bypass the verification workflow by claiming an identity
    is already verified at creation time."""
    created = client.post(
        "/v1/service-members",
        json={**member_payload(), "production_verification_state": "verified"},
        headers=admin_headers,
    )
    assert created.status_code == 201
    assert created.json()["production_verification_state"] == "unverified"


def test_update_endpoint_cannot_change_identity_role_lifecycle_or_verification_fields(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    update = client.put(
        "/v1/service-members/ATA-VICTOR-000",
        json={
            "display_name": "Priya M.",
            "readiness_state": "stand_down",
            "legacy_alias": "ATA-SM-023",
            # extra fields below must be silently ignored by the update schema
            "lifecycle_state": "inactive",
            "production_verification_state": "verified",
            "current_role": "Should not apply",
            "role_version": 99,
            "service_member_id": "ATA-SHOULD-NOT-APPLY-000",
        },
        headers=admin_headers,
    )
    assert update.status_code == 200
    body = update.json()
    assert body["display_name"] == "Priya M."
    assert body["lifecycle_state"] == "active"  # PUT cannot change lifecycle_state
    assert body["current_role"] == "Support Technician"
    assert body["production_verification_state"] == "unverified"  # PUT cannot promote to verified
    assert body["role_version"] == 1
    assert body["service_member_id"] == "ATA-VICTOR-000"


def test_deactivate_reactivate_round_trip_records_history(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    deactivate = client.post(
        "/v1/service-members/ATA-VICTOR-000/deactivate",
        json={"reason": "Extended leave"},
        headers=admin_headers,
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["from_state"] == "active"
    assert deactivate.json()["to_state"] == "inactive"

    fetched = client.get("/v1/service-members/ATA-VICTOR-000")
    assert fetched.json()["lifecycle_state"] == "inactive"

    reactivate = client.post(
        "/v1/service-members/ATA-VICTOR-000/reactivate",
        json={"reason": "Returned from leave"},
        headers=admin_headers,
    )
    assert reactivate.status_code == 200
    assert reactivate.json()["from_state"] == "inactive"
    assert reactivate.json()["to_state"] == "active"

    history = client.get("/v1/service-members/ATA-VICTOR-000/lifecycle-history").json()
    assert [row["to_state"] for row in history] == ["inactive", "active"]
    assert history[0]["reason"] == "Extended leave"
    assert history[1]["reason"] == "Returned from leave"


def test_discharge_is_terminal(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    discharge = client.post(
        "/v1/service-members/ATA-VICTOR-000/discharge",
        json={"reason": "Left the organization"},
        headers=admin_headers,
    )
    assert discharge.status_code == 200
    assert discharge.json()["to_state"] == "discharged"

    still_resolves = client.get("/v1/service-members/resolve", params={"identifier": "@VICTOR"})
    assert still_resolves.status_code == 200
    assert still_resolves.json()["lifecycle_state"] == "discharged"

    reactivate_attempt = client.post(
        "/v1/service-members/ATA-VICTOR-000/reactivate",
        json={"reason": "Should not be allowed"},
        headers=admin_headers,
    )
    assert reactivate_attempt.status_code == 409

    deactivate_attempt = client.post(
        "/v1/service-members/ATA-VICTOR-000/deactivate",
        json={"reason": "Should also not be allowed"},
        headers=admin_headers,
    )
    assert deactivate_attempt.status_code == 409


def test_lifecycle_transition_requires_admin_and_a_reason(client, auth_headers, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    non_admin = client.post(
        "/v1/service-members/ATA-VICTOR-000/deactivate", json={"reason": "x"}, headers=auth_headers
    )
    assert non_admin.status_code == 403

    missing_reason = client.post(
        "/v1/service-members/ATA-VICTOR-000/deactivate", json={"reason": ""}, headers=admin_headers
    )
    assert missing_reason.status_code == 422


def _create_linked_operator(client, admin_headers, username, callsign):
    """Creates a real `users` row linked to `callsign`'s identity and logs in
    as it, returning that user's own bearer-token headers. Unlike
    `admin_headers` (a bare JWT with no matching `users` row), this token
    resolves through resolve_verifier_or_error, so it can actually perform
    /verify calls and participate in separation-of-duties checks."""
    created_user = client.post(
        "/v1/users",
        json={"username": username, "password": "pw123456", "role": "admin", "identifier": callsign},
        headers=admin_headers,
    )
    assert created_user.status_code == 201, created_user.text
    login = client.post("/v1/auth/login", json={"username": username, "password": "pw123456"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_verify_requires_admin(client, auth_headers):
    client_admin_headers = {"Authorization": auth_headers["Authorization"]}
    response = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={"evidence_reference": "doc-1", "verification_method": "document_review", "outcome": "verified"},
        headers=client_admin_headers,
    )
    assert response.status_code == 403


def test_verify_requires_the_caller_to_be_linked_to_a_registry_identity(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    # admin_headers is a bare JWT (role=admin) with no matching `users` row —
    # exactly the "caller isn't a known identity themselves" case.
    response = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={"evidence_reference": "doc-1", "verification_method": "document_review", "outcome": "verified"},
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert "linked" in response.json()["detail"].lower()


def test_verify_rejects_self_verification(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    verifier_headers = _create_linked_operator(client, admin_headers, "self-verifier", "@VICTOR")

    response = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={"evidence_reference": "doc-1", "verification_method": "document_review", "outcome": "verified"},
        headers=verifier_headers,
    )
    assert response.status_code == 409
    assert "cannot verify itself" in response.json()["detail"]


def test_verify_rejects_the_identity_that_onboarded_the_record(client, admin_headers):
    # The creator identity, distinct from the identity being verified.
    client.post(
        "/v1/service-members",
        json=member_payload(
            service_member_id="ATA-CREATOR-000",
            callsign_id="ATA-SM-CREATOR-001",
            callsign="@CREATOR",
            legacy_alias="ATA-SM-090",
        ),
        headers=admin_headers,
    )
    creator_headers = _create_linked_operator(client, admin_headers, "creator-op", "@CREATOR")

    # creator-op (linked to @CREATOR) onboards @VICTOR — so @VICTOR.created_by == @CREATOR.
    created = client.post("/v1/service-members", json=member_payload(), headers=creator_headers)
    assert created.status_code == 201
    assert created.json()["created_by_service_member_id"] == "ATA-CREATOR-000"

    response = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={"evidence_reference": "doc-1", "verification_method": "document_review", "outcome": "verified"},
        headers=creator_headers,
    )
    assert response.status_code == 409
    assert "onboarded this record" in response.json()["detail"]


def test_verify_succeeds_with_an_independent_verifier_and_records_evidence(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    client.post(
        "/v1/service-members",
        json=member_payload(
            service_member_id="ATA-VERIFIER-000",
            callsign_id="ATA-SM-VERIFIER-001",
            callsign="@VERIFIER",
            legacy_alias="ATA-SM-091",
        ),
        headers=admin_headers,
    )
    verifier_headers = _create_linked_operator(client, admin_headers, "independent-verifier", "@VERIFIER")

    verify = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={
            "evidence_reference": "background-check-2026-08-09.pdf, ref #4471",
            "verification_method": "document_review",
            "outcome": "verified",
            "notes": "Cross-checked against issuing authority record.",
        },
        headers=verifier_headers,
    )
    assert verify.status_code == 200
    body = verify.json()
    assert body["verifier_service_member_id"] == "ATA-VERIFIER-000"
    assert body["outcome"] == "verified"
    assert body["evidence_reference"].startswith("background-check")

    identity = client.get("/v1/service-members/ATA-VICTOR-000").json()
    assert identity["production_verification_state"] == "verified"

    history = client.get("/v1/service-members/ATA-VICTOR-000/verifications").json()
    assert len(history) == 1
    assert history[0]["outcome"] == "verified"


def test_verify_rejected_outcome_is_recorded_but_does_not_change_state(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    client.post(
        "/v1/service-members",
        json=member_payload(
            service_member_id="ATA-VERIFIER-000",
            callsign_id="ATA-SM-VERIFIER-001",
            callsign="@VERIFIER",
            legacy_alias="ATA-SM-091",
        ),
        headers=admin_headers,
    )
    verifier_headers = _create_linked_operator(client, admin_headers, "independent-verifier", "@VERIFIER")

    verify = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={
            "evidence_reference": "insufficient documentation supplied",
            "verification_method": "document_review",
            "outcome": "rejected",
        },
        headers=verifier_headers,
    )
    assert verify.status_code == 200
    assert verify.json()["outcome"] == "rejected"

    identity = client.get("/v1/service-members/ATA-VICTOR-000").json()
    assert identity["production_verification_state"] == "unverified"

    history = client.get("/v1/service-members/ATA-VICTOR-000/verifications").json()
    assert len(history) == 1  # the rejected attempt is still recorded history


def test_verify_revoked_outcome_moves_a_verified_identity_back_to_revoked(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    client.post(
        "/v1/service-members",
        json=member_payload(
            service_member_id="ATA-VERIFIER-000",
            callsign_id="ATA-SM-VERIFIER-001",
            callsign="@VERIFIER",
            legacy_alias="ATA-SM-091",
        ),
        headers=admin_headers,
    )
    verifier_headers = _create_linked_operator(client, admin_headers, "independent-verifier", "@VERIFIER")

    first = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={"evidence_reference": "doc-1", "verification_method": "document_review", "outcome": "verified"},
        headers=verifier_headers,
    )
    assert first.status_code == 200
    assert client.get("/v1/service-members/ATA-VICTOR-000").json()["production_verification_state"] == "verified"

    revoke = client.post(
        "/v1/service-members/ATA-VICTOR-000/verify",
        json={
            "evidence_reference": "credential found to be forged upon re-review",
            "verification_method": "document_review",
            "outcome": "revoked",
        },
        headers=verifier_headers,
    )
    assert revoke.status_code == 200
    assert revoke.json()["outcome"] == "revoked"

    identity = client.get("/v1/service-members/ATA-VICTOR-000").json()
    assert identity["production_verification_state"] == "revoked"

    history = client.get("/v1/service-members/ATA-VICTOR-000/verifications").json()
    assert [h["outcome"] for h in history] == ["verified", "revoked"]


def test_incident_owner_resolves_and_persists_the_canonical_link(client, admin_headers, auth_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    created = client.post(
        "/v1/incidents",
        json={
            "title": "Agent produced hallucinated refund policy",
            "severity": "high",
            "status": "detected",
            "description": "Agent told a user a refund was approved when it was not.",
            "impact": "One customer received incorrect information.",
            "owner": "ATA-SM-VICTOR-001",
            "agent_id": None,
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["owner"] == "@VICTOR"
    assert body["owner_service_member_id"] == "ATA-VICTOR-000"


def test_incident_owner_rejects_unresolvable_identifier(client, auth_headers):
    response = client.post(
        "/v1/incidents",
        json={
            "title": "Some incident",
            "severity": "low",
            "status": "detected",
            "description": "Long enough description.",
            "impact": "Long enough impact.",
            "owner": "not-a-real-identity",
            "agent_id": None,
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_audit_log_captures_service_member_id_for_a_linked_user_and_none_for_unlinked(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)

    linked_user = client.post(
        "/v1/users",
        json={"username": "linked-op", "password": "pw123456", "role": "contributor", "identifier": "@VICTOR"},
        headers=admin_headers,
    )
    assert linked_user.status_code == 201
    assert linked_user.json()["service_member_id"] == "ATA-VICTOR-000"

    unlinked_user = client.post(
        "/v1/users",
        json={"username": "unlinked-op", "password": "pw123456", "role": "contributor"},
        headers=admin_headers,
    )
    assert unlinked_user.status_code == 201
    assert unlinked_user.json()["service_member_id"] is None

    linked_login = client.post(
        "/v1/auth/login", json={"username": "linked-op", "password": "pw123456"}
    ).json()
    unlinked_login = client.post(
        "/v1/auth/login", json={"username": "unlinked-op", "password": "pw123456"}
    ).json()

    client.get("/v1/glossary", headers={"Authorization": f"Bearer {linked_login['access_token']}"})
    client.post(
        "/v1/glossary",
        json={"term": "linked-term", "definition": "def"},
        headers={"Authorization": f"Bearer {linked_login['access_token']}"},
    )
    client.post(
        "/v1/glossary",
        json={"term": "unlinked-term", "definition": "def"},
        headers={"Authorization": f"Bearer {unlinked_login['access_token']}"},
    )

    audit_log = client.get("/v1/audit-log", params={"limit": 100}, headers=admin_headers).json()
    linked_entry = next(e for e in audit_log if e["username"] == "linked-op")
    unlinked_entry = next(e for e in audit_log if e["username"] == "unlinked-op")
    assert linked_entry["service_member_id"] == "ATA-VICTOR-000"
    assert unlinked_entry["service_member_id"] is None


def test_user_identifier_rejects_double_linking(client, admin_headers):
    client.post("/v1/service-members", json=member_payload(), headers=admin_headers)
    first = client.post(
        "/v1/users",
        json={"username": "first-op", "password": "pw123456", "role": "contributor", "identifier": "@VICTOR"},
        headers=admin_headers,
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/users",
        json={"username": "second-op", "password": "pw123456", "role": "contributor", "identifier": "@VICTOR"},
        headers=admin_headers,
    )
    assert second.status_code == 409


def test_production_seed_path_ships_the_real_r2_roster(monkeypatch):
    """11_PERSONNEL/ (the repo-root directory) now ships the real, sourced
    66-identity roster from the AI Training Academy R2.0 Canonical Identity,
    Role Governance & Production Control Manual (see
    11_PERSONNEL/Personnel_Roster.md), not synthetic data, and is no longer
    empty. Every seeded row still starts production_verification_state ==
    "unverified" regardless of source (seeding has no acting admin/verifier —
    matches the source manual's own G1-G8 HOLD disposition).

    seed.SEED_PERSONNEL_DIR already resolves correctly to the real roster
    inside the deployed docker container (docker-compose.yml volume-mounts
    ./11_PERSONNEL:/app/seed_personnel:ro), but on a bare checkout -- e.g.
    CI's validate job, which runs pytest directly with no Docker involved --
    it's a directory that doesn't exist at all. A fixed ancestor-count
    (parents[N]) isn't safe here either: it'd assume the on-disk layout
    always mirrors the git repo's directory depth, which Docker's own
    backend-only bind mount already violates. So this checks the unpatched
    SEED_PERSONNEL_DIR first, and only if that comes up empty, walks upward
    from this test file looking for a real 11_PERSONNEL/ sibling directory.
    """
    real_roster_dir = seed.SEED_PERSONNEL_DIR
    if not (real_roster_dir / "personnel_roster.csv").exists():
        for ancestor in Path(__file__).resolve().parents:
            candidate = ancestor / "11_PERSONNEL"
            if (candidate / "personnel_roster.csv").exists():
                real_roster_dir = candidate
                break
    assert (real_roster_dir / "personnel_roster.csv").exists(), (
        "11_PERSONNEL/personnel_roster.csv must exist — see Personnel_Roster.md"
    )
    monkeypatch.setattr(seed, "SEED_PERSONNEL_DIR", real_roster_dir)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = Session()
    seed.seed_if_empty(db)

    members = db.execute(select(orm.ServiceMember)).scalars().all()
    assert len(members) == 66
    assert all(m.production_verification_state == "unverified" for m in members)
    assert all("Canonical Identity, Role Governance" in (m.source_lineage or "") for m in members)

    victor = db.get(orm.ServiceMember, "ATA-VICTOR-000")
    trooper_victor = db.get(orm.ServiceMember, "ATA-TROOPER_VICTOR-000")
    assert victor is not None
    assert trooper_victor is not None
    assert victor.service_member_id != trooper_victor.service_member_id

    cindy = db.get(orm.ServiceMember, "ATA-CINDY-000")
    assert cindy is not None
    assert cindy.role_version == 2
    assert "People Operations" in cindy.current_role

    mape = db.get(orm.ServiceMember, "ATA-MAPE-000")
    assert mape is not None
    assert mape.role_version == 2
    assert "Program Management" in mape.current_role

    admin = db.execute(select(orm.User).where(orm.User.username == "admin")).scalar_one()
    assert admin.service_member_id == "ATA-ATLAS-000"
    db.close()


def test_seed_ignores_a_verified_claim_in_the_roster_csv(tmp_path, monkeypatch):
    """Seeding has no acting admin, no verifier, and no separation-of-duties
    check to run — so it must never be able to produce a "verified" identity,
    even if a CSV column says so. Every seeded row starts unverified; real
    verification only happens through POST /{id}/verify after boot."""
    seed_dir = tmp_path / "seed_personnel"
    seed_dir.mkdir()
    (seed_dir / "personnel_roster.csv").write_text(
        "service_member_id,callsign_id,callsign,display_name,member_class,current_role,"
        "command_layer,lifecycle_state,readiness_state,production_verification_state,"
        "legacy_alias,source_lineage\n"
        "ATA-CLAIM-000,ATA-SM-CLAIM-001,@CLAIM,Claims Verified,human_trooper,Some Role,"
        "command,active,ready,verified,,test fixture attempting to bypass the verify endpoint\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(seed, "SEED_PERSONNEL_DIR", seed_dir)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = Session()
    seed._seed_personnel(db)

    member = db.get(orm.ServiceMember, "ATA-CLAIM-000")
    assert member is not None
    assert member.production_verification_state == "unverified"
    db.close()


def test_seed_personnel_is_idempotent_and_produces_exactly_sixty_six_identities(monkeypatch):
    monkeypatch.setattr(seed, "SEED_PERSONNEL_DIR", SYNTHETIC_PERSONNEL_FIXTURES_DIR)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = Session()
    seed._seed_personnel(db)
    seed._seed_personnel(db)  # idempotency: must not double-insert or duplicate history

    members = db.execute(select(orm.ServiceMember)).scalars().all()
    assert len(members) == 66

    victor = db.get(orm.ServiceMember, "ATA-VICTOR-000")
    trooper_victor = db.get(orm.ServiceMember, "ATA-TROOPER_VICTOR-000")
    assert victor is not None
    assert trooper_victor is not None
    assert victor.callsign == "@VICTOR"
    assert trooper_victor.callsign == "@TROOPER_VICTOR"

    cindy = db.get(orm.ServiceMember, "ATA-CINDY-000")
    mape = db.get(orm.ServiceMember, "ATA-MAPE-000")
    assert cindy.role_version == 2
    assert mape.role_version == 3

    cindy_history = (
        db.execute(
            select(orm.RoleAssignmentHistory)
            .where(orm.RoleAssignmentHistory.service_member_id == "ATA-CINDY-000")
            .order_by(orm.RoleAssignmentHistory.role_version)
        )
        .scalars()
        .all()
    )
    assert [row.role_version for row in cindy_history] == [1, 2]

    mape_history = (
        db.execute(
            select(orm.RoleAssignmentHistory)
            .where(orm.RoleAssignmentHistory.service_member_id == "ATA-MAPE-000")
            .order_by(orm.RoleAssignmentHistory.role_version)
        )
        .scalars()
        .all()
    )
    assert [row.role_version for row in mape_history] == [1, 2, 3]

    legacy_aliases = {m.legacy_alias for m in members}
    assert legacy_aliases == {f"ATA-SM-{i:03d}" for i in range(1, 67)}

    db.close()


def test_seed_admin_user_links_to_atlas_when_personnel_is_seeded(monkeypatch):
    monkeypatch.setattr(seed, "SEED_PERSONNEL_DIR", SYNTHETIC_PERSONNEL_FIXTURES_DIR)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = Session()
    seed.seed_if_empty(db)

    admin = db.execute(select(orm.User).where(orm.User.username == "admin")).scalar_one()
    assert admin.service_member_id == "ATA-ATLAS-000"
    db.close()


def test_import_survives_a_ragged_row_with_extra_trailing_columns(client, admin_headers):
    """csv.DictReader stashes fields past the header under a `None` key; an
    earlier version of the shared parse_csv_rows() unpacked that straight
    into `**row`, which raises TypeError (not the ValidationError callers
    catch) and 500s the whole import instead of skipping just the bad row.
    A well-formed row must still import even when a later row is ragged."""
    header = "service_member_id,callsign_id,callsign,display_name,member_class,command_layer,current_role,legacy_alias"
    good_row = "ATA-VICTOR-000,ATA-SM-VICTOR-001,@VICTOR,Priya Moreno,human_trooper,support,Support Technician,ATA-SM-023"
    ragged_row = (
        "ATA-MAPE-000,ATA-SM-MAPE-001,@MAPE,Dana Cole,human_trooper,field_operations,Field Lead,"
        "ATA-SM-024,unexpected-extra-field"
    )
    csv_content = f"{header}\n{good_row}\n{ragged_row}\n"

    response = client.post(
        "/v1/service-members/import",
        files={"file": ("members.csv", csv_content, "text/csv")},
        headers=admin_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 2
    assert body["skipped"] == []

    fetched = client.get("/v1/service-members/resolve", params={"identifier": "@MAPE"})
    assert fetched.status_code == 200
    assert fetched.json()["display_name"] == "Dana Cole"


def test_seed_backfills_admin_link_on_an_already_provisioned_deployment(monkeypatch):
    """Simulates a Postgres volume that already had an `admin` user (e.g.
    provisioned before personnel seeding existed) — the retrofit link must
    still apply, not just fresh installs."""
    monkeypatch.setattr(seed, "SEED_PERSONNEL_DIR", SYNTHETIC_PERSONNEL_FIXTURES_DIR)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = Session()
    db.add(orm.User(username="admin", password_hash=hash_password("admin"), role="admin"))
    db.commit()

    seed.seed_if_empty(db)

    admin = db.execute(select(orm.User).where(orm.User.username == "admin")).scalar_one()
    assert admin.service_member_id == "ATA-ATLAS-000"
    assert db.execute(select(orm.ServiceMember)).scalars().all()
    db.close()
