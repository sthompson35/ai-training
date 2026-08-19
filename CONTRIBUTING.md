# Contributing

## Required submission components

Every material change must include:

- Problem statement
- Owner
- Risk tier
- Architecture or design note
- Code or content changes
- Tests or evaluation evidence
- Security impact
- Documentation update
- Rollback plan

## Branch convention

- `feature/<name>`
- `fix/<name>`
- `docs/<name>`
- `security/<name>`

## Review requirements

- Curriculum changes: Academy owner
- Architecture changes: AI architect
- Security-sensitive changes: Security owner
- Certification changes: Certification board
- Tier 3+ production changes: Executive sponsor or delegated approver

## Pull request acceptance

A pull request may merge only when:

- CI passes
- Required reviewers approve
- New behavior is documented
- Tests cover success and failure paths
- No live secret is present
- Version and changelog are updated when applicable
