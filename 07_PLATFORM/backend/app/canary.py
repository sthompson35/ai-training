"""Production identity canary.

This is an operational check, not a pytest fixture — it inspects whatever
database is actually configured via `DATABASE_URL` for the process running
it (the same one FastAPI itself connects to), never the synthetic test
fixtures under `tests/fixtures/synthetic_personnel/`.

R2's canonical identity registry starts empty (see `seed.py` — no roster is
fabricated to fill it) and only grows through the governed admin API
(`POST /v1/service-members`, `POST /v1/service-members/import`) or a real
roster CSV an operator drops into `11_PERSONNEL/`. This canary reports one
of three states accordingly:

  NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES
      Zero identities in the registry. This is the *correct* state until a
      governed roster or first real member exists — not a failure, and not
      something a bulk synthetic seed should ever be used to paper over.

  PASS
      One or more identities exist and satisfy the invariants below.

  FAIL
      One or more identities exist but violate an invariant. Because the
      production seed path can no longer be populated with synthetic data
      (11_PERSONNEL/ ships empty; only the governed API or an operator-
      supplied CSV can add rows), a FAIL here means a real defect in a real
      deployment — never a "missing data" false positive.

Usage: `python -m app.canary` (run in the environment/container whose
DATABASE_URL you want to check — e.g. `docker compose exec api python -m
app.canary`, or `make production-canary` from the repo root).
"""

import sys

from sqlalchemy import select

from . import orm
from .db import SessionLocal

NOT_APPLICABLE = "NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES"
PASS = "PASS"
FAIL = "FAIL"

_VALID_PRODUCTION_VERIFICATION_STATES = {"unverified", "verified", "revoked"}


def run_production_identity_canary() -> tuple[str, list[str]]:
    db = SessionLocal()
    try:
        members = db.execute(select(orm.ServiceMember)).scalars().all()
        if not members:
            return NOT_APPLICABLE, []

        verified_service_member_ids = set(
            db.execute(
                select(orm.IdentityVerification.service_member_id).where(
                    orm.IdentityVerification.outcome == "verified"
                )
            )
            .scalars()
            .all()
        )
    finally:
        db.close()

    problems: list[str] = []
    seen_ids: set[str] = set()
    seen_callsign_ids: set[str] = set()
    seen_callsigns: set[str] = set()

    for member in members:
        # Uniqueness is already DB-enforced (unique constraints/indexes) — this
        # re-checks it independently rather than trusting the schema, which is
        # the point of a canary.
        if member.service_member_id in seen_ids:
            problems.append(f"duplicate service_member_id: {member.service_member_id}")
        seen_ids.add(member.service_member_id)

        if member.callsign_id in seen_callsign_ids:
            problems.append(f"duplicate callsign_id: {member.callsign_id}")
        seen_callsign_ids.add(member.callsign_id)

        if member.callsign in seen_callsigns:
            problems.append(f"duplicate callsign: {member.callsign}")
        seen_callsigns.add(member.callsign)

        if not member.source_lineage:
            problems.append(
                f"{member.service_member_id} has no recorded source lineage — every "
                "governed identity should record how/why it entered the registry"
            )

        if member.production_verification_state not in _VALID_PRODUCTION_VERIFICATION_STATES:
            problems.append(
                f"{member.service_member_id} has an invalid production_verification_state: "
                f"{member.production_verification_state!r}"
            )

        if member.production_verification_state == "verified" and member.service_member_id not in verified_service_member_ids:
            problems.append(
                f"{member.service_member_id} is labeled 'verified' with no backing "
                "identity_verifications record — an ungoverned label, not a governed verification"
            )

    return (FAIL if problems else PASS), problems


if __name__ == "__main__":
    status, problems = run_production_identity_canary()
    print(f"PRODUCTION_IDENTITY_CANARY = {status}")
    for problem in problems:
        print(f"  - {problem}")
    sys.exit(1 if status == FAIL else 0)
