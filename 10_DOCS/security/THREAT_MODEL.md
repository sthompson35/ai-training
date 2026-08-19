# Threat Model

## Protected assets

- User data
- Training records
- Certification decisions
- Provider credentials
- Tool permissions
- Knowledge sources
- Audit logs
- Model and prompt configurations

## Primary threats

- Prompt injection
- Data exfiltration
- Malicious retrieved content
- Unauthorized tool execution
- Hallucinated factual claims
- Cross-tenant data leakage
- Secret exposure
- Cost exhaustion
- Model supply-chain compromise
- Unreviewed high-impact actions

## Controls

- Isolation of instructions from untrusted content
- Access control
- Output validation
- Tool allowlists
- Approval gates
- Quotas
- Audit logs
- Versioning
- Feature flags
- Kill switches
- Incident response
