# AI Training Academy — Full Curriculum

## Mission

Create a governed, production-oriented learning system that teaches people and AI agents to design, build, operate, evaluate, and improve trustworthy AI capabilities.

## Graduate Profile

A graduate can select the correct model and execution environment, build client-side and server-side AI, implement hybrid routing, ground outputs in approved sources, connect tools safely, evaluate performance, control cost, and operate the system under documented governance.

## Learning Model

Every module contains:
1. Learning objectives
2. Required vocabulary
3. Core lesson
4. Architecture pattern
5. Demonstration
6. Guided lab
7. Independent lab
8. Failure-mode review
9. Knowledge check
10. Practical assessment
11. Evidence submission
12. Version and source record

## Program Rules

- Source-grounded claims take priority over model memory.
- High-impact actions require explicit authorization.
- Generated outputs are treated as untrusted until validated.
- Every production feature must have monitoring, fallback, and rollback.
- Use the smallest model that meets measurable success criteria.
- Separate creation, verification, and approval wherever practical.
- Stable interfaces are preferred for production; previews remain feature-flagged.
- Client-side and server-side execution must return normalized application contracts.

## Curriculum Map

### Level 00: Orientation and AI Literacy

**00.1 — Mission, scope, and responsible use**  
Outcome: Explain the academy mission, acceptable use, human accountability, and the difference between assistance and autonomous execution.

**00.2 — AI terminology and system map**  
Outcome: Use core terms correctly: model, parameter, token, context, inference, fine-tuning, embeddings, RAG, agent, tool, memory, and evaluation.

**00.3 — AI risk awareness**  
Outcome: Identify hallucinations, non-determinism, prompt injection, privacy exposure, and over-automation.

### Level 01: AI Foundations

**01.1 — Machine learning and neural networks**  
Outcome: Describe training, validation, inference, weights, and model generalization.

**01.2 — Transformers and attention**  
Outcome: Explain attention, tokenization, embeddings, layers, and context windows.

**01.3 — Model classes and right-sizing**  
Outcome: Compare expert models, foundation models, SLMs, LLMs, multimodal models, and task-specific models.

**01.4 — Inference economics**  
Outcome: Estimate latency, throughput, token usage, hardware requirements, and cost.

### Level 02: Prompt Engineering

**02.1 — Prompt anatomy**  
Outcome: Construct system, developer, user, context, constraints, examples, and output schemas.

**02.2 — Few-shot and structured prompting**  
Outcome: Use examples, rubrics, JSON schemas, and deterministic formatting.

**02.3 — Prompt chains and decomposition**  
Outcome: Break complex work into bounded stages with verification gates.

**02.4 — Prompt testing and version control**  
Outcome: Create prompt test sets, compare versions, and manage regression risk.

### Level 03: Built-in and Client-Side AI

**03.1 — Built-in AI task APIs**  
Outcome: Select summarization, translation, language detection, writing, rewriting, proofreading, and prompt APIs.

**03.2 — On-device model availability**  
Outcome: Handle available, downloadable, downloading, and unavailable states.

**03.3 — Hardware, storage, and runtime constraints**  
Outcome: Plan for CPU, GPU, NPU, RAM, VRAM, disk, battery, and download limits.

**03.4 — Offline AI and privacy**  
Outcome: Design local inference workflows that preserve core features without connectivity.

### Level 04: Server-Side and Cloud AI

**04.1 — Cloud model selection**  
Outcome: Match model capacity, context, tools, latency, and pricing to the workload.

**04.2 — Secure API architecture**  
Outcome: Protect credentials, authenticate users, rate-limit requests, and isolate secrets.

**04.3 — Streaming, state, and background work**  
Outcome: Implement streaming responses, multi-turn state, retries, and long-running jobs.

**04.4 — Cloud cost controls**  
Outcome: Use quotas, caching, batching, monitoring, and model routing.

### Level 05: Hybrid AI Architecture

**05.1 — Client/server routing**  
Outcome: Route by complexity, privacy, connectivity, device capability, cost, and business tier.

**05.2 — Graceful fallback**  
Outcome: Provide alternate execution paths when models, devices, networks, or APIs fail.

**05.3 — Resiliency patterns**  
Outcome: Use server-first, local-first, and adaptive strategies appropriately.

**05.4 — Unified response contracts**  
Outcome: Normalize outputs so the application remains provider-agnostic.

### Level 06: AI-Enhanced Content Consumption

**06.1 — Summarization**  
Outcome: Produce faithful summaries at multiple lengths and validate factual alignment.

**06.2 — Translation and language detection**  
Outcome: Support multilingual content while preserving meaning and tone.

**06.3 — Categorization and characterization**  
Outcome: Extract topic, intent, sentiment, entities, risk, priority, and actions.

**06.4 — Knowledge provider experiences**  
Outcome: Answer grounded questions across approved sources with citations.

### Level 07: AI-Supported Content Creation

**07.1 — Writing assistance**  
Outcome: Generate outlines, drafts, and audience-specific content from verified facts.

**07.2 — Proofreading and grammar correction**  
Outcome: Correct mechanics without changing intent or facts.

**07.3 — Rephrasing and tone control**  
Outcome: Adapt clarity, formality, persuasion, reading level, and channel.

**07.4 — Human approval and publication**  
Outcome: Apply review gates to high-impact content.

### Level 08: Knowledge Systems and RAG

**08.1 — Document ingestion and chunking**  
Outcome: Prepare source content with metadata, access controls, and quality checks.

