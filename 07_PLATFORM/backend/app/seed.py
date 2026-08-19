import csv
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import orm
from .auth import hash_password

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
SEED_CERT_DIR = Path(__file__).resolve().parent.parent / "seed_cert"
SEED_KB_DIR = Path(__file__).resolve().parent.parent / "seed_kb"
SEED_GOVERNANCE_DIR = Path(__file__).resolve().parent.parent / "seed_governance"
SEED_PERSONNEL_DIR = Path(__file__).resolve().parent.parent / "seed_personnel"

ADMIN_LINKED_SERVICE_MEMBER_ID = "ATA-ATLAS-000"

RACI_ROLE_COLUMNS = {
    "executive_sponsor": "Executive Sponsor",
    "academy_owner": "Academy Owner",
    "ai_architect": "AI Architect",
    "security_owner": "Security Owner",
    "certification_board": "Certification Board",
}


def seed_if_empty(db: Session) -> None:
    _seed_curriculum(db)
    _seed_certifications(db)
    _seed_glossary(db)
    _seed_governance_raci(db)
    _seed_personnel(db)
    _seed_admin_user(db)


def _seed_curriculum(db: Session) -> None:
    if db.execute(select(orm.Level.id)).first() is not None:
        return

    module_catalog = SEED_DIR / "module_catalog.csv"
    lab_catalog = SEED_DIR / "lab_catalog.csv"
    if not module_catalog.exists() or not lab_catalog.exists():
        return

    levels: dict[str, orm.Level] = {}
    with module_catalog.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            level_id = row["level"]
            if level_id not in levels:
                levels[level_id] = orm.Level(id=level_id, title=row["level_title"])
                db.add(levels[level_id])

            db.add(
                orm.Module(
                    id=row["module_code"],
                    level_id=level_id,
                    title=row["module_title"],
                    learning_outcome=row["learning_outcome"],
                    estimated_hours=int(row["estimated_hours"]),
                    assessment=row["assessment"],
                )
            )

    with lab_catalog.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            db.add(
                orm.Lab(
                    id=row["lab_id"],
                    title=row["title"],
                    domain=row["domain"],
                    deliverable=row["deliverable"],
                )
            )

    db.commit()


def _seed_certifications(db: Session) -> None:
    if db.execute(select(orm.Certification.code)).first() is not None:
        return

    assessment_blueprints = SEED_CERT_DIR / "assessment_blueprints.csv"
    if not assessment_blueprints.exists():
        return

    with assessment_blueprints.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            db.add(
                orm.Certification(
                    code=row["code"],
                    title=row["certification"],
                    required_levels=row["required_levels"],
                    written_questions=int(row["written_questions"]),
                    practical=row["practical"],
                    passing_percent=int(row["passing_percent"]),
                    recert_months=int(row["recert_months"]),
                )
            )

    db.commit()


def _seed_glossary(db: Session) -> None:
    if db.execute(select(orm.GlossaryTerm.term)).first() is not None:
        return

    glossary = SEED_KB_DIR / "glossary.csv"
    if not glossary.exists():
        return

    with glossary.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            db.add(orm.GlossaryTerm(term=row["term"], definition=row["definition"]))

    db.commit()


def _seed_governance_raci(db: Session) -> None:
    if db.execute(select(orm.RaciEntry.id)).first() is not None:
        return

    governance_raci = SEED_GOVERNANCE_DIR / "governance_raci.csv"
    if not governance_raci.exists():
        return

    with governance_raci.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            activity = row["activity"]
            for column, role_name in RACI_ROLE_COLUMNS.items():
                db.add(
                    orm.RaciEntry(activity=activity, role=role_name, responsibility=row[column])
                )

    db.commit()


def _seed_personnel(db: Session) -> None:
    if db.execute(select(orm.ServiceMember.service_member_id)).first() is not None:
        return

    roster_csv = SEED_PERSONNEL_DIR / "personnel_roster.csv"
    history_csv = SEED_PERSONNEL_DIR / "personnel_role_history_seed.csv"
    if not roster_csv.exists():
        return

    members: dict[str, orm.ServiceMember] = {}
    with roster_csv.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            member = orm.ServiceMember(
                service_member_id=row["service_member_id"],
                callsign_id=row["callsign_id"],
                callsign=row["callsign"],
                display_name=row["display_name"],
                member_class=row["member_class"],
                current_role=row["current_role"],
                command_layer=row["command_layer"],
                lifecycle_state=row["lifecycle_state"],
                readiness_state=row["readiness_state"],
                # Never taken from the CSV: seeding has no acting admin, no
                # verifier, no separation-of-duties check to run — exactly the
                # conditions the governed POST /{id}/verify endpoint requires.
                # A seeded row can only become "verified" the same way any
                # other identity does: through that endpoint, after boot.
                production_verification_state="unverified",
                legacy_alias=row["legacy_alias"] or None,
                source_lineage=row["source_lineage"],
            )
            db.add(member)
            members[member.service_member_id] = member
            db.add(
                orm.RoleAssignmentHistory(
                    service_member_id=member.service_member_id,
                    role_version=1,
                    role=member.current_role,
                    command_layer=member.command_layer,
                    readiness_state=member.readiness_state,
                    change_reason="Initial roster seed",
                )
            )
    db.commit()

    if history_csv.exists():
        with history_csv.open(newline="", encoding="utf-8") as f:
            # Promotions must be applied in ascending role_version order per
            # identity so current_role/role_version end up at the latest state.
            promotion_rows = sorted(csv.DictReader(f), key=lambda r: (r["service_member_id"], int(r["role_version"])))
        for row in promotion_rows:
            member = members.get(row["service_member_id"]) or db.get(orm.ServiceMember, row["service_member_id"])
            if member is None:
                continue
            member.current_role = row["role"]
            member.command_layer = row["command_layer"]
            member.readiness_state = row["readiness_state"]
            member.role_version = int(row["role_version"])
            db.add(
                orm.RoleAssignmentHistory(
                    service_member_id=member.service_member_id,
                    role_version=member.role_version,
                    role=row["role"],
                    command_layer=row["command_layer"],
                    readiness_state=row["readiness_state"],
                    change_reason=row["change_reason"] or None,
                )
            )
        db.commit()


def _seed_admin_user(db: Session) -> None:
    linked_id = (
        ADMIN_LINKED_SERVICE_MEMBER_ID
        if db.get(orm.ServiceMember, ADMIN_LINKED_SERVICE_MEMBER_ID) is not None
        else None
    )

    if db.execute(select(orm.User.id)).first() is not None:
        # Users already exist — this is an already-provisioned deployment, not
        # a fresh seed. Still backfill the bootstrap admin's canonical link if
        # it's unset (e.g. this volume was provisioned before personnel
        # seeding existed): same one-off-patch spirit as main.py's persisted-
        # volume column backfills, not a general re-seed.
        if linked_id is not None:
            admin = db.execute(
                select(orm.User).where(orm.User.username == "admin", orm.User.service_member_id.is_(None))
            ).scalar_one_or_none()
            if admin is not None:
                admin.service_member_id = linked_id
                db.commit()
        return

    db.add(
        orm.User(
            username="admin",
            password_hash=hash_password("admin"),
            role="admin",
            service_member_id=linked_id,
        )
    )
    db.commit()
