# Developer Guide

## Local setup

```bash
cp .env.example .env
make validate
make install
make test
docker compose up --build
```

## Code standards

- Python: type hints, Pydantic validation, explicit error handling
- JavaScript/TypeScript: strict types, no hidden provider credentials, normalized responses
- PHP: strict types and JSON-only integration endpoints
- YAML: versioned policies and declarative infrastructure
- Docker: non-root runtime where practical
- Tests: route, risk, failure, and fallback coverage

## Adding a model provider

1. Create a provider adapter.
2. Keep credentials server-side.
3. Normalize output.
4. Add timeout and retry controls.
5. Add evaluation fixtures.
6. Document data handling and pricing.
7. Add rollback and provider-disable flag.
