import httpx
import pytest

from app import inference


class _FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._json_data


def test_malformed_timeout_env_falls_back_to_the_default_instead_of_crashing(monkeypatch):
    monkeypatch.setenv("AI_REQUEST_TIMEOUT_SECONDS", "not-a-number")
    assert inference._env_float("AI_REQUEST_TIMEOUT_SECONDS", 30.0) == 30.0


def test_missing_timeout_env_falls_back_to_the_default():
    assert inference._env_float("SOME_VAR_THAT_DOES_NOT_EXIST", 12.5) == 12.5


def test_unexpected_response_shape_error_reports_keys_not_raw_content(monkeypatch):
    """The exception message reaches API clients verbatim via a 502 detail --
    it must never echo back the full (potentially large or sensitive)
    response body, only enough to diagnose the shape mismatch."""
    monkeypatch.setattr(
        "app.inference.httpx.post",
        lambda *a, **kw: _FakeResponse({"unexpected": "shape", "secret_looking_field": "should not leak"}),
    )

    with pytest.raises(inference.InferenceError) as exc_info:
        inference.call_local_model(model="m", prompt="p")

    message = str(exc_info.value)
    assert "unexpected" in message  # the key name is fine to report
    assert "should not leak" not in message  # the value content is not


def test_connection_failure_raises_inference_error(monkeypatch):
    def raise_connect_error(*args, **kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr("app.inference.httpx.post", raise_connect_error)

    with pytest.raises(inference.InferenceError):
        inference.call_local_model(model="m", prompt="p")
