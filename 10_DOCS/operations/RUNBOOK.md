# Operations Runbook

## Startup

1. Validate `.env`.
2. Start Docker Compose.
3. Confirm `/health` and `/ready`.
4. Test route decision.
5. Confirm audit logging.
6. Confirm cost and rate limits.

## Degraded operation

- Provider unavailable: use eligible local route.
- Client model unavailable: route to server.
- Network offline: local route or fail clearly.
- Policy service unavailable: fail closed for Tier 2+.
- Tool unavailable: stop action and request human handling.

## Incident command

1. Disable affected feature.
2. Revoke tool permission when necessary.
3. Preserve evidence.
4. Notify owner.
5. Roll back.
6. Correct and retest.
7. Approve restoration.
