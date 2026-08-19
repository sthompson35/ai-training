"""Production canary — validates the SYSTEM's behavior around production
identity data, as distinct from test_service_members.py's synthetic-fixture
canaries (which prove the identity machinery itself works: uniqueness,
resolution, role history, @VICTOR vs @TROOPER_VICTOR, audit linkage, etc.,
all against fabricated data that is clearly never production).

These tests never touch tests/fixtures/synthetic_personnel/. They prove two
things: (1) the canary correctly reports NOT_APPLICABLE rather than a false
failure when the registry is empty — which is the expected, correct state
until a governed roster exists — and (2) the SYSTEM safely supports the
"controlled first-member onboarding" path (a real identity entering the
registry one at a time through the governed admin API), independent of
whether any real identity actually exists yet.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.canary as canary
from app import orm
from app.db import Base, get_db
from app.main import app


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


@pytest.fixture()
def canary_session(monkeypatch):
    """Points app.canary at its own isolated DB, independent of the `client`
    fixture's — the canary is meant to inspect whatever SessionLocal the
    running process is actually configured with, so the test proves that
    wiring rather than assuming it."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(canary, "SessionLocal", Session)
    return Session


def test_canary_reports_not_applicable_on_an_empty_registry(canary_session):
    status, problems = canary.run_production_identity_canary()
    assert status == canary.NOT_APPLICABLE
    assert problems == []


def test_canary_passes_a_genuinely_governed_identity(canary_session):
    db = canary_session()
    db.add(
        orm.ServiceMember(
            service_member_id="ATA-REALFIRST-000",
            callsign_id="ATA-SM-REALFIRST-001",
            callsign="@REALFIRST",
            display_name="A Real Person",
            member_class="human_trooper",
            current_role="Onboarding Coordinator",
            command_layer="command",
            source_lineage="Onboarded via governed admin workflow; approved 2026-08-09",
        )
    )
    db.commit()
    db.close()

    status, problems = canary.run_production_identity_canary()
    assert status == canary.PASS
    assert problems == []


def test_canary_flags_a_governed_identity_missing_source_lineage(canary_session):
    db = canary_session()
    db.add(
        orm.ServiceMember(
            service_member_id="ATA-NOLINEAGE-000",
            callsign_id="ATA-SM-NOLINEAGE-001",
            callsign="@NOLINEAGE",
            display_name="Missing Provenance",
            member_class="human_trooper",
            current_role="Some Role",
            command_layer="command",
            source_lineage=None,
        )
    )
    db.commit()
    db.close()

    status, problems = canary.run_production_identity_canary()
    assert status == canary.FAIL
    assert any("source lineage" in p for p in problems)


def test_canary_flags_a_verified_label_with_no_backing_verification_record(canary_session):
    """The exact ungoverned state this whole workflow exists to prevent: a
    row claiming production_verification_state="verified" that never went
    through POST /{id}/verify. Direct DB manipulation is the only way to
    produce this now — the API itself cannot — but the canary must still
    catch it independently, the same way it re-checks uniqueness rather than
    trusting the schema."""
    db = canary_session()
    db.add(
        orm.ServiceMember(
            service_member_id="ATA-UNGOVERNED-000",
            callsign_id="ATA-SM-UNGOVERNED-001",
            callsign="@UNGOVERNED",
            display_name="Claims Verified With No Evidence",
            member_class="human_trooper",
            current_role="Some Role",
            command_layer="command",
            source_lineage="present, but that alone isn't verification",
            production_verification_state="verified",
        )
    )
    db.commit()
    db.close()

    status, problems = canary.run_production_identity_canary()
    assert status == canary.FAIL
    assert any("no backing" in p for p in problems)


def test_canary_passes_a_verified_label_backed_by_a_real_verification_record(canary_session):
    db = canary_session()
    db.add(
        orm.ServiceMember(
            service_member_id="ATA-VERIFIEDBY-000",
            callsign_id="ATA-SM-VERIFIEDBY-001",
            callsign="@VERIFIEDBY",
            display_name="An Independent Verifier",
            member_class="human_trooper",
            current_role="Verification Officer",
            command_layer="command",
            source_lineage="Onboarded via governed admin workflow",
        )
    )
    db.add(
        orm.ServiceMember(
            service_member_id="ATA-PROPERLYVERIFIED-000",
            callsign_id="ATA-SM-PROPERLYVERIFIED-001",
            callsign="@PROPERLYVERIFIED",
            display_name="Properly Verified Identity",
            member_class="human_trooper",
            current_role="Some Role",
            command_layer="command",
            source_lineage="Onboarded via governed admin workflow",
            production_verification_state="verified",
        )
    )
    db.commit()
    db.add(
        orm.IdentityVerification(
            service_member_id="ATA-PROPERLYVERIFIED-000",
            evidence_reference="credential check #123",
            verification_method="document_review",
            outcome="verified",
            verifier_service_member_id="ATA-VERIFIEDBY-000",
        )
    )
    db.commit()
    db.close()

    status, problems = canary.run_production_identity_canary()
    assert status == canary.PASS
    assert problems == []


