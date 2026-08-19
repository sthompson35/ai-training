Personnel Roster

This directory is the production seed location for the Academy's canonical identity registry (see `README_UPDATED.md`, "Canonical Identity and Production Control — R2"). `07_PLATFORM/backend/app/seed.py`'s `_seed_personnel()` loads `personnel_roster.csv` (and, if present, `personnel_role_history_seed.csv`) from here into the `service_members` and `role_assignment_history` tables at startup, the same way `01_CURRICULUM/module_catalog.csv` seeds curriculum data.

No governed roster exists in this repository. This directory intentionally ships empty of data: `service_members` starts empty on a fresh deployment, exactly like `agent_cards`, `incidents`, and `releases` already do — it does not seed placeholder or synthetic identities into what could become a real production database.

To populate the registry, do one of:

- Drop a real `personnel_roster.csv` (and optionally `personnel_role_history_seed.csv`) into this directory before first boot — `_seed_personnel()` picks it up automatically. Column schema: `service_member_id,callsign_id,callsign,display_name,member_class,current_role,command_layer,lifecycle_state,readiness_state,production_verification_state,legacy_alias,source_lineage`. The `production_verification_state` column is present for schema symmetry with the API's export format but is **ignored at seed time** — every seeded row starts `unverified` regardless of what the column says, because seeding has no acting admin, no verifier, and no separation-of-duties check to run. Verify seeded identities the same way as any other: through `POST /v1/service-members/{id}/verify` after boot (see "Independent verification" below).
- Use `POST /v1/service-members` or `POST /v1/service-members/import` (admin-only) once the platform is running, for either a one-off entry or a bulk CSV import.

Synthetic test/demo data (66 fabricated identities, including the named examples from the R2 spec — `@VICTOR`/`@TROOPER_VICTOR` as distinct entities, `@CINDY`/`@MAPE` with multi-version role history) lives under `07_PLATFORM/backend/tests/fixtures/synthetic_personnel/` instead. It exists to exercise the identity system in tests and local demos and must never be copied into this directory or otherwise treated as a real personnel record — every row's `source_lineage` field says so explicitly.

Names and roles that come up in prior Academy discussions, planning documents, or informal references are **discovery inputs, not personnel records** — they identify people who may eventually need onboarding, but they do not become production identities by being mentioned. Nothing enters `service_members` except through one of the two paths above.

## Controlled first-member onboarding

Until a bulk roster exists, real identities enter one at a time through `POST /v1/service-members` (admin-only, audited). Each call already carries out this sequence — there is no separate onboarding subsystem to build, this *is* the governed workflow:

| Step | Where it happens |
|---|---|
| Identity request | The `POST /v1/service-members` request itself |
| Source/authority validation | Whatever approval process led an admin to submit it (organizationally, not enforced by the API) — record it in `source_lineage` |
| Duplicate check | Server-side `409` on any `service_member_id`/`callsign_id`/`callsign`/`legacy_alias` collision |
| Canonical ID issuance | `service_member_id`/`callsign_id`/`callsign` supplied in the request, validated for uniqueness on write |
| Callsign assignment | Same — part of the create payload |
| Role assignment | `current_role`/`command_layer` in the create payload; `role_version` starts at `1` with one `role_assignment_history` row recorded automatically |
| Permission/approval | The endpoint itself is `admin`-only — no other role can create an identity |
| Activation | `lifecycle_state` defaults to `active` |
| Telemetry/evidence | The mutation is written to `audit_log` like every other admin action; `source_lineage` is the durable evidence field on the record itself |
| Independent verification | A **separate, later** step, through its own endpoint — `POST /v1/service-members/{id}/verify`, never the generic update. Requires an evidence reference, a verification method, and an outcome; the verifier is always the caller's own linked identity, never a free-text field, and separation of duties is enforced server-side (an identity cannot verify itself or verify a record it created). Onboarding an identity does not imply it's verified — `production_verification_state` starts, and stays, `unverified` until this endpoint says otherwise. |

Run `make production-canary` (or `python -m app.canary` inside the `api` container) to check the current state of a deployment's registry: it reports `NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES` while empty, and validates real records once any exist — including that every `verified` identity has a backing `identity_verifications` record, not just the label.
