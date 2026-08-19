AI Training Academy™

> Institutional Standard for AI Education, Certification, Governance, and Production Operations

[![Documentation](https://img.shields.io/badge/docs-institutional-blue)](#documentation-map)
[![Architecture](https://img.shields.io/badge/architecture-hybrid_AI-purple)](#reference-architecture)
[![Governance](https://img.shields.io/badge/governance-required-darkgreen)](#governance-standard)
[![Security](https://img.shields.io/badge/security-zero_trust-red)](#security-standard)
[![Version](https://img.shields.io/badge/version-2.0.0-black)](#versioning)

The AI Training Academy is a complete institutional framework for training people and AI agents to design, build, deploy, govern, evaluate, and improve trustworthy AI systems.

This repository combines:

- A structured AI curriculum
- A progressive certification path
- An internal operating manual
- A governed knowledge base
- Standard operating procedures
- Production architecture patterns
- Runnable client-side and server-side reference components
- Hybrid AI routing and graceful fallback
- Security, evaluation, monitoring, and incident-response controls
- Docker, Kubernetes, CI/CD, JavaScript, Python, PHP, TSX, YAML, and environment templates

The platform is designed for internal corporate education, technical apprenticeships, agent training, executive governance, certification programs, and production AI enablement.

Mission

Build a disciplined AI workforce capable of producing measurable value through:

1. Accurate reasoning
2. Source-grounded decisions
3. Safe tool execution
4. Human accountability
5. Reliable automation
6. Continuous evaluation
7. Controlled deployment
8. Transparent governance

The Academy does not treat fluency as proof of correctness. Every production workflow is expected to include verification, observability, fallback, and rollback.

Institutional Outcomes

Graduates and trained agents should be able to:

- Distinguish task APIs, expert models, small language models, foundation models, and multimodal models
- Select client-side, server-side, or hybrid execution based on complexity, privacy, connectivity, cost, and hardware capability
- Build offline-capable AI experiences
- Implement graceful fallback when a local or cloud model is unavailable
- Design prompts, schemas, test sets, and evaluation rubrics
- Build retrieval-augmented generation systems with traceable sources
- Connect agents to tools using least-privilege permissions
- Operate multi-agent workflows with structured handoffs
- Protect secrets, personal data, and enterprise records
- Monitor quality, latency, cost, drift, and safety
- Execute incident response and rollback
- Defend an enterprise AI architecture before a certification board

Repository Map


AI_Training_Academy_Institutional_Standard_v2/
├── 00_SOURCE/                 Original source material
├── 01_CURRICULUM/             Curriculum, modules, and labs
├── 02_CERTIFICATION/          Certification paths and assessments
├── 03_OPERATING_MANUAL/       Governance manual and SOPs
├── 04_KNOWLEDGE_BASE/         Taxonomy, glossary, and KB standards
├── 05_TEMPLATES/              Lessons, labs, scorecards, and agent cards
├── 06_IMPLEMENTATION/         Rollout plans and governance assignments
├── 07_PLATFORM/               Runnable reference platform
│   ├── backend/               Python FastAPI service
│   ├── frontend/              React/TypeScript interface
│   └── php/                   PHP health and integration endpoint
├── 08_INFRASTRUCTURE/         Docker, Nginx, Kubernetes, and scripts
├── 09_CONFIG/                 Environment and policy configuration
├── 10_DOCS/                   Architecture, security, API, and operations
├── .github/workflows/         CI validation
├── docker-compose.yml         Local platform orchestration
├── Makefile                   Standard developer commands
├── CONTRIBUTING.md            Contribution and review policy
├── SECURITY.md                Security disclosure and controls
├── CODE_OF_CONDUCT.md         Professional participation standard
├── CHANGELOG.md               Version history
└── LICENSE                    Internal-use license notice

Reference Architecture


                         ┌──────────────────────────┐
                         │        End User          │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │  React / TypeScript UI   │
                         │  Offline + Local Status  │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │     AI Request Router    │
                         │ complexity | privacy     │
                         │ network | capability     │
                         │ cost | risk | policy     │
                         └──────┬───────────┬───────┘
                                │           │
                    ┌───────────▼───┐   ┌──▼────────────────┐
                    │ Client-Side AI│   │ Server-Side AI    │
                    │ built-in/local│   │ FastAPI gateway   │
                    │ offline tasks │   │ models + tools    │
                    └───────────┬───┘   └──┬────────────────┘
                                │           │
                                └─────┬─────┘
                                      │
                         ┌────────────▼─────────────┐
                         │ Normalized AI Response   │
                         │ evidence | route | risk  │
                         │ latency | model | status │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │ Evaluation, Logging, Audit, Alerts │
                    └────────────────────────────────────┘

The architecture separates user experience, routing, inference, tools, knowledge, and governance. This prevents a model from becoming the entire application.

This diagram covers the hybrid AI routing reference feature specifically. Separately, the platform also ships a Postgres-backed operations console — curriculum and labs, certification tracking, a knowledge base, and an agent registry — that manages the academy's own operational data rather than routing model calls. See `10_DOCS/api/API_REFERENCE.md` for its full endpoint list.

Core Design Standard

Every AI feature must answer seven questions before release:

1. What exact task is being solved?
2. Which source of truth supports the result?
3. Where should inference run?
4. What can fail, and what is the fallback?
5. What actions require human approval?
6. How will quality, cost, and safety be measured?
7. How can the feature be disabled or rolled back?

No answer means no production release. “The model seemed smart in the demo” is not an architecture.

Client-Side, Server-Side, and Hybrid AI

Client-side AI

Use for:

- Summarization
- Translation
- Language detection
- Grammar correction
- Rephrasing
- Classification
- Short-form extraction
- Offline assistance
- Privacy-sensitive local processing
- High-frequency feature previews

Advantages:

- Low latency
- Offline availability
- Reduced server cost
- Local handling of sensitive content
- Better responsiveness

Constraints:

- Smaller models
- Device and browser variability
- Storage and memory limits
- Model download requirements
- Reduced reasoning and context capacity

Server-side AI

Use for:

- Complex reasoning
- Large models
- Long documents
- RAG and enterprise search
- Tool execution
- Current external information
- Multi-agent orchestration
- Central governance
- Cross-platform support

Advantages:

- Higher model capability
- Centralized controls
- Larger context windows
- Enterprise integrations
- Uniform platform coverage

Constraints:

- Network dependency
- Inference cost
- Cloud latency
- Data-handling obligations
- Provider availability

Hybrid AI

Use a hybrid approach when the application requires:

- Graceful fallback
- Offline continuity
- Broad device coverage
- Cost-aware routing
- Premium cloud features with local previews
- Privacy-sensitive preprocessing
- Resiliency during network degradation
- Different models for different task complexity

The reference router in `07_PLATFORM/backend/app/router.py` evaluates task complexity, privacy, network health, client capability, and risk before selecting a route.

Platform Features

Education and Certification

- 18 curriculum levels
- Structured module catalog
- Hands-on lab catalog
- Six progressive certifications
- Practical examinations
- Capstone board review
- Annual policy and security updates
- Biennial practical recertification
- Evidence-based certification decisions

Knowledge Management

- Controlled vocabulary and taxonomy
- Source hierarchy
- Freshness rules
- Versioned knowledge articles
- Owner and review-date requirements
- Citation and groundedness standards
- Deprecation and archival status

Agent Operations

- Agent cards
- Approved tool lists
- Permission scopes
- Human approval gates
- Time, token, and cost budgets
- Structured handoff contracts
- Audit events
- Kill switches
- Incident response

Production Engineering

- Python FastAPI backend
- JavaScript hybrid-routing client
- React/TypeScript multi-page operations console (curriculum, certification, knowledge base, agent registry)
- PostgreSQL persistence with startup seeding from the source CSVs
- PHP integration health endpoint
- Docker Compose local stack
- Nginx reverse proxy
- Kubernetes deployment templates
- Environment validation
- Health and readiness endpoints
- GitHub Actions CI
- Lint, syntax, and security checks
- Structured logging
- Request IDs
- Feature flags
- Normalized response contracts

Security and Governance

- Least privilege
- Secret isolation
- Prompt-injection defenses
- Input and output validation
- Data classification
- Human approval by risk tier
- Rate limits
- Audit trails
- Incident classification
- Rollback procedures
- Model and prompt versioning

Quick Start

Prerequisites

- Docker Desktop or Docker Engine with Compose
- Python 3.11+
- Node.js 20+
- PHP 8.2+ for the optional PHP service
- Git
- At least 4 GB free memory for the reference stack

1. Configure the environment

bash
cp .env.example .env

Review all values before starting. Never commit `.env`.

2. Validate configuration

bash
make validate

3. Start the platform

bash
docker compose up --build

Services:

| Service | URL | Purpose |
|---|---|---|
| Nginx gateway | `http://localhost:8080` | Recommended entry point — frontend and API are same-origin here, so login and every console page work with no cross-origin caveats. |
| Frontend (direct) | `http://localhost:3000` | The raw Vite dev server. Same pages, but a different browser origin from the gateway — `localStorage` (and therefore your login) does not carry over between the two. Fine for a quick look; use the gateway for anything interactive. |
| API | `http://localhost:8000` | AI routing, health, and academy data API |
| Postgres | `localhost:5432` | Persistence for curriculum, certification, KB, and agent data |
| PHP integration | `http://localhost:8081` | Lightweight integration health endpoint |

4. Check health

bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8081/health.php

5. Test the router

bash
curl -X POST http://localhost:8000/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "summarization",
    "input_chars": 1800,
    "requires_current_data": false,
    "contains_sensitive_data": true,
    "network_quality": "good",
    "client_ai_available": true,
    "risk_tier": 1
  }'

6. Explore the academy modules

bash
curl http://localhost:8000/v1/levels        # curriculum levels + modules
curl http://localhost:8000/v1/certifications # the six certification tiers
curl http://localhost:8000/v1/glossary       # KB glossary terms
curl http://localhost:8000/v1/agents         # registered agent cards (empty until you add one)
curl http://localhost:8000/v1/incidents      # logged incidents (empty until you add one)
curl http://localhost:8000/v1/releases       # release/change log (empty until you add one)
curl http://localhost:8000/v1/governance/raci # governance RACI matrix (seeded on first boot)

Or visit the console pages directly: `/levels`, `/labs`, `/certifications`, `/learners`, `/glossary`, `/knowledge-base`, `/agents`, `/incidents`, `/releases`, `/governance`, `/audit-log`, `/users` (admin only) — under `http://localhost:8080` (the gateway; use this one). Full endpoint reference: `10_DOCS/api/API_REFERENCE.md`.

7. Log in to make changes

Reading data needs no login, but creating, editing, or deleting anything does. A default account is seeded on first boot:


username: admin
password: admin

Change this before any real use — it's a dev-only default, and it now matters even more: `admin` is an `admin`-role account, and admin is the only role that can create other accounts, so it's your one bootstrap path into user management. Log in at `http://localhost:8080/login` (the gateway — see the note on the Frontend row above about why `:3000` gives you a separate, non-carrying-over session), or directly:

```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'

The response's `access_token` is a bearer token — send it as `Authorization: Bearer <token>` on any mutating request.

Login attempts are rate-limited (5/minute per IP by default) as a brute-force deterrent — if you mistype the password a few times while testing and start seeing `429 Too Many Requests`, that's why; wait a minute and try again. Mutating requests generally are also rate-limited (60/minute by default); see `10_DOCS/api/API_REFERENCE.md` for details.

Every mutation you make while logged in shows up on the `/audit-log` page — who did what, when, and the resulting status code. That page itself requires login to view.

Every list page has an "Export CSV" button that downloads the full matching set (respecting whatever filters are currently set on screen, but not the pagination limit) — useful for reporting outside the app. See `10_DOCS/api/API_REFERENCE.md`'s CSV export section for the underlying endpoints.

Most also have an "Import CSV" button next to it, for bulk-creating records from a file instead of one at a time — the exceptions are Levels, Certifications, and the Audit Log, none of which can be created through the app at all (seed-only or system-generated). A bad row is skipped and reported, not fatal to the rest of the file. See the CSV import section of the same doc — and note that importing users needs a plaintext password column in the file.

There are two roles: `admin` and `contributor`. Both can create/edit/delete academy content the same as today; only `admin` can manage accounts at `/users` (visible in the nav only to admins) — create new users, change roles, or remove a user (you can't delete the last remaining admin). See `10_DOCS/api/API_REFERENCE.md`'s Users section for the underlying endpoints.

Testing

bash
docker compose exec api python -m pytest -q          # backend
docker compose exec frontend npm run test             # frontend unit tests (Vitest + RTL)
docker compose exec frontend npm run build             # typecheck + production build

There's also a Playwright end-to-end suite that drives a real browser against the actual running stack (login, create/delete a record, confirm it hits the audit log and dashboard, CSV export) — a different kind of coverage than the tests above, which mock the network layer. It runs from the **host**, not inside the `frontend` container: that container's image is Alpine-based, and Playwright's bundled Chromium doesn't reliably run under Alpine's musl libc.

bash
docker compose up -d                       # stack must already be running
cd 07_PLATFORM/frontend
npm install                                # one-time, pulls in @playwright/test
npx playwright install chromium            # one-time browser download
npm run test:e2e

Defaults to `http://localhost:8082` (the gateway); override with `E2E_BASE_URL` if you've remapped `GATEWAY_PORT`. The suite is safe to re-run repeatedly — every throwaway record it creates gets deleted again before the test finishes. The one exception is a small `e2e-fixture-contributor` account it creates once and reuses (along with a cached admin session) across runs — by design, so the suite doesn't burn through the login endpoint's rate limit (5/minute per IP) by re-authenticating on every run; delete `07_PLATFORM/frontend/e2e/.auth/` to force fresh logins. Re-running the full suite many times within the same minute will eventually hit that same rate limit — expected, not a bug, since it's really exercising the real limiter.

Configuration

The primary configuration template is `.env.example`.

Key settings:

| Variable | Purpose |
|---|---|
| `APP_ENV` | Runtime environment |
| `APP_VERSION` | Released platform version |
| `API_PORT` | Backend port |
| `FRONTEND_PORT` | Frontend port |
| `AI_DEFAULT_ROUTE` | Default inference preference |
| `AI_SERVER_PROVIDER` | Server model provider identifier |
| `AI_SERVER_MODEL` | Approved server model |
| `AI_LOCAL_ENABLED` | Enables client/local route consideration |
| `AI_MAX_INPUT_CHARS_LOCAL` | Local routing threshold |
| `AI_MAX_INPUT_CHARS_SERVER` | Server input ceiling |
| `AI_REQUEST_TIMEOUT_SECONDS` | Server timeout |
| `AI_DAILY_COST_LIMIT_USD` | Daily inference budget |
| `AUDIT_LOG_ENABLED` | Enables structured audit events |
| `REQUIRE_HUMAN_APPROVAL_TIER` | Risk tier requiring approval |

Provider keys belong in a secret manager or local `.env`, never in source control.

API Contract

The examples below cover the hybrid AI routing contract only. The curriculum, certification, knowledge base, and agent registry REST APIs (~20 endpoints, full CRUD) are documented in `10_DOCS/api/API_REFERENCE.md`. All GET endpoints are public; every POST/PUT/DELETE requires a bearer token from `POST /v1/auth/login` (see Quick Start step 7).

Route decision

`POST /v1/route`

Example response:

json
{
  "route": "client",
  "reason": "Sensitive, bounded task with local capability available.",
  "degraded_mode": false,
  "requires_human_approval": false,
  "policy_version": "2.0.0"
}

Normalized generation result

All providers should map to:

json
{
  "success": true,
  "text": "Generated response",
  "execution_mode": "client",
  "provider": "built-in",
  "model": "browser-managed",
  "degraded_mode": false,
  "grounded": true,
  "citations": [],
  "latency_ms": 245,
  "request_id": "req_...",
  "policy_version": "2.0.0"
}

The UI must not depend on provider-specific response shapes.

Governance Standard

Risk tiers

| Tier | Description | Control |
|---|---|---|
| 0 | Deterministic utility | Normal software controls |
| 1 | Low-impact assistance | User review |
| 2 | Operational recommendation | Named human approval |
| 3 | External, financial, legal, security, or customer-impacting action | Explicit approval and full audit |
| 4 | Prohibited autonomous action unless separately authorized | Executive governance |

Production gate

Every release requires:

- Named owner
- Approved use case
- Assigned risk tier
- Data classification
- Model and prompt version
- Evaluation report
- Security test evidence
- Tool permission review
- Cost and capacity test
- Fallback test
- Rollback test
- Monitoring and alerts
- Incident contact
- Recorded approval

Security Standard

- Treat model output as untrusted input.
- Sanitize generated markup before rendering.
- Never execute generated code automatically.
- Never place provider secrets in browser bundles.
- Apply least privilege to every tool.
- Separate retrieval content from system instructions.
- Defend against prompt injection from users, files, pages, and tool output.
- Validate structured output against schemas.
- Require human approval for irreversible or external actions.
- Log model, prompt, tool, user, route, and approval identifiers.
- Maintain a kill switch for every agentic feature.

See `SECURITY.md` and `10_DOCS/security/THREAT_MODEL.md`.

Evaluation Standard

The academy scorecard measures:

- Task accuracy
- Groundedness
- Format compliance
- Safety and policy compliance
- Latency
- Cost
- Fallback reliability

A model or prompt is not promoted because it produces one impressive response. It must pass a representative and adversarial test set.

Required evaluation classes:

- Happy path
- Ambiguous input
- Missing evidence
- Adversarial prompt
- Prompt injection
- Oversized input
- Tool failure
- Network failure
- Provider timeout
- Duplicate execution
- Schema violation
- High-risk action request

Development Commands

bash
make help
make install
make validate
make test
make lint
make up
make down
make logs
make clean

Documentation Map

| Document | Purpose |
|---|---|
| `01_CURRICULUM/AI_Training_Curriculum.md` | Complete training structure |
| `02_CERTIFICATION/Certification_Path.md` | Certification requirements |
| `03_OPERATING_MANUAL/Internal_Operating_Manual.md` | Governing doctrine |
| `04_KNOWLEDGE_BASE/Knowledge_Base_Index.md` | Knowledge management standard |
| `10_DOCS/architecture/SYSTEM_ARCHITECTURE.md` | Technical architecture |
| `10_DOCS/security/THREAT_MODEL.md` | Security boundaries and threats |
| `10_DOCS/operations/RUNBOOK.md` | Operating procedures |
| `10_DOCS/development/DEVELOPER_GUIDE.md` | Build and contribution guide |
| `10_DOCS/api/API_REFERENCE.md` | API endpoints and schemas |
| `CONTRIBUTING.md` | Contribution workflow |
| `SECURITY.md` | Security policy |
| `CHANGELOG.md` | Release history |

Contribution Workflow

1. Open an issue or architecture decision.
2. Identify owner and risk tier.
3. Create a feature branch.
4. Update code, tests, documentation, and evidence.
5. Run validation locally.
6. Submit a pull request.
7. Obtain technical, security, and domain approval as required.
8. Merge only after CI passes.
9. Release behind a feature flag when risk warrants.
10. Monitor and record outcomes.

See `CONTRIBUTING.md`.

Versioning

The repository follows semantic versioning:

- Major: Governance, architecture, or compatibility change
- Minor: New curriculum level, API, integration, or production feature
- Patch: Corrections, clarifications, tests, and non-breaking improvements

Model IDs, prompts, policies, schemas, and knowledge collections must be versioned independently.

Current institutional package: 2.0.0

Roadmap

Phase 1 — Academy foundation

- Curriculum publication
- LMS import
- Pilot cohort
- Initial certification exams
- Source and taxonomy governance

Phase 2 — Production labs

- Hybrid routing lab
- Offline AI lab
- Grounded assistant lab
- Agent deployment lab
- Incident rollback lab

Phase 3 — Enterprise platform

- Identity integration
- Learning analytics
- Certification registry
- Model gateway
- Prompt registry
- Evaluation service
- Agent registry
- Cost dashboard
- Policy engine

Phase 4 — Continuous intelligence

- Automated documentation freshness checks
- Model deprecation alerts
- Evaluation drift detection
- Recertification automation
- Knowledge graph
- Multi-agent training simulations

Source Basis

The original training source is retained under:


00_SOURCE/AI_TRAINING_SOURCE.pdf

The source covers built-in AI, client-side inference, server-side AI, hybrid routing, offline execution, graceful fallback, Chrome-oriented task APIs, model availability, fine-tuning, content consumption, content creation, and related web AI implementation guidance.

Current APIs, model availability, release channels, pricing, hardware requirements, and provider policies must be revalidated before production use.

License and Use

This repository is an internal institutional training and reference package. Review `LICENSE` before redistribution or commercial publication.

Final Standard

The Academy’s production doctrine is simple:

> Use the smallest capable model, route each task to the appropriate environment, ground consequential claims, constrain tools, require approval by risk, monitor everything that matters, and always maintain a fallback and rollback path.

=========================================================================================================================================================================
                                                AI TRAINING ACADEMY™
                                  INSTITUTIONAL PRODUCTION-READY ENTERPRISE ARCHITECTURE
=========================================================================================================================================================================

                                                          ┌────────────────────────────┐
                                                          │        ENTERPRISE VISION    │
                                                          │────────────────────────────│
                                                          │ Mission                    │
                                                          │ Strategy                   │
                                                          │ Institutional Objectives   │
                                                          │ Enterprise Value           │
                                                          └─────────────┬──────────────┘
                                                                        │
                                                                        ▼
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                                         SPRINT 1 — ENTERPRISE GOVERNANCE
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

     ┌──────────────────────┐
     │ GOVERNANCE BOARD     │
     └─────────┬────────────┘
               │
               ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ GOVERNANCE FOUNDATION                                                                                                                                    │
 ├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ Enterprise Charter                                                                                                                                        │
 │ Operating Model                                                                                                                                           │
 │ Organizational Structure                                                                                                                                  │
 │ Decision Rights                                                                                                                                            │
 │ Policy Management                                                                                                                                         │
 │ Records Management                                                                                                                                        │
 │ Change Governance                                                                                                                                         │
 │ Meeting Governance                                                                                                                                         │
 │ Voting & Approval                                                                                                                                         │
 │ Executive Dashboard                                                                                                                                       │
 │ Enterprise Metrics                                                                                                                                         │
 │ Governance Audit                                                                                                                                          │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ OUTPUT                                                                                                                                                │
 ├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ Governance Authority                                                                                                                                    │
 │ Enterprise Policies                                                                                                                                      │
 │ Organizational Accountability                                                                                                                           │
 │ Institutional Leadership                                                                                                                                │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼

═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                                   SPRINT 2 — ENTERPRISE CONTROL SYSTEM
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REQUIREMENTS MANAGEMENT                                                                                                                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Enterprise Requirements                                                                                                                                    │
│ Standards                                                                                                                                                  │
│ Acceptance Criteria                                                                                                                                         │
│ Compliance Requirements                                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CONTROL SYSTEM                                                                                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Control Library                                                                                                                                            │
│ Risk Management                                                                                                                                            │
│ Security                                                                                                                                                    │
│ Privacy                                                                                                                                                     │
│ Accessibility                                                                                                                                              │
│ AI Ethics                                                                                                                                                   │
│ Quality Assurance                                                                                                                                            │
│ Legal                                                                                                                                                       │
│ Audit                                                                                                                                                       │
│ Monitoring                                                                                                                                                  │
│ Analytics                                                                                                                                                   │
│ Notifications                                                                                                                                               │
│ Verification                                                                                                                                                │
│ Traceability                                                                                                                                                 │
│ Corrective Action (CAPA)                                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
                                     TRACEABILITY ENGINE

 Requirement
      │
      ▼
 Control
      │
      ▼
 Implementation
      │
      ▼
 Verification
      │
      ▼
 Evidence
      │
      ▼
 Findings
      │
      ▼
 Corrective Action
      │
      ▼
 Independent Review
      │
      ▼
 Acceptance

               │
               ▼

═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                                  SPRINT 3 — PLATFORM ENGINEERING
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

                                          FRONTEND EXPERIENCE

 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ React / Next.js / TypeScript                                                                               │
 │ Component Library                                                                                           │
 │ Dashboard                                                                                                   │
 │ LMS                                                                                                         │
 │ Assessments                                                                                                 │
 │ Certification                                                                                                │
 │ AI Workspace                                                                                                 │
 │ Reporting                                                                                                    │
 │ Administration                                                                                                │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼

                                   API GATEWAY / APPLICATION LAYER

 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ Authentication                                                                                              │
 │ Authorization                                                                                               │
 │ Tenant Isolation                                                                                             │
 │ API Validation                                                                                                │
 │ Rate Limiting                                                                                                 │
 │ Versioning                                                                                                    │
 │ Audit Middleware                                                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼

                                         BUSINESS SERVICES

      ┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
      │ LMS         │ Curriculum   │ Assessment   │ Certification│ AI Agents    │
      ├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
      │ Services    │ Reporting    │ Workflow     │ Search       │ Support      │
      └─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
                                              │
                                              ▼

═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                           DATA + WORKFLOW + TELEMETRY LAYER
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

     ┌──────────────────────┐
     │ PostgreSQL           │
     │──────────────────────│
     │ Users                │
     │ Roles                │
     │ Artifacts            │
     │ Requirements         │
     │ Controls             │
     │ Services             │
     │ Incidents            │
     │ Evidence             │
     │ Audit                │
     └─────────┬────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ Workflow Engine      │
     │──────────────────────│
     │ Approvals            │
     │ Releases             │
     │ Changes              │
     │ Notifications        │
     │ AI Tasks             │
     └─────────┬────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ Telemetry            │
     │──────────────────────│
     │ Metrics              │
     │ Logs                 │
     │ Traces               │
     │ Events               │
     │ Alerts               │
     └─────────┬────────────┘
               │
               ▼

═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                               SPRINT 4 — OPERATIONS
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

     RELEASE
        │
        ▼
     CHANGE
        │
        ▼
 CONFIGURATION (CMDB)
        │
        ▼
 SERVICE CATALOG
        │
        ▼
 SERVICE REQUEST
        │
        ▼
 INCIDENT
        │
        ▼
 PROBLEM
        │
        ▼
 ROOT CAUSE
        │
        ▼
 KNOWN ERROR
        │
        ▼
 CORRECTIVE ACTION
        │
        ▼
 VERIFICATION
        │
        ▼
 ACCEPTANCE
        │
        ▼
 CONTINUAL IMPROVEMENT

═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                            MANUBI PRODUCTION IMPLEMENTATION
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

                           Existing index.html (Visual Shell)
                                         │
                                         ▼
                          Modular React / Next.js Components
                                         │
                                         ▼
                               Secure REST / GraphQL APIs
                                         │
                                         ▼
                           Enterprise Identity + RBAC + MFA
                                         │
                                         ▼
                         PostgreSQL + Object Storage + Search
                                         │
                                         ▼
                           Workflow Engine + Event Bus
                                         │
                                         ▼
                        OpenTelemetry + Monitoring + Alerting
                                         │
                                         ▼
                        Evidence Registry + Audit Trail
                                         │
                                         ▼
                    Independent Verification + Executive Approval
                                         │
                                         ▼
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                         INSTITUTIONAL PRODUCTION READY
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

                         USER ACTION
                              │
                              ▼
                     Identity Verified
                              │
                              ▼
                    Authorization Checked
                              │
                              ▼
                     API Request Validated
                              │
                              ▼
                    Workflow Executes Safely
                              │
                              ▼
                  Database Transaction Committed
                              │
                              ▼
                   Audit Record Automatically Written
                              │
                              ▼
                Evidence Object Created & Hash Verified
                              │
                              ▼
                 Telemetry Published & Monitored
                              │
                              ▼
                  Requirement ⇄ Control ⇄ Evidence
                              │
                              ▼
                   Independent Verification Passed
                              │
                              ▼
                   Executive Acceptance Recorded
                              │
                              ▼
                   CONTINUAL IMPROVEMENT LOOP
                              │
                              └───────────────────────────────────────┐
                                                                      │
                                                                      ▼
                                                           NEXT CONTROLLED RELEASE

=========================================================================================================================================================================
MISSION
=========================================================================================================================================================================

      GOVERN
          │
          ▼
      CONTROL
          │
          ▼
      ENGINEER
          │
          ▼
      IMPLEMENT
          │
          ▼
      VERIFY
          │
          ▼
      OPERATE
          │
          ▼
      MEASURE
          │
          ▼
      IMPROVE
          │
          ▼
      REPEAT
