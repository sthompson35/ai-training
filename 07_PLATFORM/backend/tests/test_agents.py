import csv
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

TEST_IDENTITY_PAYLOAD = {
    "service_member_id": "ATA-TESTOWNER-000",
    "callsign_id": "ATA-SM-TESTOWNER-001",
    "callsign": "@TESTOWNER",
    "display_name": "Test Owner",
    "member_class": "human_trooper",
    "command_layer": "support",
    "current_role": "Test Role",
}


def to_csv(payload: dict) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(payload.keys()))
    writer.writeheader()
    writer.writerow(payload)
    return buffer.getvalue()


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


@pytest.fixture(autouse=True)
def _seed_test_identity(client, admin_headers):
    response = client.post("/v1/service-members", json=TEST_IDENTITY_PAYLOAD, headers=admin_headers)
    assert response.status_code == 201


def agent_payload(**overrides):
    payload = {
        "name": "Support Triage Agent",
        "owner": "@TESTOWNER",
        "version": "1.0",
        "purpose": "Triage inbound tickets",
        "non_goals": "Does not issue refunds",
        "risk_tier": 2,
        "approved_models": "gpt-mini",
        "approved_tools": "ticket-search",
        "data_access": "ticket metadata only",
        "action_permissions": "read-only",
        "approval_requirements": "tier-2 approval for escalation",
        "budgets": "1000 tokens/request",
        "fallback": "route to human queue",
        "monitoring": "latency + error rate dashboard",
        "kill_switch": "feature flag SUPPORT_TRIAGE_AGENT_ENABLED",
        "active": True,
        "approval_status": "draft",
        "evaluation_set": "support-eval-v1",
        "last_review": "2026-01-01",
    }
    payload.update(overrides)
    return payload


