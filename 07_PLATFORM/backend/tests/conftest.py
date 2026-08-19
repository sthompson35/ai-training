import pytest

from app.auth import create_access_token
from app.rate_limit import reset_rate_limits


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # The rate limiter's hit-tracking is module-level state shared across every
    # test in this process. Without resetting it before each test, an earlier
    # test's requests would count against a later test's limit, causing
    # order-dependent flakiness.
    reset_rate_limits()
    yield


@pytest.fixture()
def auth_headers():
    token = create_access_token("test-user", "contributor")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers():
    token = create_access_token("test-admin", "admin")
    return {"Authorization": f"Bearer {token}"}
