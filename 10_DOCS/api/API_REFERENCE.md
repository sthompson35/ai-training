# API Reference

All endpoints are served by the `api` service and are also reachable through the gateway at `/api/*` (see `08_INFRASTRUCTURE/nginx/default.conf`). All request/response bodies are JSON.

## Authentication

All GET endpoints are public. Every POST/PUT/DELETE across Curriculum, Certification, Knowledge base, and Agents requires a bearer token.

### POST /v1/auth/login

Body: `{username, password}`. Returns `{access_token, token_type: "bearer", username, role}` on success, `401` on bad credentials.

Send the token on mutating requests: `Authorization: Bearer <access_token>`. Tokens are stateless JWTs signed with `AUTH_SECRET_KEY`, expiring after `AUTH_TOKEN_EXPIRE_MINUTES` (default 1440). A default `admin`/`admin` account is seeded on first boot — see the README's Quick Start for how to change it.

Login attempts are rate-limited to `LOGIN_RATE_LIMIT_PER_MINUTE` (default 5) per client IP — a brute-force deterrent. If you hit it while testing (e.g. mistyping the password a few times), wait a minute and try again.

## Rate limiting

Every mutating request (and `POST /v1/route`, since it needs no auth) is limited to `RATE_LIMIT_PER_MINUTE` (default 60) per minute, keyed by the authenticated username where available and by client IP otherwise. Login attempts specifically use the stricter `LOGIN_RATE_LIMIT_PER_MINUTE` (default 5). Exceeding either returns `429` with a `Retry-After` header (seconds). GET requests are never rate-limited.

This is in-memory, per-process state — fine at this project's single-instance scale, but it means a multi-replica deployment (see the k8s manifest's `replicas: 2`) enforces the limit per-pod, not globally. A real deployment needing an exact global limit would back this with a shared store (e.g. Redis) instead.

## Pagination and search

The six collections that grow through normal use — `/v1/learners`, `/v1/kb-articles`, `/v1/agents`, `/v1/service-members`, `/v1/incidents`, `/v1/releases` — all accept:

- `q`: case-insensitive partial match on the collection's primary text field (`name` for learners/agents, `title` for kb-articles/incidents/releases).
- `limit` (default 20, max 100) and `offset` (default 0).

The response body stays a plain array (capped at `limit`); the total match count (before pagination, after any filters) rides on the `X-Total-Count` response header. The bounded reference-data endpoints (levels, modules, labs, certifications, glossary, governance RACI) don't paginate — they're small by the curriculum's own design.

## CSV export

