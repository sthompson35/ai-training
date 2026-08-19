import os
from .models import RouteDecision, RouteRequest, RouteResponse


LOCAL_TASKS = {
    "summarization",
    "translation",
    "language_detection",
    "proofreading",
    "rephrasing",
    "classification",
}


def _estimate_cost_usd(route: RouteDecision, input_chars: int) -> float:
    # Only a server-side decision would incur real inference cost in a
    # production system — client-side execution is local and free, and an
    # unavailable route means nothing actually ran.
    if route != RouteDecision.server:
        return 0.0
    cost_per_1k = float(os.getenv("AI_SERVER_COST_PER_1K_CHARS_USD", "0.002"))
    return round((input_chars / 1000) * cost_per_1k, 6)


def decide_route(request: RouteRequest) -> RouteResponse:
    policy_version = os.getenv("POLICY_VERSION", "2.0.0")
    local_limit = int(os.getenv("AI_MAX_INPUT_CHARS_LOCAL", "12000"))
    approval_tier = int(os.getenv("REQUIRE_HUMAN_APPROVAL_TIER", "2"))
    requires_approval = request.risk_tier >= approval_tier

    if request.network_quality == "offline":
        if request.client_ai_available and request.task_type in LOCAL_TASKS and request.input_chars <= local_limit:
            return RouteResponse(
                route=RouteDecision.client,
                reason="Offline request routed to an available local model.",
                degraded_mode=True,
                requires_human_approval=requires_approval,
                policy_version=policy_version,
                estimated_cost_usd=_estimate_cost_usd(RouteDecision.client, request.input_chars),
            )
        return RouteResponse(
            route=RouteDecision.unavailable,
            reason="No network connection and no suitable client-side model is available.",
            degraded_mode=True,
            requires_human_approval=requires_approval,
            policy_version=policy_version,
            estimated_cost_usd=_estimate_cost_usd(RouteDecision.unavailable, request.input_chars),
        )

    if request.requires_current_data:
        return RouteResponse(
            route=RouteDecision.server,
            reason="Current external information requires server-side tools or retrieval.",
            degraded_mode=False,
            requires_human_approval=requires_approval,
            policy_version=policy_version,
            estimated_cost_usd=_estimate_cost_usd(RouteDecision.server, request.input_chars),
        )

    if (
        request.contains_sensitive_data
        and request.client_ai_available
        and request.task_type in LOCAL_TASKS
        and request.input_chars <= local_limit
    ):
        return RouteResponse(
            route=RouteDecision.client,
            reason="Sensitive, bounded task with local capability available.",
            degraded_mode=False,
            requires_human_approval=requires_approval,
            policy_version=policy_version,
            estimated_cost_usd=_estimate_cost_usd(RouteDecision.client, request.input_chars),
        )

    if (
        request.network_quality == "poor"
        and request.client_ai_available
        and request.task_type in LOCAL_TASKS
        and request.input_chars <= local_limit
    ):
        return RouteResponse(
            route=RouteDecision.client,
            reason="Spotty connectivity; local execution improves resiliency.",
            degraded_mode=True,
            requires_human_approval=requires_approval,
            policy_version=policy_version,
            estimated_cost_usd=_estimate_cost_usd(RouteDecision.client, request.input_chars),
        )

    return RouteResponse(
        route=RouteDecision.server,
        reason="Server-side execution selected for capability and platform consistency.",
        degraded_mode=False,
        requires_human_approval=requires_approval,
        policy_version=policy_version,
        estimated_cost_usd=_estimate_cost_usd(RouteDecision.server, request.input_chars),
    )
