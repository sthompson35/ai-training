from enum import Enum
from pydantic import BaseModel, Field


class NetworkQuality(str, Enum):
    offline = "offline"
    poor = "poor"
    good = "good"


class RouteDecision(str, Enum):
    client = "client"
    server = "server"
    unavailable = "unavailable"
    pending_approval = "pending_approval"


class RouteRequest(BaseModel):
    task_type: str = Field(min_length=2, max_length=80)
    input_chars: int = Field(ge=0, le=1_000_000)
    requires_current_data: bool = False
    contains_sensitive_data: bool = False
    network_quality: NetworkQuality = NetworkQuality.good
    client_ai_available: bool = False
    risk_tier: int = Field(default=1, ge=0, le=4)
    approval_request_id: int | None = None


class RouteResponse(BaseModel):
    route: RouteDecision
    reason: str
    degraded_mode: bool
    requires_human_approval: bool
    policy_version: str
    estimated_cost_usd: float = 0.0
    approval_request_id: int | None = None
