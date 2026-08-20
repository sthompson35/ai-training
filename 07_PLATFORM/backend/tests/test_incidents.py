import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app import orm

TEST_IDENTITY_PAYLOAD = {
    "service_member_id": "ATA-TESTOWNER-000",
    "callsign_id": "ATA-SM-TESTOWNER-001",
    "callsign": "@TESTOWNER",
    "display_name": "Test Owner",
    "member_class": "human_trooper",
    "command_layer": "support",
    "current_role": "Test Role",
}


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

    db = TestingSession()
    db.add(
        orm.ServiceMember(
            service_member_id="ATA-AGENTOWNER-000",
            callsign_id="ATA-SM-AGENTOWNER-001",
            callsign="@AGENTOWNER",
            display_name="Agent Card Owner",
            member_class="human_trooper",
            command_layer="support",
            current_role="Support Engineer",
        )
    )
    db.flush()
    db.add(
        orm.AgentCard(
            id=1,
            name="Support Triage Agent",
            owner_service_member_id="ATA-AGENTOWNER-000",
            version="1.0",
            purpose="p",
            non_goals="n",
            risk_tier=2,
            approved_models="m",
            approved_tools="t",
            data_access="d",
            action_permissions="a",
            approval_requirements="r",
            budgets="b",
            fallback="f",
            monitoring="m",
            kill_switch="flag",
            active=True,
            approval_status="approved",
            evaluation_set="e",
            last_review="2026-01-01",
        )
    )
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _seed_test_identity(client, admin_headers):
    response = client.post("/v1/service-members", json=TEST_IDENTITY_PAYLOAD, headers=admin_headers)
    assert response.status_code == 201


def incident_payload(**overrides):
    payload = {
        "title": "Agent produced hallucinated refund policy",
        "severity": "high",
        "status": "detected",
        "description": "Agent told a user a refund was approved when it was not.",
        "impact": "One customer received incorrect information; no financial loss.",
        "owner": "@TESTOWNER",
        "agent_id": None,
    }
    payload.update(overrides)
    return payload


def test_list_incidents_starts_empty(client):
    response = client.get("/v1/incidents")
    assert response.status_code == 200
    assert response.json() == []


def test_incident_requires_auth(client):
    response = client.post("/v1/incidents", json=incident_payload())
    assert response.status_code == 403


def test_incident_rejects_unknown_agent(client, auth_headers):
    response = client.post(
        "/v1/incidents", json=incident_payload(agent_id=999), headers=auth_headers
    )
    assert response.status_code == 422


def release_payload(**overrides):
    payload = {
        "title": "Add refusal instruction for refund policy questions",
        "version": "2.1.0",
        "rationale": "Prevent the agent from inventing refund approvals.",
        "expected_impact": "Fewer incorrect refund statements to customers.",
        "test_evidence": "Regression suite covering the incident's reproduction case, all passing.",
        "approver": "@TESTOWNER",
        "risk_tier": 2,
        "release_date": "2026-02-01",
        "rollback_target": "prompt v2.0.3",
        "status": "proposed",
    }
    payload.update(overrides)
    return payload


def test_incident_rejects_unknown_release(client, auth_headers):
    response = client.post(
        "/v1/incidents", json=incident_payload(release_id=999), headers=auth_headers
    )
    assert response.status_code == 422


