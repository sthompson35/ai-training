from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .audit import log_audit_event
from .auth import get_current_user
from .csv_export import csv_response
from .csv_import import parse_csv_rows
from .db import get_db
from .pagination import paginate

router = APIRouter(prefix="/v1", tags=["knowledge-base"])


@router.get("/glossary", response_model=list[schemas.GlossaryTermOut])
def list_glossary(db: Session = Depends(get_db)):
    return db.execute(select(orm.GlossaryTerm).order_by(orm.GlossaryTerm.term)).scalars().all()


@router.get("/glossary/export")
def export_glossary(db: Session = Depends(get_db)):
    rows = db.execute(select(orm.GlossaryTerm).order_by(orm.GlossaryTerm.term)).scalars().all()
    return csv_response(
        [schemas.GlossaryTermOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.GlossaryTermOut.model_fields),
        filename="glossary.csv",
    )


@router.post("/glossary", response_model=schemas.GlossaryTermOut, status_code=201)
def create_glossary_term(
    payload: schemas.GlossaryTermCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    if db.get(orm.GlossaryTerm, payload.term) is not None:
        raise HTTPException(status_code=409, detail="Term already exists")
    term = orm.GlossaryTerm(**payload.model_dump())
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.post("/glossary/import", response_model=schemas.ImportResult)
async def import_glossary(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.GlossaryTermCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        if db.get(orm.GlossaryTerm, payload.term) is not None:
            skipped.append({"row": i, "reason": f"Term {payload.term} already exists"})
            continue
        db.add(orm.GlossaryTerm(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/glossary/{term}", response_model=schemas.GlossaryTermOut)
def update_glossary_term(
    term: str,
    payload: schemas.GlossaryTermUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    existing = db.get(orm.GlossaryTerm, term)
    if existing is None:
        raise HTTPException(status_code=404, detail="Term not found")
    existing.definition = payload.definition
    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/glossary/{term}", status_code=204)
def delete_glossary_term(
    term: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    existing = db.get(orm.GlossaryTerm, term)
    if existing is None:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(existing)
    db.commit()


@router.post("/glossary/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_glossary(
    payload: schemas.BulkDeleteRequestStr,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for term in payload.ids:
        existing = db.get(orm.GlossaryTerm, term)
        if existing is None:
            skipped.append({"id": term, "reason": "Not found"})
            continue
        db.delete(existing)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


def _kb_article_query(domain: str | None, status: str | None, q: str | None):
    stmt = select(orm.KBArticle).order_by(orm.KBArticle.id)
    if domain:
        stmt = stmt.where(orm.KBArticle.domain == domain)
    if status:
        stmt = stmt.where(orm.KBArticle.status == status)
    if q:
        stmt = stmt.where(orm.KBArticle.title.ilike(f"%{q}%"))
    return stmt


@router.get("/kb-articles", response_model=list[schemas.KBArticleOut])
def list_kb_articles(
    response: Response,
    domain: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginate(db, _kb_article_query(domain, status, q), response, limit, offset)


@router.get("/kb-articles/export")
def export_kb_articles(
    domain: str | None = None,
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(_kb_article_query(domain, status, q)).scalars().all()
    return csv_response(
        [schemas.KBArticleOut.model_validate(row) for row in rows],
        fieldnames=list(schemas.KBArticleOut.model_fields),
        filename="kb_articles.csv",
    )


@router.get("/kb-articles/{article_id}", response_model=schemas.KBArticleOut)
def get_kb_article(article_id: int, db: Session = Depends(get_db)):
    article = db.get(orm.KBArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.post("/kb-articles", response_model=schemas.KBArticleOut, status_code=201)
def create_kb_article(
    payload: schemas.KBArticleCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    article = orm.KBArticle(**payload.model_dump())
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.post("/kb-articles/import", response_model=schemas.ImportResult)
async def import_kb_articles(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    created = 0
    skipped: list[dict] = []
    for i, row in enumerate(await parse_csv_rows(file), start=2):
        try:
            payload = schemas.KBArticleCreate(**row)
        except ValidationError as exc:
            skipped.append({"row": i, "reason": str(exc)})
            continue
        db.add(orm.KBArticle(**payload.model_dump()))
        created += 1
    db.commit()
    return schemas.ImportResult(created=created, skipped=skipped)


@router.put("/kb-articles/{article_id}", response_model=schemas.KBArticleOut)
def update_kb_article(
    article_id: int,
    payload: schemas.KBArticleUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    article = db.get(orm.KBArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    for field, value in payload.model_dump().items():
        setattr(article, field, value)
    db.commit()
    db.refresh(article)
    return article


@router.delete("/kb-articles/{article_id}", status_code=204)
def delete_kb_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    article = db.get(orm.KBArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(article)
    db.commit()


@router.post("/kb-articles/bulk-delete", response_model=schemas.BulkDeleteResult)
def bulk_delete_kb_articles(
    payload: schemas.BulkDeleteRequestInt,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    deleted = 0
    skipped: list[dict] = []
    for article_id in payload.ids:
        article = db.get(orm.KBArticle, article_id)
        if article is None:
            skipped.append({"id": str(article_id), "reason": "Not found"})
            continue
        db.delete(article)
        deleted += 1
    db.commit()
    return schemas.BulkDeleteResult(deleted=deleted, skipped=skipped)


@router.post("/kb-articles/bulk-update-status", response_model=schemas.BulkUpdateResult)
def bulk_update_kb_article_status(
    payload: schemas.BulkUpdateKBArticleStatusRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _audit: None = Depends(log_audit_event),
):
    updated = 0
    skipped: list[dict] = []
    for article_id in payload.ids:
        article = db.get(orm.KBArticle, article_id)
        if article is None:
            skipped.append({"id": str(article_id), "reason": "Not found"})
            continue
        article.status = payload.status
        updated += 1
    db.commit()
    return schemas.BulkUpdateResult(updated=updated, skipped=skipped)
