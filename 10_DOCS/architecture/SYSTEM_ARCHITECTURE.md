# System Architecture

## Layers

1. Experience layer
2. Request and policy router
3. Client-side inference
4. Server-side model gateway
5. Retrieval and knowledge
6. Tool execution
7. Evaluation and policy enforcement
8. Audit, metrics, and incident controls

## Trust boundaries

- Browser to gateway
- Gateway to model provider
- Model to tool
- Retrieval content to prompt
- Agent to external action
- Training content to certification decision

## Architectural rules

- Provider-specific behavior stays behind adapters.
- Tools use typed schemas and least privilege.
- Retrieved text cannot override system policy.
- High-risk actions require approval.
- Every path returns a normalized response.
- Every critical dependency has a fallback or a documented fail-closed mode.
