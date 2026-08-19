from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select


def paginate(db: Session, stmt: Select, response: Response, limit: int, offset: int) -> list:
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    response.headers["X-Total-Count"] = str(total)
    return db.execute(stmt.offset(offset).limit(limit)).scalars().all()
