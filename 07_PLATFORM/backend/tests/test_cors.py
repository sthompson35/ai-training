from fastapi.testclient import TestClient

from app.main import app


def test_allowed_origin_gets_cors_header():
    with TestClient(app) as client:
        response = client.get("/v1/levels", headers={"Origin": "http://localhost:3000"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_preflight_for_mutation_is_allowed():
    with TestClient(app) as client:
        response = client.options(
            "/v1/labs",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_disallowed_origin_gets_no_cors_header():
    with TestClient(app) as client:
        response = client.get("/v1/levels", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in response.headers
