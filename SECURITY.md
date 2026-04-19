# Security Policy

## Reporting A Vulnerability

Please do not open a public issue for undisclosed security vulnerabilities.

Instead, report security concerns privately to the project maintainers through
the contact channel listed in the repository profile or release notes. Include:

- a clear description of the issue
- reproduction steps
- affected files or flows
- impact assessment
- any suggested mitigation

## Scope

Because ShadowCursor can inspect page structure, capture screenshots, and send
context to external AI providers, security review should focus on:

- accidental exposure of sensitive page data
- unsafe automation on privileged web consoles
- key handling and storage
- host permission scope
- prompt injection or malicious DOM content influencing actions

## Operational Guidance

- Do not commit API keys, recordings, screenshots, or session artifacts.
- Review any change that expands permissions or host access.
- Prefer supervised execution for high-risk or destructive actions.
- Treat production or regulated environments as higher-risk deployments.