**08.2 — Embeddings and vector search**  
Outcome: Build semantic retrieval and understand similarity limitations.

**08.3 — Hybrid retrieval and reranking**  
Outcome: Combine keyword, vector, graph, and metadata filters.

**08.4 — Grounded generation and citations**  
Outcome: Require source support, traceability, and refusal when evidence is missing.

### Level 09: Fine-Tuning and Model Adaptation

**09.1 — Prompting versus fine-tuning**  
Outcome: Choose adaptation methods based on task repetition, quality, and data availability.

**09.2 — Fine-tuning data design**  
Outcome: Create labeled examples, split datasets, and prevent leakage.

**09.3 — LoRA, quantization, pruning, and distillation**  
Outcome: Understand efficient adaptation and model shrinking.

**09.4 — Evaluation and rollback**  
Outcome: Benchmark adapted models against baselines before release.

### Level 10: AI Agents and Tool Use

**10.1 — Agent architecture**  
Outcome: Design planner, executor, reviewer, memory, and supervisor roles.

**10.2 — Function calling and tools**  
Outcome: Connect models to APIs, databases, code execution, files, search, and business systems.

**10.3 — Agent memory and state**  
Outcome: Separate session memory, durable memory, source knowledge, and audit history.

**10.4 — Human-in-the-loop controls**  
Outcome: Define approval thresholds, action permissions, and escalation paths.

### Level 11: Multi-Agent Systems

**11.1 — Delegation and orchestration**  
Outcome: Assign work by capability and prevent duplicate or conflicting execution.

**11.2 — Shared context and communication**  
Outcome: Use structured handoffs, contracts, and evidence bundles.

**11.3 — Reviewer and verification agents**  
Outcome: Separate generation from validation and authorization.

**11.4 — Failure containment**  
Outcome: Limit blast radius with scopes, budgets, timeouts, and kill switches.

### Level 12: Automation and Integration

**12.1 — APIs, webhooks, and event flows**  
Outcome: Build reliable triggers, actions, callbacks, and idempotency.

**12.2 — Workflow orchestration**  
Outcome: Use queues, retries, branching, human approvals, and compensating actions.

**12.3 — MCP and connected tools**  
Outcome: Expose governed capabilities and current documentation to agents.

**12.4 — Observability**  
Outcome: Track inputs, outputs, tool calls, latency, failures, and cost.

### Level 13: AI Software and Infrastructure

**13.1 — Application architecture**  
Outcome: Separate UI, orchestration, model gateway, tools, data, and evaluation layers.

**13.2 — Local runtimes and model formats**  
Outcome: Operate LM Studio, llama.cpp-style runtimes, GGUF, quantization, and GPU offload.

**13.3 — Containers, CI/CD, and deployment**  
Outcome: Package, test, release, and roll back AI services safely.

**13.4 — Capacity planning**  
Outcome: Plan concurrency, memory, storage, bandwidth, and fallback capacity.

### Level 14: Security, Privacy, and Governance

**14.1 — Threat model**  
Outcome: Address prompt injection, data exfiltration, malicious tools, model abuse, and supply-chain risk.

**14.2 — Identity and access control**  
Outcome: Apply least privilege, user consent, tenant isolation, and secrets management.

**14.3 — Data governance**  
Outcome: Classify data, enforce retention, maintain lineage, and control training use.

**14.4 — Audit and compliance**  
Outcome: Maintain logs, approvals, model cards, incidents, and policy evidence.

### Level 15: Evaluation and AI Operations

**15.1 — Quality metrics**  
Outcome: Measure accuracy, alignment, coverage, richness, groundedness, usefulness, and format compliance.

**15.2 — Automated and human evaluation**  
Outcome: Use test sets, reviewers, model-as-judge carefully, and adjudication.

**15.3 — Production monitoring**  
Outcome: Detect drift, regressions, unusual cost, latency, and safety failures.

**15.4 — Incident response**  
Outcome: Triage, contain, roll back, communicate, and prevent recurrence.

### Level 16: Business and Enterprise AI

**16.1 — Use-case selection**  
Outcome: Prioritize measurable value, feasibility, risk, adoption, and data readiness.

**16.2 — Product design and monetization**  
Outcome: Use client-side previews, premium cloud features, and cost-aware routing.

**16.3 — Change management**  
Outcome: Train users, redesign work, establish accountability, and measure adoption.

**16.4 — Executive governance**  
Outcome: Manage portfolio, vendors, investment, risk appetite, and strategic roadmaps.

### Level 17: Capstones and Mastery

**17.1 — Built-in AI application**  
Outcome: Ship a task-API feature with model availability handling and offline behavior.

**17.2 — Hybrid AI platform**  
Outcome: Implement dynamic routing, server fallback, unified contracts, and monitoring.

**17.3 — Grounded agent system**  
Outcome: Build an agent with RAG, tools, approvals, citations, and audit trails.

**17.4 — Enterprise production review**  
Outcome: Defend architecture, security, economics, evaluation evidence, and operating plan.

## Delivery Formats

- Instructor-led cohort
- Self-paced learning management system
- Agent boot camp
- Technical apprenticeship
- Executive briefing track
- Internal annual recertification

## Standard Assessment Mix

- Knowledge checks: 20%
- Guided labs: 20%
- Independent labs: 25%
- Scenario examination: 15%
- Capstone evidence: 20%

## Minimum Passing Standard

- 80% overall
- 100% completion of required security and governance labs
- No unresolved critical defect in capstone
- Evidence of rollback, monitoring, and human approval controls
