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
    db.add(
        orm.Certification(
            code="AFA",
            title="AI Foundations Associate",
            required_levels="00-02",
            written_questions=60,
            practical="Structured prompt and evaluation",
            passing_percent=80,
            recert_months=12,
        )
    )
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_list_certifications_returns_seeded_tier(client):
    response = client.get("/v1/certifications")
    assert response.status_code == 200
    assert [c["code"] for c in response.json()] == ["AFA"]


def test_learner_create_and_delete(client, auth_headers):
    create = client.post(
        "/v1/learners", json={"name": "Ada Lovelace", "email": "ada@example.com"}, headers=auth_headers
    )
    assert create.status_code == 201
    learner_id = create.json()["id"]

    duplicate = client.post(
        "/v1/learners", json={"name": "Ada L.", "email": "ada@example.com"}, headers=auth_headers
    )
    assert duplicate.status_code == 409

    delete = client.delete(f"/v1/learners/{learner_id}", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get(f"/v1/learners/{learner_id}").status_code == 404


def test_learners_pagination_and_search(client, auth_headers):
    for name, email in [
        ("Ada Lovelace", "ada@example.com"),
        ("Grace Hopper", "grace@example.com"),
        ("Katherine Johnson", "katherine@example.com"),
    ]:
        client.post("/v1/learners", json={"name": name, "email": email}, headers=auth_headers)

    page = client.get("/v1/learners", params={"limit": 1})
    assert page.status_code == 200
    assert len(page.json()) == 1
    assert page.headers["x-total-count"] == "3"

    search = client.get("/v1/learners", params={"q": "grace"})
    assert len(search.json()) == 1
    assert search.json()[0]["name"] == "Grace Hopper"


def test_export_endpoints_return_csv(client):
    for path in ("/v1/certifications/export", "/v1/learners/export", "/v1/enrollments/export"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
    assert "AFA" in client.get("/v1/certifications/export").text


def test_bulk_delete_learners_reports_deleted_and_skipped(client, auth_headers):
    one = client.post(
        "/v1/learners", json={"name": "Bulk One", "email": "bulk-one@example.com"}, headers=auth_headers
    ).json()
    two = client.post(
        "/v1/learners", json={"name": "Bulk Two", "email": "bulk-two@example.com"}, headers=auth_headers
    ).json()

    response = client.post(
        "/v1/learners/bulk-delete",
        json={"ids": [one["id"], two["id"], 999999]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == 2
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["id"] == "999999"
    assert body["skipped"][0]["reason"] == "Not found"

    assert client.get(f"/v1/learners/{one['id']}").status_code == 404
    assert client.get(f"/v1/learners/{two['id']}").status_code == 404


def test_bulk_delete_requires_auth(client):
    response = client.post("/v1/learners/bulk-delete", json={"ids": [1]})
    assert response.status_code == 403


def test_import_learners_reports_created_and_skipped_rows(client, auth_headers):
    csv_content = (
        "name,email\n"
        "Imported One,imported-one@example.com\n"
        "Imported Two,imported-two@example.com\n"
        "Bad Row,not-an-email\n"
    )
    response = client.post(
        "/v1/learners/import",
        files={"file": ("learners.csv", csv_content, "text/csv")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 2
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["row"] == 4

    listed = client.get("/v1/learners", params={"q": "Imported"})
    assert len(listed.json()) == 2


def test_import_learners_skips_duplicate_emails(client, auth_headers):
    client.post("/v1/learners", json={"name": "Existing", "email": "dup@example.com"}, headers=auth_headers)

    csv_content = "name,email\nDuplicate Attempt,dup@example.com\n"
    response = client.post(
        "/v1/learners/import",
        files={"file": ("learners.csv", csv_content, "text/csv")},
        headers=auth_headers,
    )
    body = response.json()
    assert body["created"] == 0
    assert "already exists" in body["skipped"][0]["reason"]


def test_import_requires_auth(client):
    csv_content = "name,email\nNo Auth,noauth@example.com\n"
    response = client.post("/v1/learners/import", files={"file": ("learners.csv", csv_content, "text/csv")})
    assert response.status_code == 403


def test_import_enrollments_smoke(client, auth_headers):
    learner = client.post(
        "/v1/learners", json={"name": "Enroll Target", "email": "enroll@example.com"}, headers=auth_headers
    ).json()
    csv_content = f"learner_id,certification_code\n{learner['id']},AFA\n"
    response = client.post(
        "/v1/enrollments/import",
        files={"file": ("enrollments.csv", csv_content, "text/csv")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1


def test_bulk_delete_enrollments_smoke(client, auth_headers):
    learner = client.post(
        "/v1/learners", json={"name": "Bulk Enroll Target", "email": "bulk-enroll@example.com"}, headers=auth_headers
    ).json()
    enrollment = client.post(
        "/v1/enrollments",
        json={"learner_id": learner["id"], "certification_code": "AFA"},
        headers=auth_headers,
    ).json()

    response = client.post(
        "/v1/enrollments/bulk-delete",
        json={"ids": [enrollment["id"], 999999]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == 1
    assert len(body["skipped"]) == 1


def test_bulk_update_enrollment_status_smoke(client, auth_headers):
    learner = client.post(
        "/v1/learners", json={"name": "Bulk Status Target", "email": "bulk-status@example.com"}, headers=auth_headers
    ).json()
    enrollment = client.post(
        "/v1/enrollments",
        json={"learner_id": learner["id"], "certification_code": "AFA"},
        headers=auth_headers,
    ).json()

    response = client.post(
        "/v1/enrollments/bulk-update-status",
        json={"ids": [enrollment["id"], 999999], "status": "certified"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 1
    assert len(body["skipped"]) == 1

    listed = client.get(f"/v1/learners/{learner['id']}").json()
    assert listed["enrollments"][0]["status"] == "certified"


def test_enrollment_requires_known_learner_and_certification(client, auth_headers):
    response = client.post(
        "/v1/enrollments",
        json={"learner_id": 999, "certification_code": "AFA"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_enrollment_roundtrip(client, auth_headers):
    learner = client.post(
        "/v1/learners", json={"name": "Grace Hopper", "email": "grace@example.com"}, headers=auth_headers
    )
    learner_id = learner.json()["id"]

    create = client.post(
        "/v1/enrollments",
        json={"learner_id": learner_id, "certification_code": "AFA"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    enrollment = create.json()
    assert enrollment["status"] == "enrolled"

    update = client.put(
        f"/v1/enrollments/{enrollment['id']}",
        json={"status": "certified", "written_score": 92, "notes": "Board approved"},
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["status"] == "certified"
    assert update.json()["written_score"] == 92

    listed = client.get("/v1/enrollments", params={"certification_code": "AFA"})
    assert len(listed.json()) == 1

    delete = client.delete(f"/v1/enrollments/{enrollment['id']}", headers=auth_headers)
    assert delete.status_code == 204
