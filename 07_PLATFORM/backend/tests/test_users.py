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


def test_contributor_is_forbidden_from_user_management(client, contributor_headers):
    assert client.get("/v1/users", headers=contributor_headers).status_code == 403
    assert (
        client.post(
            "/v1/users",
            json={"username": "new-user", "password": "pw", "role": "contributor"},
            headers=contributor_headers,
        ).status_code
        == 403
    )
    assert client.put("/v1/users/1", json={"role": "admin"}, headers=contributor_headers).status_code == 403
    assert client.delete("/v1/users/1", headers=contributor_headers).status_code == 403


def test_admin_can_list_and_create_users(client, admin_headers):
    listed = client.get("/v1/users", headers=admin_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    create = client.post(
        "/v1/users",
        json={"username": "new-contributor", "password": "pw", "role": "contributor"},
        headers=admin_headers,
    )
    assert create.status_code == 201
    body = create.json()
    assert body["username"] == "new-contributor"
    assert body["role"] == "contributor"
    assert "password" not in body
    assert "password_hash" not in body


def test_create_user_rejects_duplicate_username(client, admin_headers):
    response = client.post(
        "/v1/users",
        json={"username": "admin", "password": "pw", "role": "contributor"},
        headers=admin_headers,
    )
    assert response.status_code == 409


def test_admin_can_update_role(client, admin_headers):
    create = client.post(
        "/v1/users",
        json={"username": "promote-me", "password": "pw", "role": "contributor"},
        headers=admin_headers,
    )
    user_id = create.json()["id"]

    update = client.put(f"/v1/users/{user_id}", json={"role": "admin"}, headers=admin_headers)
    assert update.status_code == 200
    assert update.json()["role"] == "admin"


def test_cannot_delete_last_remaining_admin(client, admin_headers):
    response = client.delete("/v1/users/1", headers=admin_headers)
    assert response.status_code == 409


def test_can_delete_admin_when_another_admin_remains(client, admin_headers):
    create = client.post(
        "/v1/users",
        json={"username": "second-admin", "password": "pw", "role": "admin"},
        headers=admin_headers,
    )
    second_admin_id = create.json()["id"]

    response = client.delete(f"/v1/users/{second_admin_id}", headers=admin_headers)
    assert response.status_code == 204


def test_import_users_requires_admin(client, contributor_headers):
    csv_content = "username,password,role\nimported-user,pw123,contributor\n"
    response = client.post(
        "/v1/users/import", files={"file": ("users.csv", csv_content, "text/csv")}, headers=contributor_headers
    )
    assert response.status_code == 403


def test_import_users_smoke(client, admin_headers):
    csv_content = "username,password,role\nimported-user,pw123,contributor\nadmin,pw123,contributor\n"
    response = client.post(
        "/v1/users/import", files={"file": ("users.csv", csv_content, "text/csv")}, headers=admin_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert len(body["skipped"]) == 1
    assert "already exists" in body["skipped"][0]["reason"]


def test_bulk_delete_users_requires_admin(client, contributor_headers):
    response = client.post("/v1/users/bulk-delete", json={"ids": [2]}, headers=contributor_headers)
    assert response.status_code == 403


def test_bulk_delete_users_stops_at_the_last_remaining_admin(client, admin_headers):
    second_admin = client.post(
        "/v1/users",
        json={"username": "second-admin", "password": "pw", "role": "admin"},
        headers=admin_headers,
    ).json()

    response = client.post(
        "/v1/users/bulk-delete",
        json={"ids": [1, second_admin["id"]]},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == 1
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["reason"] == "Cannot delete the last remaining admin"

    remaining = client.get("/v1/users", headers=admin_headers).json()
    admins = [u for u in remaining if u["role"] == "admin"]
    assert len(admins) == 1


def test_bulk_delete_users_reports_not_found(client, admin_headers):
    contributor = client.get("/v1/users", headers=admin_headers).json()
    contributor_id = next(u["id"] for u in contributor if u["username"] == "contributor")

    response = client.post(
        "/v1/users/bulk-delete",
        json={"ids": [contributor_id, 999999]},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == 1
    assert body["skipped"] == [{"id": "999999", "reason": "Not found"}]


def test_bulk_update_role_requires_admin(client, contributor_headers):
    response = client.post("/v1/users/bulk-update-role", json={"ids": [2], "role": "admin"}, headers=contributor_headers)
    assert response.status_code == 403


def test_bulk_update_role_stops_at_the_last_remaining_admin(client, admin_headers):
    second_admin = client.post(
        "/v1/users",
        json={"username": "second-admin", "password": "pw", "role": "admin"},
        headers=admin_headers,
    ).json()

    response = client.post(
        "/v1/users/bulk-update-role",
        json={"ids": [1, second_admin["id"]], "role": "contributor"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 1
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["reason"] == "Cannot demote the last remaining admin"

    remaining = client.get("/v1/users", headers=admin_headers).json()
    admins = [u for u in remaining if u["role"] == "admin"]
    assert len(admins) == 1


def test_bulk_update_role_reports_not_found(client, admin_headers):
    contributor = client.get("/v1/users", headers=admin_headers).json()
    contributor_id = next(u["id"] for u in contributor if u["username"] == "contributor")

    response = client.post(
        "/v1/users/bulk-update-role",
        json={"ids": [contributor_id, 999999], "role": "admin"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 1
    assert body["skipped"] == [{"id": "999999", "reason": "Not found"}]

    remaining = client.get("/v1/users", headers=admin_headers).json()
    updated_contributor = next(u for u in remaining if u["id"] == contributor_id)
    assert updated_contributor["role"] == "admin"


def test_bulk_update_role_promoting_does_not_touch_the_admin_guard(client, admin_headers):
    contributor = client.get("/v1/users", headers=admin_headers).json()
    contributor_id = next(u["id"] for u in contributor if u["username"] == "contributor")

    response = client.post(
        "/v1/users/bulk-update-role",
        json={"ids": [1, contributor_id], "role": "admin"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 2
    assert body["skipped"] == []


def test_export_users_requires_admin(client, contributor_headers):
    assert client.get("/v1/users/export", headers=contributor_headers).status_code == 403


def test_export_users_returns_csv_without_password_hash(client, admin_headers):
    response = client.get("/v1/users/export", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "password_hash" not in response.text
    assert "password" not in response.text
    assert "admin" in response.text
    assert "contributor" in response.text


def test_can_delete_contributor(client, admin_headers):
    contributor = client.get("/v1/users", headers=admin_headers).json()
    contributor_id = next(u["id"] for u in contributor if u["username"] == "contributor")

    response = client.delete(f"/v1/users/{contributor_id}", headers=admin_headers)
    assert response.status_code == 204


def test_change_my_password_requires_correct_current_password(client, contributor_headers):
    response = client.put(
        "/v1/users/me/password",
        json={"current_password": "wrong", "new_password": "new-pw-12345"},
        headers=contributor_headers,
    )
    assert response.status_code == 403


def test_change_my_password_succeeds_and_new_password_works(client, contributor_headers):
    response = client.put(
        "/v1/users/me/password",
        json={"current_password": "pw", "new_password": "new-pw-12345"},
        headers=contributor_headers,
    )
    assert response.status_code == 204

    assert client.post(
        "/v1/auth/login", json={"username": "contributor", "password": "pw"}
    ).status_code == 401
    assert client.post(
        "/v1/auth/login", json={"username": "contributor", "password": "new-pw-12345"}
    ).status_code == 200


def test_admin_reset_password_requires_admin(client, contributor_headers):
    response = client.put(
        "/v1/users/1/password", json={"new_password": "new-pw-12345"}, headers=contributor_headers
    )
    assert response.status_code == 403


def test_admin_reset_password_returns_404_for_unknown_user(client, admin_headers):
    response = client.put(
        "/v1/users/999/password", json={"new_password": "new-pw-12345"}, headers=admin_headers
    )
    assert response.status_code == 404


def test_admin_can_reset_another_users_password(client, admin_headers):
    contributor = client.get("/v1/users", headers=admin_headers).json()
    contributor_id = next(u["id"] for u in contributor if u["username"] == "contributor")

    response = client.put(
        f"/v1/users/{contributor_id}/password",
        json={"new_password": "admin-reset-pw-12345"},
        headers=admin_headers,
    )
    assert response.status_code == 204

    assert client.post(
        "/v1/auth/login", json={"username": "contributor", "password": "admin-reset-pw-12345"}
    ).status_code == 200
