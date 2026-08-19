# Security Policy

## Reporting

Report suspected vulnerabilities privately to the designated security owner. Do not publish credentials, exploit details, or private data in issues.

## Mandatory controls

- Secrets stored outside source control
- Least-privilege tool access
- Schema validation for model output
- Sanitization before rendering generated content
- Prompt-injection testing
- Authentication and authorization for server endpoints
- Rate and cost limits
- Audit logs for agent actions
- Human approval for Tier 2+ actions
- Feature flags and kill switches
- Incident preservation and root-cause review

## Unsupported practices

- Hardcoded production API keys
- Automatic execution of generated code
- Direct rendering of unsanitized generated HTML
- Autonomous financial, legal, security, or external actions without authorization
- Treating retrieved documents as trusted instructions
