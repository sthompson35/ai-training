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


def test_list_releases_starts_empty(client):
    response = client.get("/v1/releases")
    assert response.status_code == 200
    assert response.json() == []


def test_release_requires_auth(client):
    response = client.post("/v1/releases", json=release_payload())
    assert response.status_code == 403


def test_import_releases_smoke(client, auth_headers):
    payload = release_payload(title="Imported release")
    csv_content = to_csv(payload)

    response = client.post(
        "/v1/releases/import", files={"file": ("releases.csv", csv_content, "text/csv")}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1


def test_bulk_delete_releases_smoke(client, auth_headers):
    release = client.post("/v1/releases", json=release_payload(), headers=auth_headers).json()

    response = client.post(
        "/v1/releases/bulk-delete", json={"ids": [release["id"], 999999]}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert len(response.json()["skipped"]) == 1


def test_bulk_update_release_status_smoke(client, auth_headers):
    release = client.post("/v1/releases", json=release_payload(), headers=auth_headers).json()

    response = client.post(
        "/v1/releases/bulk-update-status",
        json={"ids": [release["id"], 999999], "status": "released"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["updated"] == 1
    assert len(response.json()["skipped"]) == 1
    assert client.get(f"/v1/releases/{release['id']}").json()["status"] == "released"


def test_export_releases_returns_csv(client, auth_headers):
    client.post("/v1/releases", json=release_payload(), headers=auth_headers)

    response = client.get("/v1/releases/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "Add refusal instruction for refund policy questions" in response.text


def test_release_crud_roundtrip(client, auth_headers):
    create = client.post("/v1/releases", json=release_payload(), headers=auth_headers)
    assert create.status_code == 201
    release = create.json()
    assert release["status"] == "proposed"

    listed = client.get("/v1/releases", params={"status": "proposed"})
    assert len(listed.json()) == 1

    update = client.put(
        f"/v1/releases/{release['id']}",
        json=release_payload(status="released"),
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["status"] == "released"

    delete = client.delete(f"/v1/releases/{release['id']}", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get(f"/v1/releases/{release['id']}").status_code == 404


def test_releases_pagination_and_search(client, auth_headers):
    for title in [
        "Add refusal instruction for refund policy questions",
        "Tighten tool allowlist for support agent",
        "Increase routing timeout",
    ]:
        client.post("/v1/releases", json=release_payload(title=title), headers=auth_headers)

    page = client.get("/v1/releases", params={"limit": 1})
    assert page.status_code == 200
    assert len(page.json()) == 1
    assert page.headers["x-total-count"] == "3"

    search = client.get("/v1/releases", params={"q": "allowlist"})
    assert len(search.json()) == 1
    assert search.json()[0]["title"] == "Tighten tool allowlist for support agent"
