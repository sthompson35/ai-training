"""Real model invocation against a local OpenAI-compatible inference server
(e.g. LM Studio). This is the one place in the codebase that actually calls
a model -- everywhere else (router.py's decide_route, AgentCard.approved_models)
is policy/governance metadata about a call, not the call itself.

LOCAL_INFERENCE_BASE_URL defaults to host.docker.internal, not localhost:
the API runs inside a container, and the inference server runs on the host
machine -- localhost inside the container would resolve to the container
itself, not the host, and silently connect to nothing.
"""

import os

import httpx


class InferenceError(Exception):
    """Raised when the local inference server is unreachable or returns an
    error. Callers should surface this as a 502, not a 500 -- the API
    server itself is fine, it's the upstream model call that failed."""


def _env_float(name: str, default: float) -> float:
    """Operator-controlled env vars still get typo'd -- a clear fallback
    beats a raw ValueError/500 the caller has no way to act on."""
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def call_local_model(model: str, prompt: str, system_prompt: str | None = None, max_tokens: int = 512) -> dict:
    base_url = os.getenv("LOCAL_INFERENCE_BASE_URL", "http://host.docker.internal:1234/v1")
    timeout = _env_float("AI_REQUEST_TIMEOUT_SECONDS", 30.0)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    try:
        response = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.2,
            },
            timeout=timeout,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise InferenceError(f"Local inference server at {base_url} unreachable or errored: {exc}") from exc

    data = response.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        # Report the shape of what came back, not its contents -- this
        # message reaches API clients verbatim via the 502 detail, and a
        # malformed response could in principle contain large or sensitive
        # model output that has no business being echoed back.
        raise InferenceError(
            f"Local inference server returned an unexpected response shape "
            f"(top-level keys: {sorted(data.keys()) if isinstance(data, dict) else type(data).__name__})"
        ) from exc

    usage = data.get("usage", {})
    return {
        "output": content,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
    }
