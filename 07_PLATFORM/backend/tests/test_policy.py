import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.db import Base, get_db
from app.main import app
from app import orm


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
    db.add(orm.User(username="admin", password_hash=hash_password("admin"), role="admin"))
    db.add(orm.User(username="contributor", password_hash=hash_password("pw"), role="contributor"))
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def login(client, username, password):
    response = client.post("/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def admin_headers(client):
    return login(client, "admin", "admin")


@pytest.fixture()
def contributor_headers(client):
    return login(client, "contributor", "pw")


HIGH_RISK_PAYLOAD = {
    "task_type": "research",
    "input_chars": 2000,
    "requires_current_data": True,
    "risk_tier": 4,
}

LOW_RISK_PAYLOAD = {
    "task_type": "research",
    "input_chars": 2000,
    "requires_current_data": True,
    "risk_tier": 1,
}


def test_low_risk_route_is_unaffected_by_the_gate(client):
    response = client.post("/v1/route", json=LOW_RISK_PAYLOAD)
    body = response.json()
    assert body["route"] == "server"
    assert body["approval_request_id"] is None
    assert body["estimated_cost_usd"] > 0


def test_high_risk_route_creates_a_pending_approval_instead_of_executing(client):
    response = client.post("/v1/route", json=HIGH_RISK_PAYLOAD)
    body = response.json()
    assert body["route"] == "pending_approval"
    assert body["approval_request_id"] is not None
    assert body["estimated_cost_usd"] == 0


def test_approvals_endpoints_require_admin(client, contributor_headers):
    assert client.get("/v1/policy/approvals").status_code == 403
    assert client.get("/v1/policy/approvals", headers=contributor_headers).status_code == 403
    assert (
        client.post("/v1/policy/approvals/1/approve", json={}, headers=contributor_headers).status_code == 403
    )


def test_full_approval_loop_lets_the_original_request_proceed(client, admin_headers):
    gated = client.post("/v1/route", json=HIGH_RISK_PAYLOAD).json()
    approval_id = gated["approval_request_id"]

    pending_list = client.get("/v1/policy/approvals?status=pending", headers=admin_headers).json()
    assert any(item["id"] == approval_id for item in pending_list)

    approved = client.post(
        f"/v1/policy/approvals/{approval_id}/approve", json={"note": "looks fine"}, headers=admin_headers
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["decided_by"] == "admin"

    bypassed = client.post(
        "/v1/route", json={**HIGH_RISK_PAYLOAD, "approval_request_id": approval_id}
    ).json()
    assert bypassed["route"] == "server"
    assert bypassed["estimated_cost_usd"] > 0
    assert bypassed["approval_request_id"] is None


def test_rejected_approval_id_does_not_bypass_the_gate(client, admin_headers):
    gated = client.post("/v1/route", json=HIGH_RISK_PAYLOAD).json()
    approval_id = gated["approval_request_id"]

    client.post(f"/v1/policy/approvals/{approval_id}/reject", json={}, headers=admin_headers)

    retried = client.post(
        "/v1/route", json={**HIGH_RISK_PAYLOAD, "approval_request_id": approval_id}
    ).json()
    assert retried["route"] == "pending_approval"
    assert retried["approval_request_id"] != approval_id


def test_cannot_decide_an_already_decided_approval(client, admin_headers):
    gated = client.post("/v1/route", json=HIGH_RISK_PAYLOAD).json()
    approval_id = gated["approval_request_id"]

    client.post(f"/v1/policy/approvals/{approval_id}/approve", json={}, headers=admin_headers)
    second = client.post(f"/v1/policy/approvals/{approval_id}/approve", json={}, headers=admin_headers)
    assert second.status_code == 409


def test_policy_config_reflects_env_defaults(client):
    config = client.get("/v1/policy/config").json()
    assert config["approval_tier"] == 2
    assert config["cost_per_1k_chars_usd"] > 0


def test_route_without_a_prompt_never_touches_inference(client, monkeypatch):
    called = []
    monkeypatch.setattr("app.main.inference.call_local_model", lambda **kw: called.append(kw))

    response = client.post("/v1/route", json=LOW_RISK_PAYLOAD)
    assert response.status_code == 200
    assert response.json()["output"] is None
    assert called == []


def test_route_with_a_prompt_on_the_server_route_calls_the_local_model(client, monkeypatch):
    monkeypatch.setattr(
        "app.main.inference.call_local_model",
        lambda model, prompt, **kw: {"output": f"answer to: {prompt}", "prompt_tokens": 5, "completion_tokens": 2},
    )

    response = client.post("/v1/route", json={**LOW_RISK_PAYLOAD, "prompt": "what is 2+2?"})
    assert response.status_code == 200
    body = response.json()
    assert body["route"] == "server"
    assert body["output"] == "answer to: what is 2+2?"
    assert body["prompt_tokens"] == 5
    assert body["completion_tokens"] == 2


def test_route_with_a_prompt_gated_behind_approval_never_calls_inference(client, monkeypatch):
    called = []
    monkeypatch.setattr("app.main.inference.call_local_model", lambda **kw: called.append(kw))

    response = client.post("/v1/route", json={**HIGH_RISK_PAYLOAD, "prompt": "sensitive task"})
    assert response.status_code == 200
    body = response.json()
    assert body["route"] == "pending_approval"
    assert body["output"] is None
    assert called == []


def test_route_prompt_surfaces_inference_failures_as_502(client, monkeypatch):
    from app.inference import InferenceError

    def raise_error(**kw):
        raise InferenceError("connection refused")

    monkeypatch.setattr("app.main.inference.call_local_model", raise_error)

    response = client.post("/v1/route", json={**LOW_RISK_PAYLOAD, "prompt": "hello"})
    assert response.status_code == 502
    assert "connection refused" in response.json()["detail"]