Every list endpoint in this API has a sibling `GET /v1/{resource}/export` (e.g. `/v1/incidents/export`, `/v1/users/export`) that returns the full matching set as `text/csv` with a `Content-Disposition: attachment` header — no `limit`/`offset` (a report shouldn't silently truncate), but the same filters as the list endpoint (`q`, `status`, `severity`, etc., where applicable). Auth requirements mirror the corresponding list endpoint exactly — most are public, `/v1/audit-log/export` requires any authenticated user, `/v1/users/export` requires `admin`.

## CSV import

Bulk-create records from an uploaded CSV (`multipart/form-data`, field name `file`) via `POST /v1/{resource}/import`, for every resource that has a create endpoint at all — that's everything **except** Levels, Certifications (both seed-only, never user-created), and the Audit Log (system-generated, immutable). Column headers match that resource's create fields (the same shape its own `/export` produces, so exporting, editing, and re-importing round-trips cleanly).

Rows are processed independently, not as one all-or-nothing transaction — a malformed or duplicate row is skipped and reported, not fatal to the rest of the file. The response is always:
```json
{"created": 8, "skipped": [{"row": 4, "reason": "A learner with this email already exists"}]}
```
`row` is 1-indexed against what you'd see opening the file in a spreadsheet (row 1 is the header, row 2 the first data row). Auth requirements mirror the resource's existing `POST` endpoint exactly (`/v1/users/import` requires `admin`, same as creating a single user).

**`/v1/users/import` needs a plaintext `password` column** — that's what account creation requires. Treat the CSV file itself as sensitive for as long as it exists on disk, the same way this project already flags `AUTH_SECRET_KEY`'s dev-only default elsewhere in these docs.

## GET /health

Returns process health.

## GET /ready

Returns policy and local-AI readiness information.

## POST /v1/route

### Request

```json
{
  "task_type": "summarization",
  "input_chars": 1800,
  "requires_current_data": false,
  "contains_sensitive_data": true,
  "network_quality": "good",
  "client_ai_available": true,
  "risk_tier": 1
}
```

### Response

```json
{
  "route": "client",
  "reason": "Sensitive, bounded task with local capability available.",
  "degraded_mode": false,
  "requires_human_approval": false,
  "policy_version": "2.0.0"
}
```

## Curriculum

Backed by Postgres, seeded on startup from `01_CURRICULUM/module_catalog.csv` and `lab_catalog.csv`.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/levels` | List all curriculum levels. |
| GET | `/v1/levels/{level_id}` | Level detail, including its modules. |
| GET | `/v1/modules` | List modules. Optional `?level_id=` filter. |
| GET | `/v1/modules/{module_id}` | Module detail. |
| POST | `/v1/modules` | Create a module. Body: `{id, level_id, title, learning_outcome, estimated_hours, assessment}`. 422 if `level_id` is unknown. |
| PUT | `/v1/modules/{module_id}` | Update a module (all fields except `id`/`level_id`). |
| DELETE | `/v1/modules/{module_id}` | Delete a module. |
| GET | `/v1/labs` | List labs. Optional `?domain=` filter. |
| POST | `/v1/labs` | Create a lab. Body: `{id, title, domain, deliverable}`. |
| PUT | `/v1/labs/{lab_id}` | Update a lab. |
| DELETE | `/v1/labs/{lab_id}` | Delete a lab. |

## Certification

Backed by Postgres. `certifications` are seeded from `02_CERTIFICATION/assessment_blueprints.csv`; `learners` and `enrollments` start empty.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/certifications` | List the six certification tiers. |
| GET | `/v1/certifications/{code}` | Tier detail, including its enrollments. |
| GET | `/v1/learners` | List learners. |
| POST | `/v1/learners` | Create a learner. Body: `{name, email}`. 409 on duplicate email. |
| GET | `/v1/learners/{learner_id}` | Learner detail, including their enrollments. |
| DELETE | `/v1/learners/{learner_id}` | Delete a learner (cascades to their enrollments). |
| GET | `/v1/enrollments` | List enrollments. Optional `?certification_code=` and/or `?learner_id=` filters. |
| POST | `/v1/enrollments` | Enroll a learner in a tier. Body: `{learner_id, certification_code}`. Starts at status `enrolled`. 422 if either id is unknown. |
| PUT | `/v1/enrollments/{id}` | Update status/score/notes. Body: `{status, written_score, notes}`. `status` is one of `enrolled, written_passed, practical_submitted, practical_passed, board_review, certified, failed`. |
| DELETE | `/v1/enrollments/{id}` | Remove an enrollment. |

## Knowledge base

Backed by Postgres. `glossary_terms` are seeded from `04_KNOWLEDGE_BASE/glossary.csv`; `kb_articles` start empty (the source taxonomy lists domain/module names, not article content).

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/glossary` | List glossary terms. |
| POST | `/v1/glossary` | Create a term. Body: `{term, definition}`. 409 on duplicate term. |
| PUT | `/v1/glossary/{term}` | Update a term's definition. |
| DELETE | `/v1/glossary/{term}` | Delete a term. |
| GET | `/v1/kb-articles` | List articles. Optional `?domain=` and/or `?status=` filters. |
| GET | `/v1/kb-articles/{id}` | Article detail. |
| POST | `/v1/kb-articles` | Create an article — see field list below. |
| PUT | `/v1/kb-articles/{id}` | Update an article (full replace of all fields). |
| DELETE | `/v1/kb-articles/{id}` | Delete an article. |

Article fields (the Knowledge Article Standard from `04_KNOWLEDGE_BASE/Knowledge_Base_Index.md`): `title, domain, content_type, status, owner, review_date, version, definition, why_it_matters, when_to_use, when_not_to_use, architecture, inputs_and_outputs, risks_and_controls, examples, evaluation_criteria, sources`.

- `content_type`: `definition, lesson, lab, SOP, decision_record, evaluation, incident, model_card, tool_card`
- `status`: `draft, review, approved, deprecated, archived`

## Agents

Backed by Postgres. `agent_cards` start empty — this operationalizes the `05_TEMPLATES/agent_card.md` template as live records.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/agents` | List registered agents. |
| GET | `/v1/agents/{id}` | Agent detail. |
| POST | `/v1/agents` | Register an agent — see field list below. 409 on duplicate name. |
| PUT | `/v1/agents/{id}` | Update an agent (full replace of all fields, including `active` and `approval_status`). |
| DELETE | `/v1/agents/{id}` | Remove an agent. |

Agent card fields: `name, owner, service_member_id, version, purpose, non_goals, risk_tier, approved_models, approved_tools, data_access, action_permissions, approval_requirements, budgets, fallback, monitoring, kill_switch, active, approval_status, evaluation_set, last_review`.

- `risk_tier`: integer `0`–`4`, same convention as the `/v1/route` risk tier.
- `active`: the live kill switch — set to `false` to pull it, `true` to reactivate. This is the actionable control; `kill_switch` (text) documents the mechanism.
- `approval_status`: `draft, pending_approval, approved, suspended, retired`.
- `owner`: must resolve to a canonical identity in the Service Members registry (below) — any of `service_member_id`, `callsign_id`, `@callsign`, or a legacy alias like `ATA-SM-001`. The server stores the resolved canonical `@callsign` back into this field; `422` if the value doesn't resolve.
- `service_member_id` (optional): links this AI-agent operational card to a registry identity of `member_class: ai_agent`. Same resolution rule as `owner`. `409` if the identity is already linked to a different agent card.

## Service Members (Canonical Identity Registry)

Backed by Postgres. This is the R2 canonical identity contract from the root README's "Canonical Identity and Production Control" section, made real: every AI Agent, Trooper, and Service Member is a row here with an immutable `service_member_id`/`callsign_id`/`callsign` and a versioned `current_role`.

`service_members` **starts empty** — same as `agent_cards`, `incidents`, and `releases`. No governed personnel roster exists in this repository, so none is fabricated to fill it. `_seed_personnel()` (`07_PLATFORM/backend/app/seed.py`) will load `11_PERSONNEL/personnel_roster.csv` on boot if one is present there, or populate the registry via `POST /v1/service-members`/`POST /v1/service-members/import` once running — see `11_PERSONNEL/Personnel_Roster.md`. A 66-identity **synthetic** roster exists under `07_PLATFORM/backend/tests/fixtures/synthetic_personnel/` for tests and local demos only — it is never staged into the production seed path, and every row's `source_lineage` field says so.

Verification of this registry splits into two independent classes, matching that separation: `07_PLATFORM/backend/tests/test_service_members.py` proves the identity machinery works (uniqueness, resolution, role history, audit linkage) against the synthetic fixtures, and never runs against real data. `07_PLATFORM/backend/tests/test_production_identity_canary.py` plus `python -m app.canary` (`make production-canary`) check the actual configured database: `NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES` while the registry is empty (the correct, expected state, not a failure), `PASS`/`FAIL` against whatever real identities have been onboarded once any exist.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/service-members` | List identities. Optional `?q=` (matches `callsign` or `display_name`), `?member_class=`, `?lifecycle_state=` filters. |
| GET | `/v1/service-members/resolve?identifier=` | Canonical resolution: tries `service_member_id`, then `callsign_id`, then `callsign` (exact, `@` prepended if omitted), then `legacy_alias`, in that order — exact match only at every tier, no fuzzy/partial matching. `404` if none match. |
| GET | `/v1/service-members/{service_member_id}` | Identity detail. |
| GET | `/v1/service-members/{service_member_id}/role-history` | Versioned duty-assignment history, oldest first. |
| GET | `/v1/service-members/{service_member_id}/verifications` | Independent-verification history, oldest first — see below. |
| GET | `/v1/service-members/{service_member_id}/lifecycle-history` | Lifecycle-transition history, oldest first — see "Lifecycle transitions" below. |
| POST | `/v1/service-members` | Admin only. Create an identity — see field list below. `409` on any collision (`service_member_id`, `callsign_id`, `callsign`, or `legacy_alias` already in use). `production_verification_state` is not an accepted field here; every new identity starts `unverified` regardless of what's sent. `created_by_service_member_id` is recorded automatically from the caller's own linked identity (`null` if the caller's account isn't linked to one). |
| PUT | `/v1/service-members/{service_member_id}` | Admin only. Updates **only** `display_name, readiness_state, legacy_alias`. Identity fields (`service_member_id, callsign_id, callsign`), role fields (`current_role, role_version, command_layer`), `lifecycle_state`, and `production_verification_state` are not accepted here — identity is immutable, role changes only happen through the role-change endpoint below, lifecycle transitions only through the deactivate/reactivate/discharge endpoints below, and verification state only through the verify endpoint below. |
| POST | `/v1/service-members/{service_member_id}/role-change` | Admin only. Body: `{new_role, new_command_layer, reason}`. The **only** way to change an identity's role — increments `role_version` and appends one `role_assignment_history` row in the same transaction; never mutates prior history, never creates a new identity. |
| POST | `/v1/service-members/{service_member_id}/verify` | Admin only. Body: `{evidence_reference, verification_method, outcome, notes}`. The **only** way `production_verification_state` moves to `verified` or `revoked` — see "Independent verification" below. |
| POST | `/v1/service-members/{service_member_id}/deactivate` | Admin only. Body: `{reason}` (required). Transitions `active -> inactive`. `409` if not currently `active`. |
| POST | `/v1/service-members/{service_member_id}/reactivate` | Admin only. Body: `{reason}` (required). Transitions `inactive -> active`. `409` if not currently `inactive` (including from `discharged` — reactivation is not valid there). |
| POST | `/v1/service-members/{service_member_id}/discharge` | Admin only. Body: `{reason}` (required). Transitions `active` or `inactive -> discharged`. `409` if already `discharged`. This is the registry's substitute for deletion — see below. |

Identity fields (create-only): `service_member_id` (`ATA-<CALLSIGN>-000`), `callsign_id` (`ATA-SM-<CALLSIGN>-001`), `callsign` (`@<CALLSIGN>`), `display_name`, `member_class`, `command_layer`, `current_role`, plus optional `lifecycle_state`, `readiness_state`, `legacy_alias` (a migration alias like `ATA-SM-001`, never reused), `source_lineage`.

- `member_class`: `human_trooper, ai_agent`.
- `command_layer`: `command, field_operations, support, training, executive`.
- `lifecycle_state`: `active, inactive, discharged` (default `active`).
- `readiness_state`: `ready, not_ready, in_training, stand_down` (default `ready`).
- `production_verification_state`: `unverified, verified, revoked` — **read-only output field**, the identity-verification term in the README's `PRODUCTION_VERIFIED` equation. Always starts `unverified`; only `POST .../verify` can move it.

There is no delete endpoint — canonical identities are not discardable; retire one via the deactivate/discharge endpoints above instead.

### Lifecycle transitions

`lifecycle_state` is only ever written by `POST .../deactivate|reactivate|discharge` — never by the generic `PUT` update, and never as a bare field flip. Every transition requires a `reason` and appends one `lifecycle_transition_history` row (`from_state`, `to_state`, `reason`, `changed_by`, `effective_at`); prior rows are never mutated.

Valid transitions:

| From | To | Endpoint |
|---|---|---|
| `active` | `inactive` | `/deactivate` |
| `inactive` | `active` | `/reactivate` |
| `active` or `inactive` | `discharged` | `/discharge` |
| `discharged` | *(none)* | terminal — no endpoint transitions out of `discharged` |

`discharged` is this registry's substitute for deletion: the identity, its full role history, its verification history, and every FK reference to it (an incident's `owner_service_member_id`, an agent's `service_member_id` link, etc.) all remain exactly as they were — only `lifecycle_state` changes, permanently. A discharged identity still resolves normally through `GET /v1/service-members/resolve` (historical references must keep working), it just can no longer be transitioned to any other state.

### Independent verification

`production_verification_state` is a factual claim, not decoration — the platform enforces that literally: no create or update path accepts it, only `POST /v1/service-members/{id}/verify` can set it, and that endpoint requires:

- `evidence_reference` — what was actually checked (a document, a system record, a reference number — free text, this platform doesn't prescribe an evidence-storage system).
- `verification_method` — how it was checked (free text — this platform doesn't invent a fixed taxonomy of verification methodologies for you).
- `outcome` — `verified` (moves the state to `verified`), `rejected` (recorded as history; state is left untouched), or `revoked` (moves a previously-`verified` identity back to `revoked`).
- `notes` — optional.

The **verifier is never a request field** — it's always the caller's own linked identity (`users.service_member_id` for whichever admin account is authenticated), resolved server-side. This is what makes the separation-of-duties check meaningful rather than a free-text claim anyone could fill in:

- `409` if the verifier's identity is the same as the identity being verified (an identity cannot verify itself).
- `409` if the verifier's identity is the one recorded in `created_by_service_member_id` for this record (whoever onboarded an identity cannot also verify it).
- `422` if the caller's own account isn't linked to any canonical identity at all (link one first via `PUT /v1/users/{id}/identity`).

Every call — successful or rejected — is still subject to the normal admin-mutation audit trail. `app/canary.py` additionally cross-checks that every `verified` identity has at least one backing `identity_verifications` row with `outcome: verified`; a `verified` label with no such record is a canary `FAIL`, regardless of how it got there.

## Incidents

Backed by Postgres. `incidents` start empty — this operationalizes `03_OPERATING_MANUAL/SOP_Incident_Response.md`'s 10-step lifecycle as live records. An incident can optionally reference an Agent Card.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/incidents` | List incidents. Optional `?status=`, `?severity=`, `?agent_id=` filters. |
| GET | `/v1/incidents/{id}` | Incident detail. |
| POST | `/v1/incidents` | Log an incident — see field list below. 422 if `agent_id` is given but unknown. |
| PUT | `/v1/incidents/{id}` | Update an incident (full replace of all fields). |
| DELETE | `/v1/incidents/{id}` | Delete an incident. |

Incident fields: `title, severity, status, description, impact, root_cause, corrective_action, owner, agent_id, resolved_at` (plus server-set `id`, `opened_at`, `owner_service_member_id`).

- `severity`: `low, medium, high, critical`.
- `status`: `detected, contained, investigating, corrected, resolved` — a practical compression of the SOP's 10 steps.
- `agent_id`: optional link to `/v1/agents/{id}`. If that agent is later deleted, `agent_id` is set to `null` rather than blocking the deletion.
- `owner`: must resolve to a canonical identity in the Service Members registry (same rule as agent cards' `owner`, above). `422` if unresolvable; the resolved canonical `service_member_id` is exposed as `owner_service_member_id`.

## Releases

Backed by Postgres. `releases` start empty — this operationalizes `03_OPERATING_MANUAL/SOP_Prompt_Release.md` and the Internal Operating Manual's §7 Change Management as live records.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/releases` | List releases. Optional `?status=` filter. |
| GET | `/v1/releases/{id}` | Release detail. |
| POST | `/v1/releases` | Log a release — see field list below. |
| PUT | `/v1/releases/{id}` | Update a release (full replace of all fields). |
| DELETE | `/v1/releases/{id}` | Delete a release. |

Release fields: `title, version, rationale, expected_impact, test_evidence, approver, risk_tier, release_date, rollback_target, status` (plus server-set `id`, `approver_service_member_id`).

- `risk_tier`: integer `0`–`4`, same convention as `/v1/route` and agent cards — ties to the SOP's "independent review for Tier 2+" rule.
- `status`: `proposed, approved, released, rolled_back`.
- `approver`: must resolve to a canonical identity in the Service Members registry (same rule as agent cards' `owner`, above). `422` if unresolvable; the resolved canonical `service_member_id` is exposed as `approver_service_member_id`.

## Governance

Backed by Postgres. `raci_entries` are seeded from `06_IMPLEMENTATION/governance_raci.csv` — the wide activity×role matrix melted into 30 normalized rows (6 activities × 5 roles: Executive Sponsor, Academy Owner, AI Architect, Security Owner, Certification Board).

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/governance/raci` | List RACI entries. Optional `?activity=` filter. |
| POST | `/v1/governance/raci` | Create an entry. Body: `{activity, role, responsibility}`. |
| PUT | `/v1/governance/raci/{id}` | Update an entry. |
| DELETE | `/v1/governance/raci/{id}` | Delete an entry. |

`responsibility` is free text, not a constrained enum — the source data itself uses combined codes like `"A/R"` (a role that's both Accountable and Responsible) alongside single `A`/`R`/`C`/`I` values.

## Users

Backed by Postgres. Every user has a `role` of `admin` or `contributor` (default on creation: `contributor`). A single `admin` account is seeded on first boot (see the README's Quick Start). Roles are embedded in the JWT issued at login, so changing a user's role doesn't take effect for that user until their current token expires (`AUTH_TOKEN_EXPIRE_MINUTES`).

All endpoints below require the caller's own token to carry the `admin` role — a `contributor` token gets `403` from all of them, same as an anonymous request. This is a separate, stricter check from the regular `Depends(get_current_user)` used everywhere else in this API; the ~20 existing mutating endpoints across the other modules are unaffected and still only require "any authenticated user," not specifically `admin`.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/users` | List users (id, username, role, service_member_id, created_at — never the password hash). |
| POST | `/v1/users` | Create a user. Body: `{username, password, role, identifier}`. `role` defaults to `contributor`. `identifier` is optional — see below. 409 on duplicate username. |
| PUT | `/v1/users/{id}` | Change a user's role. Body: `{role}`. |
| PUT | `/v1/users/{id}/identity` | Link or relink this account to a canonical identity. Body: `{identifier}`. |
| DELETE | `/v1/users/{id}` | Remove a user. `409` if this would delete the last remaining `admin` account — a safety rail against locking out user management entirely. |

There is no public self-registration endpoint — new accounts are only created by an existing admin, in keeping with this project's least-privilege stance (see `SECURITY.md`).

`identifier` (create, and the dedicated link endpoint) accepts any of the 4 canonical resolution forms (`service_member_id`, `callsign_id`, `@callsign`, legacy alias) and links the account to that Service Members registry entry. `422` if it doesn't resolve, `409` if that identity is already linked to a different account. A linked account's `service_member_id` is what shows up on its audit-log entries and any incident/release/approval it acts on — see Audit log, below. The bootstrap `admin` account is auto-linked to the seeded `@ATLAS` identity when the personnel registry is present.

## Audit log

Backed by Postgres. Every authenticated POST/PUT/DELETE across all modules above writes one `audit_log` row recording who did what, when, and the resulting status code.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/audit-log` | List audit entries, most recent first. Optional `?q=` (partial match on `path`), `?username=`, and `?service_member_id=` filters, plus the standard `limit`/`offset` pagination (`X-Total-Count` header). |

- Unlike every other GET in this API, `/v1/audit-log` **requires** a bearer token — audit trails are more sensitive than academy content, so this is a deliberate exception to the "GETs are public" rule above.
- Entries are only written for requests that reach an authenticated endpoint's handler. A request rejected for missing/invalid credentials (401/403) is not logged — this is a log of identified users' actions, not a general access log.
- There is no PUT/DELETE for audit entries — the log is immutable.
- Each entry carries both `username` (the JWT identity that made the request) and `service_member_id` (that account's linked canonical identity, `null` if unlinked) — the latter is what the README's R2 contract means by "audit records must reference the canonical service_member_id."

## Error policy

- 400: invalid input
- 401: unauthenticated
- 403: unauthorized
- 404: resource not found
- 409: conflict (duplicate key)
- 422: request references an unknown related resource, or fails validation
- 429: rate limit exceeded (see Rate limiting above; `Retry-After` header present)
- 503: no approved execution path
