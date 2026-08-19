from app.models import RouteRequest
from app.router import decide_route


def test_offline_local_route():
    result = decide_route(RouteRequest(
        task_type="summarization",
        input_chars=1000,
        network_quality="offline",
        client_ai_available=True,
        risk_tier=1,
    ))
    assert result.route == "client"
    assert result.degraded_mode is True


def test_current_data_uses_server():
    result = decide_route(RouteRequest(
        task_type="research",
        input_chars=1000,
        requires_current_data=True,
        client_ai_available=True,
        risk_tier=1,
    ))
    assert result.route == "server"


def test_high_risk_requires_approval():
    result = decide_route(RouteRequest(
        task_type="summarization",
        input_chars=1000,
        client_ai_available=True,
        risk_tier=3,
    ))
    assert result.requires_human_approval is True


def test_server_route_has_a_positive_estimated_cost():
    result = decide_route(RouteRequest(
        task_type="research",
        input_chars=2000,
        requires_current_data=True,
        risk_tier=1,
    ))
    assert result.route == "server"
    assert result.estimated_cost_usd > 0


def test_client_route_has_zero_estimated_cost():
    result = decide_route(RouteRequest(
        task_type="summarization",
        input_chars=1000,
        network_quality="offline",
        client_ai_available=True,
        risk_tier=1,
    ))
    assert result.route == "client"
    assert result.estimated_cost_usd == 0


def test_unavailable_route_has_zero_estimated_cost():
    result = decide_route(RouteRequest(
        task_type="research",
        input_chars=1000,
        network_quality="offline",
        client_ai_available=False,
        risk_tier=1,
    ))
    assert result.route == "unavailable"
    assert result.estimated_cost_usd == 0