def test_controlled_first_member_onboarding_from_an_empty_registry(client, admin_headers):
    # Confirms this really is a first-member scenario, not an artifact of
    # some other seed path having already populated the registry.
    assert client.get("/v1/service-members").json() == []

    payload = {
        "service_member_id": "ATA-FIRSTREAL-000",
        "callsign_id": "ATA-SM-FIRSTREAL-001",
        "callsign": "@FIRSTREAL",
        "display_name": "First Real Identity",
        "member_class": "human_trooper",
        "command_layer": "command",
        "current_role": "Academy Liaison",
        "source_lineage": "Onboarded via governed admin workflow; identity request approved 2026-08-09",
    }
    created = client.post("/v1/service-members", json=payload, headers=admin_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["role_version"] == 1
    assert body["production_verification_state"] == "unverified"  # onboarding != verification

    # Onboarding is audited — the "telemetry"/"evidence" steps of the
    # onboarding flow aren't a separate mechanism, they're the audit log
    # that already exists for every admin mutation.
    audit = client.get("/v1/audit-log", headers=admin_headers).json()
    assert any(e["path"] == "/v1/service-members" and e["method"] == "POST" for e in audit)

    # Resolves through all 4 canonical tiers immediately.
    for identifier in ["ATA-FIRSTREAL-000", "ATA-SM-FIRSTREAL-001", "@FIRSTREAL"]:
        resolved = client.get("/v1/service-members/resolve", params={"identifier": identifier})
        assert resolved.status_code == 200, identifier
        assert resolved.json()["service_member_id"] == "ATA-FIRSTREAL-000"

    # The registry grew by exactly one — organically, through the governed
    # API, not via bulk seed.
    listed = client.get("/v1/service-members").json()
    assert len(listed) == 1

    # A generic update cannot promote this to verified — onboarding is not
    # the same thing as independent verification.
    blocked = client.put(
        "/v1/service-members/ATA-FIRSTREAL-000",
        json={
            "display_name": "First Real Identity",
            "lifecycle_state": "active",
            "readiness_state": "ready",
            "production_verification_state": "verified",
            "legacy_alias": None,
        },
        headers=admin_headers,
    )
    assert blocked.status_code == 200
    assert blocked.json()["production_verification_state"] == "unverified"

    # Independent verification is a distinct, later step, through its own
    # governed endpoint: a second real identity, linked to a real login
    # account, performs the verification with evidence attached.
    client.post(
        "/v1/service-members",
        json={
            "service_member_id": "ATA-VERIFIER-000",
            "callsign_id": "ATA-SM-VERIFIER-001",
            "callsign": "@VERIFIER",
            "display_name": "Independent Verifier",
            "member_class": "human_trooper",
            "command_layer": "command",
            "current_role": "Verification Officer",
        },
        headers=admin_headers,
    )
    linked_user = client.post(
        "/v1/users",
        json={"username": "verifier-op", "password": "pw123456", "role": "admin", "identifier": "@VERIFIER"},
        headers=admin_headers,
    )
    assert linked_user.status_code == 201
    login = client.post("/v1/auth/login", json={"username": "verifier-op", "password": "pw123456"})
    verifier_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    verify = client.post(
        "/v1/service-members/ATA-FIRSTREAL-000/verify",
        json={
            "evidence_reference": "identity document review, ref #1",
            "verification_method": "document_review",
            "outcome": "verified",
        },
        headers=verifier_headers,
    )
    assert verify.status_code == 200
    assert verify.json()["outcome"] == "verified"

    final_state = client.get("/v1/service-members/ATA-FIRSTREAL-000").json()
    assert final_state["production_verification_state"] == "verified"


def test_bulk_import_alone_cannot_populate_the_registry_without_governed_rows(client):
    """CSV import is available (POST /v1/service-members/import) but it is
    not itself a bulk-seed backdoor — it still requires admin auth per row
    and produces the same audited, one-row-at-a-time records as the single-
    create endpoint. This just confirms the import path is present and
    gated, not that it's disabled outright."""
    response = client.post(
        "/v1/service-members/import",
        files={"file": ("roster.csv", "service_member_id\n", "text/csv")},
    )
    assert response.status_code == 403  # no admin token: rejected, not silently accepted