def test_import_agents_smoke(client, auth_headers):
    payload = agent_payload(name="Imported Agent")
    csv_content = to_csv(payload)

    response = client.post(
        "/v1/agents/import", files={"file": ("agents.csv", csv_content, "text/csv")}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1


def test_bulk_delete_agents_smoke(client, auth_headers):
    agent = client.post("/v1/agents", json=agent_payload(), headers=auth_headers).json()

    response = client.post(
        "/v1/agents/bulk-delete", json={"ids": [agent["id"], 999999]}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert len(response.json()["skipped"]) == 1


def test_export_agents_returns_csv(client, auth_headers):
    client.post("/v1/agents", json=agent_payload(), headers=auth_headers)

    response = client.get("/v1/agents/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "Support Triage Agent" in response.text


def test_agent_crud_roundtrip(client, auth_headers):
    create = client.post("/v1/agents", json=agent_payload(), headers=auth_headers)
    assert create.status_code == 201
    agent = create.json()
    assert agent["active"] is True
    assert agent["approval_status"] == "draft"

    duplicate = client.post("/v1/agents", json=agent_payload(), headers=auth_headers)
    assert duplicate.status_code == 409

    listed = client.get("/v1/agents")
    assert len(listed.json()) == 1

    kill = client.put(
        f"/v1/agents/{agent['id']}",
        json=agent_payload(active=False, approval_status="approved"),
        headers=auth_headers,
    )
    assert kill.status_code == 200
    assert kill.json()["active"] is False
    assert kill.json()["approval_status"] == "approved"

    delete = client.delete(f"/v1/agents/{agent['id']}", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get(f"/v1/agents/{agent['id']}").status_code == 404


def test_agents_pagination_and_search(client, auth_headers):
    for name in ["Support Triage Agent", "Refund Review Agent", "Compliance Scan Agent"]:
        client.post("/v1/agents", json=agent_payload(name=name), headers=auth_headers)

    page = client.get("/v1/agents", params={"limit": 1})
    assert page.status_code == 200
    assert len(page.json()) == 1
    assert page.headers["x-total-count"] == "3"

    page2 = client.get("/v1/agents", params={"limit": 1, "offset": 1})
    assert page2.json()[0]["name"] != page.json()[0]["name"]

    search = client.get("/v1/agents", params={"q": "refund"})
    assert len(search.json()) == 1
    assert search.json()[0]["name"] == "Refund Review Agent"


def test_execute_blocked_when_kill_switch_engaged(client, auth_headers):
    agent = client.post("/v1/agents", json=agent_payload(active=False), headers=auth_headers).json()
    response = client.post(f"/v1/agents/{agent['id']}/execute", json={"prompt": "hello"}, headers=auth_headers)
    assert response.status_code == 409
    assert "kill switch" in response.json()["detail"]


def test_execute_rejects_a_model_not_in_approved_models(client, auth_headers):
    agent = client.post(
        "/v1/agents", json=agent_payload(risk_tier=0, approved_models="gpt-mini, gpt-large"), headers=auth_headers
    ).json()
    response = client.post(
        f"/v1/agents/{agent['id']}/execute",
        json={"prompt": "hello", "model": "not-approved"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert "not-approved" in response.json()["detail"]


def test_execute_high_risk_creates_a_pending_approval_without_calling_inference(client, auth_headers, monkeypatch):
    called = []
    monkeypatch.setattr("app.agents.inference.call_local_model", lambda **kw: called.append(kw))

    agent = client.post("/v1/agents", json=agent_payload(risk_tier=2), headers=auth_headers).json()
    response = client.post(f"/v1/agents/{agent['id']}/execute", json={"prompt": "hello"}, headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending_approval"
    assert body["approval_request_id"] is not None
    assert body["output"] is None
    assert called == []  # inference must never be attempted while gated


def test_execute_low_risk_calls_the_local_model_and_defaults_to_the_first_approved_model(
    client, auth_headers, monkeypatch
):
    monkeypatch.setattr(
        "app.agents.inference.call_local_model",
        lambda model, prompt, **kw: {"output": f"[{model}] handled: {prompt}", "prompt_tokens": 7, "completion_tokens": 3},
    )

    agent = client.post(
        "/v1/agents", json=agent_payload(risk_tier=0, approved_models="gpt-mini, gpt-large"), headers=auth_headers
    ).json()
    response = client.post(
        f"/v1/agents/{agent['id']}/execute", json={"prompt": "triage this ticket"}, headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["model"] == "gpt-mini"  # first entry, since no model was requested
    assert body["output"] == "[gpt-mini] handled: triage this ticket"
    assert body["prompt_tokens"] == 7
    assert body["completion_tokens"] == 3
    assert body["estimated_cost_usd"] > 0


def test_execute_reports_a_misconfigured_approval_tier_clearly(client, auth_headers, monkeypatch):
    monkeypatch.setenv("REQUIRE_HUMAN_APPROVAL_TIER", "not-a-number")
    agent = client.post("/v1/agents", json=agent_payload(risk_tier=0), headers=auth_headers).json()

    response = client.post(f"/v1/agents/{agent['id']}/execute", json={"prompt": "hello"}, headers=auth_headers)

    assert response.status_code == 500
    assert "REQUIRE_HUMAN_APPROVAL_TIER" in response.json()["detail"]


def test_execute_surfaces_inference_failures_as_502(client, auth_headers, monkeypatch):
    from app.inference import InferenceError

    def raise_error(**kw):
        raise InferenceError("local inference server unreachable")

    monkeypatch.setattr("app.agents.inference.call_local_model", raise_error)

    agent = client.post("/v1/agents", json=agent_payload(risk_tier=0), headers=auth_headers).json()
    response = client.post(f"/v1/agents/{agent['id']}/execute", json={"prompt": "hello"}, headers=auth_headers)

    assert response.status_code == 502
    assert "unreachable" in response.json()["detail"]


def test_execute_approved_request_bypasses_the_gate_on_retry(client, auth_headers, admin_headers, monkeypatch):
    monkeypatch.setattr(
        "app.agents.inference.call_local_model",
        lambda model, prompt, **kw: {"output": "done", "prompt_tokens": 1, "completion_tokens": 1},
    )

    agent = client.post("/v1/agents", json=agent_payload(risk_tier=2), headers=auth_headers).json()
    gated = client.post(f"/v1/agents/{agent['id']}/execute", json={"prompt": "hello"}, headers=auth_headers).json()
    approval_id = gated["approval_request_id"]

    client.post(f"/v1/policy/approvals/{approval_id}/approve", json={"note": "ok"}, headers=admin_headers)

    retried = client.post(
        f"/v1/agents/{agent['id']}/execute",
        json={"prompt": "hello", "approval_request_id": approval_id},
        headers=auth_headers,
    )
    assert retried.status_code == 200
    assert retried.json()["status"] == "completed"
    assert retried.json()["output"] == "done"
