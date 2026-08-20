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

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_analytics_returns_empty_lists_for_unseeded_resources(client):
    response = client.get("/v1/analytics")
    assert response.status_code == 200
    body = response.json()
    assert body["incidents_by_severity"] == []
    assert body["incidents_by_status"] == []
    assert body["releases_by_status"] == []
    assert body["enrollments_by_status"] == []
    assert body["modules_by_level"] == []
    assert body["raci_by_responsibility"] == []
    assert body["cost_today_usd"] == 0
    assert body["cost_daily_limit_usd"] == 25.0
    assert body["cost_remaining_usd"] == 25.0
    assert len(body["cost_last_7_days"]) == 7
    assert all(day["cost_usd"] == 0 for day in body["cost_last_7_days"])


def test_analytics_tracks_cost_from_route_calls(client):
    assert client.get("/v1/analytics").json()["cost_today_usd"] == 0

    # Server-side route: incurs cost proportional to input_chars.
    server_response = client.post(
        "/v1/route",
        json={
            "task_type": "research",
            "input_chars": 2000,
            "requires_current_data": True,
            "risk_tier": 1,
        },
    )
    assert server_response.status_code == 200
    server_cost = server_response.json()["estimated_cost_usd"]
    assert server_cost > 0

    # Client-side route: free, shouldn't add to the total.
    client_response = client.post(
        "/v1/route",
        json={
            "task_type": "summarization",
            "input_chars": 500,
            "network_quality": "offline",
            "client_ai_available": True,
            "risk_tier": 1,
        },
    )
    assert client_response.json()["estimated_cost_usd"] == 0

    body = client.get("/v1/analytics").json()
    assert body["cost_today_usd"] == round(server_cost, 4)
    assert body["cost_remaining_usd"] == round(body["cost_daily_limit_usd"] - body["cost_today_usd"], 4)

    days = body["cost_last_7_days"]
    assert len(days) == 7
    assert [d["date"] for d in days] == sorted(d["date"] for d in days)
    assert days[-1]["cost_usd"] == round(server_cost, 4)


def test_analytics_groups_and_counts_correctly():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSession()
    db.add(orm.Level(id="00", title="Foundations"))
    db.add(orm.Level(id="01", title="Advanced"))
    db.add(orm.Module(id="00.1", level_id="00", title="A", learning_outcome="x", estimated_hours=1, assessment="Quiz"))
    db.add(orm.Module(id="00.2", level_id="00", title="B", learning_outcome="x", estimated_hours=1, assessment="Quiz"))
    db.add(orm.Module(id="01.1", level_id="01", title="C", learning_outcome="x", estimated_hours=1, assessment="Quiz"))

    db.add(orm.RaciEntry(activity="Act 1", role="Owner", responsibility="A"))
    db.add(orm.RaciEntry(activity="Act 2", role="Owner", responsibility="A"))
    db.add(orm.RaciEntry(activity="Act 3", role="Reviewer", responsibility="R"))

    member = orm.ServiceMember(
        service_member_id="ATA-VICTOR-000",
        callsign_id="ATA-SM-VICTOR-001",
        callsign="@VICTOR",
        display_name="Priya Moreno",
        member_class="human_trooper",
        command_layer="support",
        current_role="Support Technician",
    )
    db.add(member)
    db.flush()

    db.add(orm.Incident(title="Incident 1", severity="high", status="detected", description="d", impact="i", owner_service_member_id=member.service_member_id))
    db.add(orm.Incident(title="Incident 2", severity="high", status="resolved", description="d", impact="i", owner_service_member_id=member.service_member_id))
    db.add(orm.Incident(title="Incident 3", severity="critical", status="detected", description="d", impact="i", owner_service_member_id=member.service_member_id))

    db.add(
        orm.Release(
            title="Release 1", version="1.0", rationale="r", expected_impact="e", test_evidence="t",
            approver_service_member_id=member.service_member_id, release_date="2026-01-01", rollback_target="rt", status="proposed",
        )
    )
    db.add(
        orm.Release(
            title="Release 2", version="1.1", rationale="r", expected_impact="e", test_evidence="t",
            approver_service_member_id=member.service_member_id, release_date="2026-01-02", rollback_target="rt", status="released",
        )
    )

    learner = orm.Learner(name="Ada", email="ada@example.com")
    certification = orm.Certification(
        code="AFA", title="AI Foundations Associate", required_levels="00-01",
        written_questions=10, practical="p", passing_percent=80, recert_months=12,
    )
    db.add(learner)
    db.add(certification)
    db.commit()
    db.add(orm.Enrollment(learner_id=learner.id, certification_code=certification.code, status="enrolled"))
    db.add(orm.Enrollment(learner_id=learner.id, certification_code=certification.code, status="certified"))
    db.commit()
    db.close()

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            response = test_client.get("/v1/analytics")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()

    assert body["modules_by_level"] == [
        {"label": "00", "count": 2},
        {"label": "01", "count": 1},
    ]
    assert body["raci_by_responsibility"] == [
        {"label": "A", "count": 2},
        {"label": "R", "count": 1},
    ]
    assert body["incidents_by_severity"] == [
        {"label": "critical", "count": 1},
        {"label": "high", "count": 2},
    ]
    assert body["incidents_by_status"] == [
        {"label": "detected", "count": 2},
        {"label": "resolved", "count": 1},
    ]
    assert body["releases_by_status"] == [
        {"label": "proposed", "count": 1},
        {"label": "released", "count": 1},
    ]
    assert body["enrollments_by_status"] == [
        {"label": "certified", "count": 1},
        {"label": "enrolled", "count": 1},
    ]
