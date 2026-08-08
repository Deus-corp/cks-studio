# Security Policy

## Supported Versions

CKS Studio is in active early development. Security fixes are provided for the latest release.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |

## Reporting a Vulnerability

Please do **not** open a public issue. Instead, report vulnerabilities privately via GitHub's Security Advisory system or contact the maintainer directly.

Include:
- description of the issue
- affected version
- steps to reproduce
- expected vs actual behavior
- proof-of-concept if available

## Scope

Primary security considerations for a frontend application:

- **MCP transport security** — data in transit between CKS Studio and `cks-mcp`
- **Input sanitization** — safe rendering of knowledge object content
- **Dependency auditing** — regular `npm audit` and automated Dependabot
- **CORS / CSP headers** — when deployed as a web application
- **No backend logic** — CKS Studio is a thin client; all authority rests with `cks-mcp` and the storage backend

## Security Philosophy

CKS Studio intentionally holds no secrets, performs no authentication, and executes no server-side logic. It is a read-only view (with write operations deferred to `cks-mcp` tools). This minimal surface reduces risk and keeps the security boundary at the MCP server.