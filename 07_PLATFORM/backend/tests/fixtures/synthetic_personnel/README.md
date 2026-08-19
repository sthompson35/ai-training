Synthetic personnel fixtures — test/demo use only.

`personnel_roster.csv` and `personnel_role_history_seed.csv` here are the same
66-identity fabricated roster described in `11_PERSONNEL/Personnel_Roster.md`
(every row's `source_lineage` says so explicitly), relocated to this
tests-only directory so it can never be mistaken for, or accidentally ship as,
the production seed. `test_service_members.py` points `seed.SEED_PERSONNEL_DIR`
at this directory to exercise the seeding/idempotency/role-versioning logic
without touching real data.

The production seed location (`11_PERSONNEL/`) ships empty by default —
`service_members` starts with zero rows on a fresh deployment, same as
`agent_cards`, `incidents`, and `releases`. Do not copy these files there.
