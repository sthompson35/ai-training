from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm, schemas
from .db import get_db

router = APIRouter(prefix="/v1", tags=["search"])

# Kept small: this is a nav-bar type-ahead, not a paginated results page — five
# hits per entity type is plenty to tell the user "yes, it's over there" and
# points them at the right list page's own (unbounded) search box.
_PER_TYPE_LIMIT = 5


@router.get("/search", response_model=list[schemas.SearchResultOut])
def search_all(q: str = Query(default=""), db: Session = Depends(get_db)):
    q = q.strip()
    if len(q) < 2:
        return []
    like = f"%{q}%"
    results: list[schemas.SearchResultOut] = []

    levels = (
        db.execute(
            select(orm.Level).where(orm.Level.title.ilike(like)).order_by(orm.Level.title).limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(type="level", id=r.id, title=r.title, path=f"/levels/{r.id}") for r in levels
    ]

    modules = (
        db.execute(
            select(orm.Module)
            .where(orm.Module.title.ilike(like) | orm.Module.learning_outcome.ilike(like))
            .order_by(orm.Module.title)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="module", id=r.id, title=r.title, subtitle=f"Level {r.level_id}", path=f"/levels/{r.level_id}"
        )
        for r in modules
    ]

    labs = (
        db.execute(
            select(orm.Lab)
            .where(orm.Lab.title.ilike(like) | orm.Lab.domain.ilike(like))
            .order_by(orm.Lab.title)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(type="lab", id=r.id, title=r.title, subtitle=r.domain, path="/labs") for r in labs
    ]

    certifications = (
        db.execute(
            select(orm.Certification)
            .where(orm.Certification.title.ilike(like) | orm.Certification.code.ilike(like))
            .order_by(orm.Certification.title)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="certification", id=r.code, title=r.title, subtitle=r.code, path=f"/certifications/{r.code}"
        )
        for r in certifications
    ]

    learners = (
        db.execute(
            select(orm.Learner)
            .where(orm.Learner.name.ilike(like) | orm.Learner.email.ilike(like))
            .order_by(orm.Learner.name)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="learner", id=str(r.id), title=r.name, subtitle=r.email, path=f"/learners/{r.id}"
        )
        for r in learners
    ]

    glossary = (
        db.execute(
            select(orm.GlossaryTerm)
            .where(orm.GlossaryTerm.term.ilike(like) | orm.GlossaryTerm.definition.ilike(like))
            .order_by(orm.GlossaryTerm.term)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(type="glossary", id=r.term, title=r.term, path="/glossary") for r in glossary
    ]

    kb_articles = (
        db.execute(
            select(orm.KBArticle)
            .where(orm.KBArticle.title.ilike(like) | orm.KBArticle.domain.ilike(like))
            .order_by(orm.KBArticle.title)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="kb_article", id=str(r.id), title=r.title, subtitle=r.domain, path=f"/knowledge-base/{r.id}"
        )
        for r in kb_articles
    ]

    agents = (
        db.execute(
            select(orm.AgentCard)
            .where(orm.AgentCard.name.ilike(like) | orm.AgentCard.purpose.ilike(like))
            .order_by(orm.AgentCard.name)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="agent", id=str(r.id), title=r.name, subtitle=r.owner, path=f"/agents/{r.id}"
        )
        for r in agents
    ]

    incidents = (
        db.execute(
            select(orm.Incident)
            .where(orm.Incident.title.ilike(like) | orm.Incident.description.ilike(like))
            .order_by(orm.Incident.title)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="incident",
            id=str(r.id),
            title=r.title,
            subtitle=f"{r.severity} / {r.status}",
            path=f"/incidents/{r.id}",
        )
        for r in incidents
    ]

    releases = (
        db.execute(
            select(orm.Release)
            .where(orm.Release.title.ilike(like) | orm.Release.version.ilike(like))
            .order_by(orm.Release.title)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="release", id=str(r.id), title=r.title, subtitle=r.status, path=f"/releases/{r.id}"
        )
        for r in releases
    ]

    raci_entries = (
        db.execute(
            select(orm.RaciEntry)
            .where(orm.RaciEntry.activity.ilike(like) | orm.RaciEntry.role.ilike(like))
            .order_by(orm.RaciEntry.activity)
            .limit(_PER_TYPE_LIMIT)
        )
        .scalars()
        .all()
    )
    results += [
        schemas.SearchResultOut(
            type="raci", id=str(r.id), title=r.activity, subtitle=r.role, path="/governance"
        )
        for r in raci_entries
    ]

    return results
