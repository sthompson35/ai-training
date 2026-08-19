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
    db.add(orm.Level(id="09", title="Zephyr Foundations"))
    db.add(
        orm.Learner(name="Ada Zephyr", email="ada.zephyr@example.com"),
    )
    db.add(
        orm.Incident(
            title="Zephyr gateway outage",
            severity="high",
            status="detected",
            description="Gateway dropped requests",
            impact="Checkout unavailable",
            owner="sre-team",
        )
    )
    # A non-matching row of a fourth type, to prove the search doesn't just
    # return everything regardless of the query.
    db.add(orm.Certification(
        code="AFA",
        title="AI Foundations Associate",
        required_levels="00-02",
        written_questions=60,
        practical="Structured prompt and evaluation",
        passing_percent=80,
        recert_months=12,
    ))
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_search_requires_at_least_two_characters(client):
    assert client.get("/v1/search").json() == []
    assert client.get("/v1/search?q=").json() == []
    assert client.get("/v1/search?q=z").json() == []


def test_search_matches_across_multiple_types_with_no_auth(client):
    response = client.get("/v1/search?q=zephyr")
    assert response.status_code == 200
    results = response.json()
    types = {r["type"] for r in results}
    assert types == {"level", "learner", "incident"}

    level = next(r for r in results if r["type"] == "level")
    assert level == {"type": "level", "id": "09", "title": "Zephyr Foundations", "subtitle": None, "path": "/levels/09"}

    learner = next(r for r in results if r["type"] == "learner")
    assert learner["path"].startswith("/learners/")
    assert learner["subtitle"] == "ada.zephyr@example.com"

    incident = next(r for r in results if r["type"] == "incident")
    assert incident["path"].startswith("/incidents/")
    assert incident["subtitle"] == "high / detected"


def test_search_does_not_match_unrelated_certification(client):
    results = client.get("/v1/search?q=zephyr").json()
    assert all(r["type"] != "certification" for r in results)


def test_search_caps_results_per_type(client, auth_headers):
    for i in range(7):
        client.post(
            "/v1/learners",
            json={"name": f"Capped Learner {i}", "email": f"capped{i}@example.com"},
            headers=auth_headers,
        )
    results = client.get("/v1/search?q=capped").json()
    learners = [r for r in results if r["type"] == "learner"]
    assert len(learners) == 5
