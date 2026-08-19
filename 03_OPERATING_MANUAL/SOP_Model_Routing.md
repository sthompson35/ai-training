# SOP: Model and Execution Routing

1. Classify task: deterministic, task API, generative, retrieval, agentic.
2. Measure complexity: input size, reasoning depth, tools, freshness, and output risk.
3. Check privacy and data-residency requirements.
4. Check client capability and model availability.
5. Check network health.
6. Select route:
   - Client: bounded, frequent, private, latency-sensitive, offline-capable.
   - Server: complex, large-context, current, tool-connected, or device-agnostic.
   - Hybrid: mixed requirements or fallback needed.
7. Apply cost ceiling, timeout, and retry budget.
8. Normalize result into the approved response contract.
9. Log route, model, latency, tokens, failures, and fallback.
10. Review routing metrics monthly.
