# Internal AI Operating Manual

## 1. Purpose

This manual governs how AI features, agents, prompts, models, tools, and knowledge systems are proposed, built, tested, released, operated, and retired.

## 2. Operating Principles

1. Human accountability remains with the assigned owner.
2. No AI output is authoritative merely because it is fluent.
3. Use approved sources and tools before relying on model memory.
4. High-impact actions require approval proportional to risk.
5. Client-side processing is preferred for bounded, private, frequent, or offline tasks when device capability permits.
6. Server-side processing is preferred for complex reasoning, large context, current information, tools, enterprise data, or broad platform support.
7. Hybrid routing must provide graceful fallback and a consistent response contract.
8. Every production change requires evaluation evidence, observability, and rollback.
9. Secrets never belong in client code, prompts, logs, or training files.
10. Incidents are documented without hiding model or human failures.

## 3. Roles

- Executive Sponsor: approves strategy, risk appetite, and funding.
- AI Architect: owns system design and routing standards.
- Product Owner: owns user value and acceptance criteria.
- Model Owner: owns model choice, lifecycle, and evaluation.
- Knowledge Owner: owns source quality, access, and freshness.
- Tool Owner: owns API permissions and transaction safety.
- Security Owner: owns threat model and incident response.
- Evaluator: independently validates outputs and regressions.
- Operator: monitors production and executes runbooks.
- Approver: authorizes high-impact deployment or action.

## 4. Lifecycle

### Intake
Document the problem, users, value, constraints, data, risk, and non-AI alternative.

### Design
Select task API, client-side model, server model, RAG, fine-tuning, agent, or hybrid architecture.

### Build
Implement typed contracts, feature detection, privacy controls, timeouts, cancellation, retries, and audit events.

### Evaluate
Test quality, groundedness, format, security, latency, cost, device coverage, and failure behavior.

### Release
Use versioned prompts/models, feature flags, staged rollout, ownership, monitoring, and rollback.

### Operate
Review dashboards, incidents, drift, user feedback, source freshness, provider changes, and spend.

### Retire
Disable access, archive evidence, revoke secrets, remove stale indexes, and notify stakeholders.

## 5. Risk Tiers

- Tier 0: Non-AI deterministic utility.
- Tier 1: Low-impact assistance; user reviews output.
- Tier 2: Operational recommendation; human approval required.
- Tier 3: External communication, financial, legal, security, or customer-impacting action; explicit approval and audit required.
- Tier 4: Prohibited autonomous action unless separately authorized by executive governance.

## 6. Minimum Production Gate

- Named owner
- Documented source and model versions
- Test suite and passing thresholds
- Prompt-injection and data-leakage tests
- Authentication and authorization
- Rate and cost limits
- Monitoring and alerts
- Fallback and rollback
- User disclosure where material
- Incident contact and runbook

## 7. Change Management

Every change receives a version, rationale, expected impact, test evidence, approver, release date, and rollback target. Emergency changes must be reviewed retrospectively within one business day.

## 8. Record Retention

Retain architecture decisions, evaluation reports, model cards, prompt versions, release approvals, incidents, and corrective actions according to the organization's data-retention policy.
