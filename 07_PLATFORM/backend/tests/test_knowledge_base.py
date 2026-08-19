import csv
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app import orm


def to_csv(payload: dict) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(payload.keys()))
    writer.writeheader()
    writer.writerow(payload)
    return buffer.getvalue()


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
    db.add(orm.GlossaryTerm(term="Agent", definition="A bounded, tool-using software system."))
    db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_list_glossary_returns_seeded_term(client):
    response = client.get("/v1/glossary")
    assert response.status_code == 200
    assert [t["term"] for t in response.json()] == ["Agent"]


def test_glossary_term_crud_roundtrip(client, auth_headers):
    create = client.post(
        "/v1/glossary",
        json={"term": "RAG", "definition": "Retrieval-augmented generation."},
        headers=auth_headers,
    )
    assert create.status_code == 201

    duplicate = client.post(
        "/v1/glossary", json={"term": "RAG", "definition": "duplicate"}, headers=auth_headers
    )
    assert duplicate.status_code == 409

    update = client.put(
        "/v1/glossary/RAG", json={"definition": "Updated definition."}, headers=auth_headers
    )
    assert update.status_code == 200
    assert update.json()["definition"] == "Updated definition."

    delete = client.delete("/v1/glossary/RAG", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get("/v1/glossary").json() == [
        {"term": "Agent", "definition": "A bounded, tool-using software system."}
    ]


def article_payload(**overrides):
    payload = {
        "title": "Grounded generation",
        "domain": "Knowledge Systems and RAG",
        "content_type": "definition",
        "status": "draft",
        "owner": "kb-team",
        "review_date": "2026-01-01",
        "version": "1.0",
        "definition": "def",
        "why_it_matters": "why",
        "when_to_use": "when",
        "when_not_to_use": "when not",
        "architecture": "arch",
        "inputs_and_outputs": "io",
        "risks_and_controls": "risks",
        "examples": "examples",
        "evaluation_criteria": "eval",
        "sources": "sources",
    }
    payload.update(overrides)
    return payload


def test_export_endpoints_return_csv(client):
    for path in ("/v1/glossary/export", "/v1/kb-articles/export"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
    assert "Agent" in client.get("/v1/glossary/export").text


def test_bulk_delete_glossary_and_kb_articles_smoke(client, auth_headers):
    client.post(
        "/v1/glossary", json={"term": "Bulk Term", "definition": "def"}, headers=auth_headers
    )
    glossary_response = client.post(
        "/v1/glossary/bulk-delete", json={"ids": ["Bulk Term", "unknown"]}, headers=auth_headers
    )
    assert glossary_response.status_code == 200
    assert glossary_response.json()["deleted"] == 1
    assert len(glossary_response.json()["skipped"]) == 1

    article = client.post("/v1/kb-articles", json=article_payload(), headers=auth_headers).json()
    kb_response = client.post(
        "/v1/kb-articles/bulk-delete", json={"ids": [article["id"], 999999]}, headers=auth_headers
    )
    assert kb_response.status_code == 200
    assert kb_response.json()["deleted"] == 1
    assert len(kb_response.json()["skipped"]) == 1


def test_bulk_update_kb_article_status_smoke(client, auth_headers):
    article = client.post("/v1/kb-articles", json=article_payload(), headers=auth_headers).json()

    response = client.post(
        "/v1/kb-articles/bulk-update-status",
        json={"ids": [article["id"], 999999], "status": "approved"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 1
    assert len(body["skipped"]) == 1
    assert client.get(f"/v1/kb-articles/{article['id']}").json()["status"] == "approved"


def test_import_glossary_and_kb_articles_smoke(client, auth_headers):
    glossary_csv = "term,definition\nImported Term,An imported definition.\n"
    glossary_response = client.post(
        "/v1/glossary/import", files={"file": ("glossary.csv", glossary_csv, "text/csv")}, headers=auth_headers
    )
    assert glossary_response.status_code == 200
    assert glossary_response.json()["created"] == 1

    article = article_payload(title="Imported article")
    kb_csv = to_csv(article)
    kb_response = client.post(
        "/v1/kb-articles/import", files={"file": ("kb_articles.csv", kb_csv, "text/csv")}, headers=auth_headers
    )
    assert kb_response.status_code == 200
    assert kb_response.json()["created"] == 1


def test_kb_article_crud_roundtrip(client, auth_headers):
    create = client.post("/v1/kb-articles", json=article_payload(), headers=auth_headers)
    assert create.status_code == 201
    article_id = create.json()["id"]

    listed = client.get("/v1/kb-articles", params={"domain": "Knowledge Systems and RAG"})
    assert len(listed.json()) == 1

    update = client.put(
        f"/v1/kb-articles/{article_id}", json=article_payload(status="approved"), headers=auth_headers
    )
    assert update.status_code == 200
    assert update.json()["status"] == "approved"

    delete = client.delete(f"/v1/kb-articles/{article_id}", headers=auth_headers)
    assert delete.status_code == 204
    assert client.get(f"/v1/kb-articles/{article_id}").status_code == 404


def test_kb_articles_pagination_and_search(client, auth_headers):
    for title in ["Grounded generation", "Prompt injection defenses", "Hybrid retrieval"]:
        client.post("/v1/kb-articles", json=article_payload(title=title), headers=auth_headers)

    page = client.get("/v1/kb-articles", params={"limit": 1})
    assert page.status_code == 200
    assert len(page.json()) == 1
    assert page.headers["x-total-count"] == "3"

    search = client.get("/v1/kb-articles", params={"q": "injection"})
    assert len(search.json()) == 1
    assert search.json()[0]["title"] == "Prompt injection defenses"
