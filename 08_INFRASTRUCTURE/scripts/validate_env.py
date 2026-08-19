from pathlib import Path
import sys

REQUIRED = {
    "APP_ENV",
    "APP_VERSION",
    "API_PORT",
    "AI_DEFAULT_ROUTE",
    "AI_MAX_INPUT_CHARS_LOCAL",
    "AI_REQUEST_TIMEOUT_SECONDS",
    "AUDIT_LOG_ENABLED",
    "REQUIRE_HUMAN_APPROVAL_TIER",
    "POLICY_VERSION",
    "DATABASE_URL",
    "AUTH_SECRET_KEY",
    "CORS_ALLOWED_ORIGINS",
    "RATE_LIMIT_PER_MINUTE",
    "LOGIN_RATE_LIMIT_PER_MINUTE",
}

env_path = Path(".env")
if not env_path.exists():
    print("ERROR: .env not found. Copy .env.example to .env.", file=sys.stderr)
    raise SystemExit(1)

values = {}
for raw_line in env_path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    values[key.strip()] = value.strip()

missing = sorted(REQUIRED - values.keys())
if missing:
    print(f"ERROR: missing variables: {', '.join(missing)}", file=sys.stderr)
    raise SystemExit(1)

if values.get("AI_PROVIDER_API_KEY"):
    print("NOTICE: provider key is configured locally; confirm .env is ignored.")

if values.get("AUTH_SECRET_KEY") == "dev-only-insecure-secret-change-me":
    print("NOTICE: AUTH_SECRET_KEY is still the dev-only default; generate a real secret before real use.")

print("Environment validation passed.")
