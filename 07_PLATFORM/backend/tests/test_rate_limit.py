import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import rate_limit
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


def test_login_rate_limit_triggers_429(client, monkeypatch):
    monkeypatch.setattr(rate_limit, "LOGIN_LIMIT_PER_MINUTE", 2)

    for _ in range(2):
        response = client.post("/v1/auth/login", json={"username": "admin", "password": "wrong"})
        assert response.status_code == 401

    limited = client.post("/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert limited.status_code == 429
    assert "retry-after" in limited.headers


def test_get_requests_are_never_rate_limited(client, monkeypatch):
    monkeypatch.setattr(rate_limit, "GENERAL_LIMIT_PER_MINUTE", 1)

    for _ in range(5):
        response = client.get("/v1/levels")
        assert response.status_code == 200


def test_mutation_rate_limit_triggers_429(client, monkeypatch, auth_headers):
    monkeypatch.setattr(rate_limit, "GENERAL_LIMIT_PER_MINUTE", 2)

    for i in range(2):
        response = client.post(
            "/v1/labs",
            json={"id": f"LAB-{i}", "title": "Test lab", "domain": "Testing", "deliverable": "A demo"},
            headers=auth_headers,
        )
        assert response.status_code == 201

    limited = client.post(
        "/v1/labs",
        json={"id": "LAB-99", "title": "Test lab", "domain": "Testing", "deliverable": "A demo"},
        headers=auth_headers,
    )
    assert limited.status_code == 429
