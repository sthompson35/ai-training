import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

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
    db.add(orm.RaciEntry(activity="Curriculum governance", role="Executive Sponsor", responsibility="A"))
    db.add(orm.RaciEntry(activity="Curriculum governance", role="Academy Owner", responsibility="R"))
    db.add(orm.RaciEntry(activity="Source approval", role="Academy Owner", responsibility="A/R"))
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_list_raci_entries_returns_seeded_rows(client):
    response = client.get("/v1/governance/raci")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_list_raci_entries_filters_by_activity(client):
    response = client.get("/v1/governance/raci", params={"activity": "Source approval"})
    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 1
    assert entries[0]["responsibility"] == "A/R"


def test_export_raci_entries_returns_csv(client):
    response = client.get("/v1/governance/raci/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")


def test_bulk_delete_raci_entries_smoke(client, auth_headers):
    entry = client.post(
        "/v1/governance/raci",
        json={"activity": "Bulk activity", "role": "AI Architect", "responsibility": "C"},
        headers=auth_headers,
    ).json()

    response = client.post(
        "/v1/governance/raci/bulk-delete", json={"ids": [entry["id"], 999999]}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert len(response.json()["skipped"]) == 1


def test_import_raci_entries_smoke(client, auth_headers):
    csv_content = "activity,role,responsibility\nImported activity,AI Architect,C\n"
    response = client.post(
        "/v1/governance/raci/import",
        files={"file": ("raci.csv", csv_content, "text/csv")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1


def test_raci_entry_requires_auth(client):
    response = client.post(
        "/v1/governance/raci",
        json={"activity": "Technical labs", "role": "AI Architect", "responsibility": "A/R"},
    )
    assert response.status_code == 403


def test_raci_entry_crud_roundtrip(client, auth_headers):
    create = client.post(
        "/v1/governance/raci",
        json={"activity": "Technical labs", "role": "Security Owner", "responsibility": "C"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    entry_id = create.json()["id"]

    update = client.put(
        f"/v1/governance/raci/{entry_id}",
        json={"activity": "Technical labs", "role": "Security Owner", "responsibility": "I"},
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["responsibility"] == "I"

    delete = client.delete(f"/v1/governance/raci/{entry_id}", headers=auth_headers)
    assert delete.status_code == 204
    assert len(client.get("/v1/governance/raci").json()) == 3
