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
    db.add(orm.Level(id="00", title="Orientation and AI Literacy"))
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_list_levels_returns_seeded_level(client):
    response = client.get("/v1/levels")
    assert response.status_code == 200
    assert [level["id"] for level in response.json()] == ["00"]


def test_create_module_requires_known_level(client, auth_headers):
    response = client.post(
        "/v1/modules",
        json={
            "id": "99.1",
            "level_id": "99",
            "title": "Unknown level module",
            "learning_outcome": "n/a",
            "estimated_hours": 1,
            "assessment": "Quiz",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_module_crud_roundtrip(client, auth_headers):
    create = client.post(
        "/v1/modules",
        json={
            "id": "00.9",
            "level_id": "00",
            "title": "Extra module",
            "learning_outcome": "Do the thing",
            "estimated_hours": 2,
            "assessment": "Quiz",
        },
        headers=auth_headers,
    )
    assert create.status_code == 201

    update = client.put(
        "/v1/modules/00.9",
        json={
            "title": "Updated module",
            "learning_outcome": "Do the thing better",
            "estimated_hours": 3,
            "assessment": "Lab",
        },
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["title"] == "Updated module"

    delete = client.delete("/v1/modules/00.9", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get("/v1/modules/00.9").status_code == 404


def test_bulk_delete_modules_and_labs_smoke(client, auth_headers):
    client.post(
        "/v1/modules",
        json={
            "id": "00.7",
            "level_id": "00",
            "title": "Bulk delete target",
            "learning_outcome": "n/a",
            "estimated_hours": 1,
            "assessment": "Quiz",
        },
        headers=auth_headers,
    )
    modules_response = client.post(
        "/v1/modules/bulk-delete", json={"ids": ["00.7", "unknown"]}, headers=auth_headers
    )
    assert modules_response.status_code == 200
    assert modules_response.json()["deleted"] == 1
    assert len(modules_response.json()["skipped"]) == 1

    client.post(
        "/v1/labs",
        json={"id": "LAB-BULK-1", "title": "Bulk lab", "domain": "Testing", "deliverable": "A report"},
        headers=auth_headers,
    )
    labs_response = client.post(
        "/v1/labs/bulk-delete", json={"ids": ["LAB-BULK-1", "unknown"]}, headers=auth_headers
    )
    assert labs_response.status_code == 200
    assert labs_response.json()["deleted"] == 1
    assert len(labs_response.json()["skipped"]) == 1


def test_import_modules_and_labs_smoke(client, auth_headers):
    modules_csv = (
        "id,level_id,title,learning_outcome,estimated_hours,assessment\n"
        "00.8,00,Imported module,Learn things,2,Quiz\n"
    )
    modules_response = client.post(
        "/v1/modules/import", files={"file": ("modules.csv", modules_csv, "text/csv")}, headers=auth_headers
    )
    assert modules_response.status_code == 200
    assert modules_response.json()["created"] == 1

    labs_csv = "id,title,domain,deliverable\nLAB-IMPORT-1,Imported lab,Testing,A report\n"
    labs_response = client.post(
        "/v1/labs/import", files={"file": ("labs.csv", labs_csv, "text/csv")}, headers=auth_headers
    )
    assert labs_response.status_code == 200
    assert labs_response.json()["created"] == 1


def test_export_endpoints_return_csv(client):
    for path in ("/v1/levels/export", "/v1/modules/export", "/v1/labs/export"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
    assert "00" in client.get("/v1/levels/export").text


def test_lab_crud_roundtrip(client, auth_headers):
    create = client.post(
        "/v1/labs",
        json={"id": "LAB-099", "title": "Test lab", "domain": "Testing", "deliverable": "A report"},
        headers=auth_headers,
    )
    assert create.status_code == 201

    listed = client.get("/v1/labs", params={"domain": "Testing"})
    assert listed.status_code == 200
    assert [lab["id"] for lab in listed.json()] == ["LAB-099"]

    delete = client.delete("/v1/labs/LAB-099", headers=auth_headers)
    assert delete.status_code == 204
