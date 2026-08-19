import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import audit
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


def test_audit_log_requires_auth(client):
    response = client.get("/v1/audit-log")
    assert response.status_code == 403


def test_mutation_is_recorded_in_audit_log(client, auth_headers):
    create = client.post(
        "/v1/learners",
        json={"name": "Ada Lovelace", "email": "ada@example.com"},
        headers=auth_headers,
    )
    assert create.status_code == 201

    audit = client.get("/v1/audit-log", headers=auth_headers)
    assert audit.status_code == 200
    entries = audit.json()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["method"] == "POST"
    assert entry["path"] == "/v1/learners"
    assert entry["status_code"] == 201
    assert entry["username"] == "test-user"


def test_failed_mutation_is_recorded_with_its_own_status(client, auth_headers):
    response = client.post(
        "/v1/enrollments",
        json={"learner_id": 999, "certification_code": "NOPE"},
        headers=auth_headers,
    )
    assert response.status_code == 422

    audit = client.get("/v1/audit-log", headers=auth_headers)
    entries = audit.json()
    assert len(entries) == 1
    assert entries[0]["status_code"] == 422


def test_audit_log_disabled_records_nothing(client, auth_headers, monkeypatch):
    monkeypatch.setattr(audit, "AUDIT_LOG_ENABLED", False)

    create = client.post(
        "/v1/learners", json={"name": "Ada Lovelace", "email": "ada@example.com"}, headers=auth_headers
    )
    assert create.status_code == 201

    entries = client.get("/v1/audit-log", headers=auth_headers).json()
    assert entries == []


def test_export_audit_log_requires_auth(client):
    response = client.get("/v1/audit-log/export")
    assert response.status_code == 403


def test_export_audit_log_returns_csv(client, auth_headers):
    client.post(
        "/v1/learners", json={"name": "Ada Lovelace", "email": "ada@example.com"}, headers=auth_headers
    )

    response = client.get("/v1/audit-log/export", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "/v1/learners" in response.text


def test_audit_log_filters_by_username_and_supports_pagination(client, auth_headers):
    for i in range(3):
        client.post(
            "/v1/learners",
            json={"name": f"Learner {i}", "email": f"learner{i}@example.com"},
            headers=auth_headers,
        )

    page = client.get("/v1/audit-log", params={"limit": 1}, headers=auth_headers)
    assert page.status_code == 200
    assert len(page.json()) == 1
    assert page.headers["x-total-count"] == "3"

    filtered = client.get(
        "/v1/audit-log", params={"username": "test-user"}, headers=auth_headers
    )
    assert len(filtered.json()) == 3

    none_found = client.get(
        "/v1/audit-log", params={"username": "someone-else"}, headers=auth_headers
    )
    assert none_found.json() == []
