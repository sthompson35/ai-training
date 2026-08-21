Personnel Roster

This directory is the production seed location for the Academy's canonical identity registry (see `README_UPDATED.md`, "Canonical Identity and Production Control — R2"). `07_PLATFORM/backend/app/seed.py`'s `_seed_personnel()` loads `personnel_roster.csv` (and, if present, `personnel_role_history_seed.csv`) from here into the `service_members` and `role_assignment_history` tables at startup, the same way `01_CURRICULUM/module_catalog.csv` seeds curriculum data.

**This directory now ships the real, sourced roster.** `personnel_roster.csv` and `personnel_role_history_seed.csv` are transcribed from *AI Training Academy™ Canonical Identity, Role Governance & Production Control Manual, R2.0* (effective 2026-08-09, Controlled Replacement Baseline, change decision `ATA-DEC-ID-2026-001`) — specifically Section 5, "Canonical Personnel Roster — 66 Controlled Identities," and the R1.0→R2.0 role promotions documented in Sections 3–4 for `@CINDY` and `@MAPE`. Every row's `source_lineage` field names this document. `legacy_alias` is left blank on every row: the manual states legacy `ATA-SM-001`…`ATA-SM-066` values exist as migration aliases but does not give an explicit callsign-to-number mapping, so no alias is fabricated.

This is a **reversal of the prior "ships empty by design" policy** that this file previously documented — that policy held only because no real roster existed yet. It now does.

**`production_verification_state` still starts, and stays, `unverified` for every seeded row.** Seeding has no acting admin, no verifier, and no separation-of-duties check to run (see "Controlled first-member onboarding" below), and the source manual's own Section 6, "Production Verification Rule," explicitly disposes all 8 verification gates (G1–G8) as `HOLD` as of R2.0 — this manual is a controlled replacement baseline for *identity and role governance*, not a claim that any identity has cleared runtime source access, enforced permissions, workflow control, telemetry, evidence, or independent verification. Real verification only happens through `POST /v1/service-members/{id}/verify` after boot, per identity, with evidence.

To add or correct roster entries beyond what's transcribed here, do one of:

- Replace or extend `personnel_roster.csv` (and optionally `personnel_role_history_seed.csv`) before first boot — `_seed_personnel()` picks it up automatically, and only runs while `service_members` is empty (it will not touch an already-provisioned deployment). Column schema: `service_member_id,callsign_id,callsign,display_name,member_class,current_role,command_layer,lifecycle_state,readiness_state,production_verification_state,legacy_alias,source_lineage`. The `production_verification_state` column is present for schema symmetry with the API's export format but is **ignored at seed time**, per the rule above. Verify seeded identities the same way as any other: through `POST /v1/service-members/{id}/verify` after boot (see "Independent verification" below).
- Use `POST /v1/service-members` or `POST /v1/service-members/import` (admin-only) once the platform is running, for either a one-off entry or a bulk CSV import.

Synthetic test/demo data (66 fabricated identities, including the named examples from the R2 spec — `@VICTOR`/`@TROOPER_VICTOR` as distinct entities, `@CINDY`/`@MAPE` with multi-version role history) lives under `07_PLATFORM/backend/tests/fixtures/synthetic_personnel/` instead. It exists to exercise the identity system in tests and local demos and must never be copied into this directory or otherwise treated as a real personnel record — every row's `source_lineage` field says so explicitly.

Names and roles that come up in prior Academy discussions, planning documents, or informal references beyond the 66 transcribed here are **discovery inputs, not personnel records** — they identify people or agents who may eventually need onboarding, but they do not become production identities by being mentioned. Nothing enters `service_members` except through the seed CSVs above or one of the two paths below.

## Onboarding identities beyond the transcribed 66

Additional real identities enter one at a time through `POST /v1/service-members` (admin-only, audited), or in bulk via `POST /v1/service-members/import`. Each `POST /v1/service-members` call already carries out this sequence — there is no separate onboarding subsystem to build, this *is* the governed workflow:

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