def test_incident_links_to_a_release(client, auth_headers):
    release = client.post("/v1/releases", json=release_payload(), headers=auth_headers).json()

    created = client.post(
        "/v1/incidents", json=incident_payload(release_id=release["id"]), headers=auth_headers
    )
    assert created.status_code == 201
    assert created.json()["release_id"] == release["id"]

    update = client.put(
        f"/v1/incidents/{created.json()['id']}",
        json=incident_payload(release_id=release["id"], capa_status="in_progress"),
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["capa_status"] == "in_progress"


def test_incidents_filter_by_release_id(client, auth_headers):
    release_a = client.post("/v1/releases", json=release_payload(), headers=auth_headers).json()
    release_b = client.post(
        "/v1/releases", json=release_payload(title="Second release", version="2.2.0"), headers=auth_headers
    ).json()

    client.post(
        "/v1/incidents",
        json=incident_payload(title="Caused by release A", release_id=release_a["id"]),
        headers=auth_headers,
    )
    client.post(
        "/v1/incidents",
        json=incident_payload(title="Caused by release B", release_id=release_b["id"]),
        headers=auth_headers,
    )

    filtered = client.get("/v1/incidents", params={"release_id": release_a["id"]})
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["title"] == "Caused by release A"


def test_import_incidents_reports_unknown_release_id(client, auth_headers):
    csv_content = (
        "title,severity,status,description,impact,owner,release_id\n"
        "Unknown release row,low,detected,Long enough description,Long enough impact,@TESTOWNER,999\n"
    )
    response = client.post(
        "/v1/incidents/import",
        files={"file": ("incidents.csv", csv_content, "text/csv")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 0
    assert "Unknown release_id" in body["skipped"][0]["reason"]


def test_bulk_update_incident_capa_status_requires_auth(client):
    response = client.post(
        "/v1/incidents/bulk-update-capa-status", json={"ids": [1], "capa_status": "verified"}
    )
    assert response.status_code == 403


def test_bulk_update_incident_capa_status_updates_and_reports_not_found(client, auth_headers):
    first = client.post("/v1/incidents", json=incident_payload(), headers=auth_headers).json()
    second = client.post(
        "/v1/incidents", json=incident_payload(title="Second incident"), headers=auth_headers
    ).json()

    response = client.post(
        "/v1/incidents/bulk-update-capa-status",
        json={"ids": [first["id"], second["id"], 999999], "capa_status": "verified"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 2
    assert body["skipped"] == [{"id": "999999", "reason": "Not found"}]

    assert client.get(f"/v1/incidents/{first['id']}").json()["capa_status"] == "verified"


def test_incident_crud_roundtrip(client, auth_headers):
    create = client.post(
        "/v1/incidents", json=incident_payload(agent_id=1), headers=auth_headers
    )
    assert create.status_code == 201
    incident = create.json()
    assert incident["agent_id"] == 1
    assert incident["status"] == "detected"

    listed = client.get("/v1/incidents", params={"severity": "high"})
    assert len(listed.json()) == 1

    update = client.put(
        f"/v1/incidents/{incident['id']}",
        json=incident_payload(
            agent_id=1,
            status="resolved",
            root_cause="Prompt lacked a refusal instruction for policy questions.",
            corrective_action="Added refusal instruction and regression test.",
            resolved_at="2026-01-02",
        ),
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["status"] == "resolved"
    assert update.json()["resolved_at"] == "2026-01-02"

    delete = client.delete(f"/v1/incidents/{incident['id']}", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get(f"/v1/incidents/{incident['id']}").status_code == 404


def test_export_incidents_filters_like_the_list_endpoint(client, auth_headers):
    client.post(
        "/v1/incidents", json=incident_payload(title="High severity incident", severity="high"), headers=auth_headers
    )
    client.post(
        "/v1/incidents", json=incident_payload(title="Low severity incident", severity="low"), headers=auth_headers
    )

    response = client.get("/v1/incidents/export", params={"severity": "high"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]

    lines = response.text.strip().splitlines()
    assert "id" in lines[0].split(",")
    assert len(lines) == 2
    assert "High severity incident" in response.text
    assert "Low severity incident" not in response.text


def test_bulk_delete_incidents_smoke(client, auth_headers):
    incident = client.post("/v1/incidents", json=incident_payload(), headers=auth_headers).json()

    response = client.post(
        "/v1/incidents/bulk-delete", json={"ids": [incident["id"], 999999]}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert len(response.json()["skipped"]) == 1


def test_bulk_update_incident_status_requires_auth(client):
    response = client.post("/v1/incidents/bulk-update-status", json={"ids": [1], "status": "resolved"})
    assert response.status_code == 403


def test_bulk_update_incident_status_updates_and_reports_not_found(client, auth_headers):
    first = client.post("/v1/incidents", json=incident_payload(), headers=auth_headers).json()
    second = client.post("/v1/incidents", json=incident_payload(title="Second incident"), headers=auth_headers).json()

    response = client.post(
        "/v1/incidents/bulk-update-status",
        json={"ids": [first["id"], second["id"], 999999], "status": "resolved"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 2
    assert body["skipped"] == [{"id": "999999", "reason": "Not found"}]

    assert client.get(f"/v1/incidents/{first['id']}").json()["status"] == "resolved"
    assert client.get(f"/v1/incidents/{second['id']}").json()["status"] == "resolved"


def test_bulk_update_incident_status_rejects_invalid_status(client, auth_headers):
    incident = client.post("/v1/incidents", json=incident_payload(), headers=auth_headers).json()

    response = client.post(
        "/v1/incidents/bulk-update-status",
        json={"ids": [incident["id"]], "status": "not-a-real-status"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_import_incidents_reports_created_and_skipped_rows(client, auth_headers):
    csv_content = (
        "title,severity,status,description,impact,owner,agent_id\n"
        "Valid incident via import,high,detected,Long enough description,Long enough impact,@TESTOWNER,1\n"
        "Invalid row missing description,high,detected,,Long enough impact,@TESTOWNER,\n"
        "Unknown agent row,low,detected,Long enough description,Long enough impact,@TESTOWNER,999\n"
    )
    response = client.post(
        "/v1/incidents/import",
        files={"file": ("incidents.csv", csv_content, "text/csv")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert len(body["skipped"]) == 2
    assert body["skipped"][0]["row"] == 3
    assert body["skipped"][1]["row"] == 4
    assert "Unknown agent_id" in body["skipped"][1]["reason"]

    listed = client.get("/v1/incidents").json()
    assert len(listed) == 1
    assert listed[0]["title"] == "Valid incident via import"


def test_incidents_pagination_and_search(client, auth_headers):
    for title in [
        "Agent produced hallucinated refund policy",
        "Prompt injection bypassed tool allowlist",
        "Latency spike on routing endpoint",
    ]:
        client.post("/v1/incidents", json=incident_payload(title=title), headers=auth_headers)

    page = client.get("/v1/incidents", params={"limit": 1})
    assert page.status_code == 200
    assert len(page.json()) == 1
    assert page.headers["x-total-count"] == "3"

    search = client.get("/v1/incidents", params={"q": "injection"})
    assert len(search.json()) == 1
    assert search.json()[0]["title"] == "Prompt injection bypassed tool allowlist"
