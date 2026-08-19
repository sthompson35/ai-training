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
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_login_succeeds_with_correct_credentials(client):
    response = client.post("/v1/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["role"] == "admin"


def test_login_fails_with_wrong_password(client):
    response = client.post("/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert response.status_code == 401


def test_login_fails_for_unknown_user(client):
    response = client.post("/v1/auth/login", json={"username": "nobody", "password": "admin"})
    assert response.status_code == 401


def test_mutation_requires_auth(client):
    response = client.post(
        "/v1/labs", json={"id": "LAB-900", "title": "Test", "domain": "Testing", "deliverable": "A demo"}
    )
    assert response.status_code == 403


def test_mutation_rejects_garbage_token(client):
    response = client.post(
        "/v1/labs",
        json={"id": "LAB-900", "title": "Test", "domain": "Testing", "deliverable": "A demo"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401


def test_mutation_succeeds_with_valid_token(client):
    login = client.post("/v1/auth/login", json={"username": "admin", "password": "admin"})
    token = login.json()["access_token"]

    response = client.post(
        "/v1/labs",
        json={"id": "LAB-900", "title": "Test", "domain": "Testing", "deliverable": "A demo"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
