# AI Training Academy — Iteration 8 Live Evidence Audit

Audit date: 2026-08-09
Evidence package SHA-256: `740f975c4d6a83af85f91fd70b4c6be5960968699663fe4b46027f4c89879097`
Input: `ai-training.zip`

## Executive disposition

**PRODUCTION PROMOTION: HOLD**

The evidence package contains a documented canonical identity contract in `README_UPDATED.md`, but the runtime/backend implementation has not yet implemented the required canonical Service Member, callsign, alias, role-assignment, deployment, telemetry, evidence, and verification data model.

## Evidence inventory

- Total files in ZIP after extraction: 6,390
- Non-vendored/non-build files in Institutional Standard v2 package: 218
- Institutional package manifest version: 2.0.0
- Updated README version: 2.1.0
- Canonical identity implementation references found outside README_UPDATED.md: none in source-code/config search
- Database dump / SQL migration files found: none

## Gate results

| Gate | Result | Evidence finding |
|---|---|---|
| Canonical identity contract documented | PASS | README_UPDATED.md defines service_member_id, callsign_id, exact callsign, legacy alias semantics and exact routing. |
| Canonical identity schema implemented | FAIL | Backend `orm.AgentCard` uses integer `id` and unique `name`; no canonical entity/service-member/callsign tables. |
| Master Service Member ID uniqueness enforced | FAIL | No `service_member_id` column or DB constraint found. |
| Callsign ID uniqueness enforced | FAIL | No `callsign_id` column or DB constraint found. |
| Exact callsign uniqueness enforced | FAIL | No callsign table/constraint found. |
| Legacy alias migration implemented | FAIL | No legacy identifier/alias table or migration found. |
| New sequential ID issuance blocked | FAIL | No issuance control exists in runtime schema/API. |
| Canonical ID immutability enforced | FAIL | Canonical ID does not exist in runtime data model. |
| Role history preserved as versioned assignments | FAIL | Agent cards hold descriptive fields; no versioned role-assignment table found. |
| Victor/Trooper Victor exact-routing canary | NOT RUNNABLE | Runtime canonical identity resolver is absent. |
| FK integrity for canonical identity model | NOT RUNNABLE | Required canonical tables/FKs are absent. |
| Audit logging exists | PARTIAL | HTTP mutation audit logging exists, but records username/method/path/status only and is not linked to service_member_id/task/evidence. |
| Real canonical telemetry | FAIL | No canonical identity telemetry contract found. |
| Evidence registry | FAIL | No evidence registry/table found. |
| Independent verification registry | FAIL | No verification registry/table found. |
| Automated backend test suite | BLOCKED | Initial pytest failed without PYTHONPATH; with PYTHONPATH it failed because required `bcrypt` dependency is unavailable in audit sandbox. |
| Release manifest alignment | FAIL | manifest.json reports 2.0.0 while README_UPDATED.md reports current package 2.1.0. |
| Release secret hygiene | REVIEW REQUIRED | `.env` is present in the ZIP although `.gitignore` excludes `.env`; values were not exposed in this audit. |

## Concrete runtime findings

### Current agent identity model

`agent_cards` currently uses:

- integer autoincrement primary key `id`
- unique `name`
- owner/version/purpose/risk/tools/data-access/action-permissions fields
- mutable update endpoint
- physical delete endpoint

This conflicts with the R2/R2.1 canonical identity doctrine requiring immutable canonical identity with separate versioned dependent records.

### Current audit model

`audit_log` currently records:

- timestamp
- username
- HTTP method
- path
- status code

It does not currently record canonical service member ID, callsign ID, role assignment, task/correlation ID, evidence ID, before/after state, or identity resolution method.

### Current seeding model

`seed.py` seeds curriculum, certification, glossary, governance RACI, and an admin user. It does not seed the canonical 66-member roster or legacy alias crosswalk.

### Current routing model

No runtime identity resolver implementing:

1. master service member ID
2. callsign ID
3. exact callsign
4. approved legacy alias
5. fail

was found in the backend source.

## Required remediation before cutover certification

1. Add canonical registry tables and migrations.
2. Populate the 66-member canonical roster from the controlled R2 roster source.
3. Add the 66 legacy `ATA-SM-NNN` aliases with one-to-one canonical targets.
4. Add exact callsign normalization and uniqueness constraints.
5. Add immutable canonical ID controls and prohibit destructive identity deletion.
6. Add versioned role/duty assignment tables and migrate Cindy/Mape history.
7. Add exact identity resolver and explicit Victor/Trooper Victor collision tests.
8. Update all workflow/audit/incident/release/telemetry/evidence records to reference canonical `service_member_id`.
9. Add positive and negative identity canaries.
10. Update manifest to 2.1.0+ and regenerate file hashes after implementation.
11. Remove `.env` from release artifacts unless an explicit controlled-release policy requires it; rotate any live credentials if this package was externally distributed.
12. Run the full test suite in a dependency-complete environment and retain output as evidence.
13. Run database uniqueness/FK/immutability assertions on the target Postgres environment.
14. Produce independent verification evidence before `PRODUCTION_VERIFIED` promotion.

## Current certification state

`IDENTITY_CONTRACT_DOCUMENTED = PASS`

`LIVE_REGISTRY_CUTOVER = FAIL / NOT IMPLEMENTED`

`DATABASE_CONSTRAINT_TEST = NOT RUNNABLE FOR CANONICAL MODEL`

`ALIAS_MIGRATION = NOT IMPLEMENTED`

`RUNTIME_IDENTITY_CANARY = NOT RUNNABLE`

`PRODUCTION_VERIFIED = NO`
