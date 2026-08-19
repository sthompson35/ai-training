# Changelog

## 2.4.0 — Git history, GitHub governance, and release infrastructure

- Initialized this repository as a git repository (`main` as the default branch) — everything before this point existed only as an uncommitted working tree
- Added `.github/CODEOWNERS` mapping required review to four domains — runtime, registry (the canonical identity system specifically), governance, and evidence — using placeholder team handles that must be replaced with real GitHub users/teams before GitHub will actually enforce them (documented in the file's own header)
- Added `.github/BRANCH_PROTECTION.md`: the full required ruleset for `main` (PR + 1 approval, required CI checks, up-to-date branch, conversation resolution, no force-push/deletion, admin enforcement, signed commits, CODEOWNERS review) as the exact `gh api` commands to apply it — branch protection is GitHub-side configuration with no file-based form, so this is the source of truth until it's actually applied to a real remote
- Added `.github/ENVIRONMENTS.md`: the `production` GitHub Environment spec — deployment restricted to `main`/`v*` tags only, required-reviewer approval gate, and the deployment secret *names* the release workflow expects (no values, none fabricated)
- Added `.github/workflows/release.yml`: tag-triggered (`v*`) release pipeline — runs the full test suite, a live production-identity-canary check, confirms `manifest.json` is current, generates `RELEASE_STATUS.json` and `SHA256SUMS.txt`, publishes a GitHub Release with those as evidence attachments, then gates an actual `production` Environment deployment job (currently a documented placeholder — no real registry/cluster credentials exist to deploy to yet)
- Added `.github/workflows/ci.yml`'s new `evidence` job: fails CI if `manifest.json` has drifted from the actual tree (the exact class of bug the 2.3.1 audit sweep found by hand), and uploads a per-commit CI evidence record with checksums as a workflow artifact
- Added `08_INFRASTRUCTURE/scripts/generate_release_status.py` (`make release-status`) — assembles the canonical `RELEASE_STATUS.json` from whatever CI actually measured (test counts, canary status, manifest state), never from typed-in numbers
- Generated the first `RELEASE_STATUS.json`, from real measurements: 163/163 backend tests, 133/133 frontend tests, canary `NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES`, gate decision `GO`

## 2.3.1 — Audit sweep: version drift, provenance gap, dependency fix

- Fixed a real bug: `.env`/`.env.example` still had `APP_VERSION=2.0.0`, which **overrides** `main.py`'s code default — every version bump from 2.1.0 through 2.3.0 was cosmetic, and the live API was actually reporting `2.0.0` in its OpenAPI schema the entire time. `APP_VERSION` is now `2.3.1` everywhere it's declared (`.env`, `.env.example`, `08_INFRASTRUCTURE/kubernetes/academy.yaml`); confirmed live post-fix. `POLICY_VERSION` intentionally left at `2.0.0` — it versions the routing policy independently, per this README's own versioning rule, and hasn't changed
- Closed a second, related governance gap in the R2 identity work: `_seed_personnel()`'s boot-time CSV seed path could still set `production_verification_state: verified` straight from the roster CSV, bypassing the verify endpoint entirely (no acting admin, no verifier, no separation-of-duties check possible in that context). Seeded rows now always start `unverified`, regardless of the CSV column's value; added regression test and updated `11_PERSONNEL/Personnel_Roster.md` accordingly
- Fixed `README_UPDATED.md`'s R2.1 note, which claimed "the exact original uploaded README is retained in `00_SOURCE/README_v2.0.0_ORIGINAL.md`" — that file never actually existed. Created it from the repo-root `README.md` (the actual pre-R2 v2.0.0 original) so the provenance/rollback claim is true rather than aspirational
- Bumped `nanoid` (transitive frontend dev dependency) via `npm audit fix` — resolved one high-severity advisory (GHSA-2v37-7h3g-55p8), no breaking changes
- Added test coverage for the `outcome: "revoked"` path on `POST /v1/service-members/{id}/verify` (previously untested — verified → revoked transition, history ordering)
- Synced `07_PLATFORM/frontend/package.json`/`package-lock.json` version (`2.0.0` → `2.3.1`) — cosmetic only, not runtime-visible, but was drifting from every other version marker in the repo
- Regenerated `manifest.json`

## 2.3.0 — Governed independent verification, release manifest, packaging hygiene

- Added a dedicated independent-verification workflow (`POST /v1/service-members/{id}/verify`, `GET /v1/service-members/{id}/verifications`, new `identity_verifications` table): every transition of `production_verification_state` to `verified`/`revoked` now requires an evidence reference, a verification method, an outcome, and a timestamp, and is subject to separation-of-duties — an identity cannot verify itself, and whoever onboarded a record cannot also verify it. The verifier is always derived from the acting admin's own linked identity, never a free-text field
- `production_verification_state` removed from both `ServiceMemberCreate` and the generic `PUT /v1/service-members/{id}` update — a "verified" label can no longer be set directly by any path except the governed verify endpoint
- Added `ServiceMember.created_by_service_member_id`, recorded automatically at creation/import, and used by the separation-of-duties check
- `app/canary.py` now independently verifies that every `verified` identity has a backing `identity_verifications` record — an ungoverned label (however it got there) is a `FAIL`, not a silent pass
- Regenerated `manifest.json` against the actual current file tree (the previous manifest dated back to an early pre-platform snapshot of the repo and no longer matched reality); added `08_INFRASTRUCTURE/scripts/generate_manifest.py` (`make manifest`) so it can be regenerated on demand instead of drifting again
- `.env` confirmed excluded from both the release manifest and `.gitignore` — never part of what this repository distributes, independent of the working copy every developer needs locally to run `docker compose up`

## 2.2.2 — Production identity canary and controlled onboarding

- Added `app/canary.py` (`make production-canary`) — an operational check against whatever database is actually configured, distinct from the pytest suite's synthetic-fixture tests. Reports `NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES` while the registry is empty (the correct state, not a failure) and validates real onboarded identities (uniqueness, recorded source lineage, valid verification state) once any exist
- Added `tests/test_production_identity_canary.py`, proving the "controlled first-member onboarding" path — a real identity entering the registry one at a time through the governed admin API — works correctly independent of whether real data exists yet
- Documented the onboarding sequence in `11_PERSONNEL/Personnel_Roster.md`, mapped to the existing `POST /v1/service-members` mechanics (no new subsystem needed — identity issuance, audit, and evidence were already there; onboarding and independent verification are now explicitly distinct steps)
- Clarified that names/roles referenced in prior Academy discussions are discovery inputs only, never production identities by default

## 2.2.1 — Separate synthetic test personnel from the production registry

- `service_members` now starts empty on a fresh deployment, same as `agent_cards`, `incidents`, and `releases` — no roster exists to seed it with, so 2.2.0's synthetic 66-identity CSV is no longer staged into the production seed path (`11_PERSONNEL/`)
- Relocated the synthetic roster to `07_PLATFORM/backend/tests/fixtures/synthetic_personnel/`, used only by tests and local demos
- `11_PERSONNEL/` now documents how to populate the registry from a real governed roster (drop a CSV in before boot, or `POST /v1/service-members`/`.../import` once running) instead of shipping fabricated data
- `Dockerfile.api` copies the `11_PERSONNEL/` directory rather than two named files, so the image builds cleanly whether or not a real roster is present
- Corrected 25 synthetic identities (including `@VICTOR` and the admin-linked `@ATLAS`) that 2.2.0 had incorrectly marked `production_verification_state: verified` — fabricated data cannot be independently verified; all synthetic identities are `unverified`

## 2.2.0 — R2 Canonical Identity Cutover

- Added the canonical identity registry (`service_members` / `/v1/service-members`) implementing the README's R2 dual canonical identity standard: immutable `service_member_id`/`callsign_id`/`callsign`, versioned duty assignments (`role_assignment_history`), and exact-match-only resolution across all four identifier tiers (service_member_id, callsign_id, callsign, legacy alias)
- Seeded the registry with a 66-identity synthetic baseline (`11_PERSONNEL/personnel_roster.csv`) — the previous R2 documentation described this contract without any implementation or seed data
- Linked `agent_cards.owner`, `incidents.owner`, and `releases.approver` to the registry — these now resolve through the canonical identifier and reject unresolvable input (422) instead of accepting arbitrary free text
- Linked login accounts (`users.service_member_id`) to the registry, and audit log, approval-decision records now carry the acting user's canonical `service_member_id` alongside the existing username
- Added a role-change endpoint (`POST /v1/service-members/{id}/role-change`) as the sole mechanism for changing an identity's role — enforces that a role change is recorded as new history, never a new identity
- Added the Service Members registry UI (list, detail, role-history view, identity pickers on the Agent/Incident/Release/User forms)

## 2.0.0 — Institutional Standard

- Replaced the minimal README with a full institutional repository standard
- Added Python FastAPI reference backend
- Added JavaScript hybrid routing helper
- Added React/TypeScript operations dashboard
- Added PHP health integration
- Added Docker Compose and Dockerfiles
- Added Nginx gateway configuration
- Added Kubernetes deployment templates
- Added environment validation script
- Added GitHub Actions CI
- Added architecture, security, API, development, and operations documentation
- Added contribution, security, conduct, and licensing policies

## 1.0.0 — Initial Academy Package

- Added curriculum
- Added certification path
- Added operating manual
- Added SOPs, templates, taxonomy, glossary, and rollout plan
