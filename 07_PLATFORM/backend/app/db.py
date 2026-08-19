import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///:memory:")

_is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}
# StaticPool: an in-memory SQLite DB is one connection's worth of state. Without
# this, SQLAlchemy's default SingletonThreadPool hands each new thread a fresh,
# empty database — and FastAPI runs sync endpoints in an anyio threadpool thread,
# not the thread that ran Base.metadata.create_all() at startup. Only relevant
# when DATABASE_URL is unset (falling back to sqlite); Postgres is unaffected.
poolclass = StaticPool if _is_sqlite else None
engine = create_engine(DATABASE_URL, connect_args=connect_args, poolclass=poolclass)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
