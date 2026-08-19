# CARC / AI Training Academy Audit Sweep

**Audit date:** 2026-08-19  
**Audited release:** `CARC_v3.34.1_KNOWLEDGE_PATH_PILOT_REGISTRY.zip`  
**Runtime evidence reviewed:** `carc_runtime_canary_2026-08-16(1).json`  
**Decision:** `HOLD — NOT PRODUCTION VERIFIED`

## Executive finding

The package is structurally sound and its local control logic is passing, but it is not production-ready. The latest available runtime-canary evidence failed authentication with HTTP 403, the integration charter retains `Production: HOLD`, and all 66 team working profiles remain `READINESS_UNKNOWN / NOT_RUNTIME_VERIFIED`. Local tests prove implementation quality; they do not replace live governed execution, independent verification, or realized-profit evidence.

## Audit scorecard

| Domain | Result | Evidence |
|---|---:|---|
| Package integrity | PASS | Archive extracted cleanly; all discovered JavaScript and JSON parsed successfully. |
| Frontend unit tests | PASS | 154 passed, 0 failed across 11 suites. |
| Canonical roster population | PASS | 66 runtime seed records and 66 exported knowledge-path identities. |
| Canonical ID Resolver — Control #1 | PASS (local) | 6/6 adversarial tests passed: duplicates, competing IDs, foreign issuers, aliases, unknown IDs, immutability. |
| Shared control-plane contracts | PASS (local) | 7 passed, 0 failed. |
| Knowledge-path evidence | BLOCKED | Export shows 0/10 verified stages for the roster; pilot tickets exist only for @MAPE and @HELIX. |
| Team readiness | BLOCKED | 66 profiles default to `READINESS_UNKNOWN / NOT_RUNTIME_VERIFIED`. |
| Live runtime verification | FAIL | Latest reviewed canary: HTTP 403, `Invalid or revoked token`, no signature, `verified: false`. |
| Production authorization | HOLD | Canonical Integration Charter and Upgrade Verification Report both retain production `HOLD`. |
| Dynasty Property OS boundary | WARNING | The Library folder is empty; only a nested README/control-plane representation exists in the CARC package. No independently auditable Property OS runtime was available. |
| Realized-profit terminal proof | NOT PROVEN | No verified `revenue.realized` → economic reconciliation → realized-profit evidence package was found. |

## Identity and registry findings

1. The canonical operational roster contains 66 records and no duplicate `serviceMemberId` or callsign was detected.
2. The runtime seed schema uses `serviceMemberId`, `agentId`, `legacy`, and `callsign`; it does not use generic `id`, `callsignId`, or `legacyAlias`. Any importer expecting the latter field names will misread all 66 records unless it maps the schema explicitly.
3. The current roster remains a controlled working baseline. It must not be represented as roster-wide production verification.
4. Control #1 behavior is implemented and locally proven, but runtime evidence for conflict quarantine, replay, and cross-system issuer enforcement remains required.

## Governance and production-gate findings

The following controls remain unproven in the audited evidence set:

- Live duplicate delivery and idempotency-conflict handling.
- Out-of-order supersession behavior.
- Retry/dead-letter replay and outage isolation.
- Rejection of unverified outcomes across the full shared control plane.
- One real property × one authorized mission × `@DEALHAWK` only.
- `@TANGO` runtime test evidence followed by unchanged-evidence verification from `@HELIX`.
- Economic reconciliation and independently verified realized profit.

The correct current phase state is:

- `STABILIZE`: materially established.
- `SYSTEMIZE`: active; local controls pass, runtime closure incomplete.
- `MONETIZE`: blocked pending the production canary and realized-profit proof.
- `SCALE`: hold.
- `DOMINATE`: hold.

## Runtime and security findings

1. The reviewed canary evidence is not production-eligible: `productionState=NOT_RUNTIME_VERIFIED`, `gateDecision=HOLD`, external verification returned 403, and the signature is null.
2. Runtime smoke and E2E tests could not execute from the archive because runtime dependencies were not installed (`Cannot find module 'dotenv'`). This is a reproducibility failure for the packaged deliverable, not proof that the source is defective.
3. The default deployment configuration exposes `HOST=0.0.0.0`, `CORS_ORIGIN=*`, and a placeholder signing secret. The verification route refuses the placeholder secret, which is good fail-closed behavior; deployment must nevertheless require an explicit non-placeholder secret and restricted production origin.
4. Bearer tokens are stored as SHA-256 hashes and invalid/revoked tokens fail closed. Rate limiting and a 256 KB JSON body limit are present.
5. No dependency-vulnerability audit was completed because dependencies were not installed in this isolated audit copy.

## Documentation drift

The README preserves historical claims of successful runtime verification, while the later reviewed canary evidence records an authentication failure. Both facts may be historically accurate, but the latest failed attempt cannot inherit an earlier pass. CARC needs a single authoritative release-status record that identifies:

- active release and schema version;
- current endpoint and token generation;
- latest successful execution ID;
- latest verification ID, verifier, timestamp, signature, and evidence hash;
- whether a newer failure supersedes or merely follows the earlier pass;
- explicit global production-gate decision.

## Required corrective sequence

1. Install locked runtime dependencies in the target WSL/runtime environment and rerun smoke, E2E, and control-plane suites.
2. Rotate/reissue the governed bearer token, configure the exact active endpoint, and prove connection before submitting a canary.
3. Enforce a non-placeholder signing secret and a restricted production CORS origin; capture configuration evidence without exposing secrets.
4. Run Control #1 against the live runtime, including duplicate, competing-ID, foreign-issuer, unknown-ID, quarantine, immutability, and alias-resolution cases.
5. Execute exactly one CARC-authorized mission with `@DEALHAWK` as the only execution agent and `@ATLAS` as non-executing coordinator.
6. Return immutable evidence through @CHAINCORE; have @TANGO test it and @HELIX independently verify the unchanged evidence.
7. Reconcile the real revenue event through @LEDGERMIND. @MAPE may pass MONETIZE only after independently verified realized profit.
8. Publish a new signed release-status/evidence manifest. Only then consider controlled roster-wide rollout.

## Final decision

`LOCAL IMPLEMENTATION: PASS`  
`IDENTITY CONTROL #1: PASS — LOCAL TEST EVIDENCE`  
`LIVE RUNTIME GATE: FAIL / INCOMPLETE`  
`PRODUCTION VERIFICATION: HOLD`  
`MONETIZE CANARY: BLOCKED`  
`ROSTER-WIDE ACTIVATION: PROHIBITED`
