---
name: security-and-hardening
description: "Use when auditing for security vulnerabilities, implementing auth or authz, handling secrets, or hardening against OWASP Top 10 - covers input validation, authentication, dependency auditing, and secure defaults."
---

# Security & Hardening

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Validate at every boundary.** Decode at the edge, trust the types inside.
- **Secrets never in code, logs, or git.** Env vars; vault for prod.
- **Authn ≠ Authz.** Who you are ≠ what you can do.
- **Least privilege by default.** Deny by default, allow explicitly.
- **Log security events.** Failed logins, denials, secret access — never the secrets themselves.
</EXTREMELY-IMPORTANT>

## OWASP Top 10 (Quick Map)

| Risk | Defense |
|---|---|
| Injection | Parameterized queries, schema-validated input |
| Broken auth | Rate limit, MFA, bcrypt/argon2 |
| Data exposure | Encrypt at rest + transit, minimize retention |
| XXE | Disable external entities |
| Access control | Authz on every action, deny default |
| Misconfig | Secure defaults, no debug in prod, headers |
| XSS | Output encoding, CSP, no innerHTML with user input |
| Deserialization | Schema-validate, no eval on untrusted |
| Vulns (deps) | `npm audit`, Dependabot, lockfile pinning |
| Logging | Auth events, anomalies, access denials |

## Input Validation

Validate at the boundary; trust types inside. Schema (Zod, Effect Schema) for all external input; reject unknown fields by default; length, character class, and format limits per field.

## Authentication

bcrypt or argon2 for password hashing (never md5, sha1). Rate limit login (5 per 15 min per IP and per account); MFA for sensitive accounts. Sessions: random, signed, httpOnly cookie, short expiry; refresh tokens separate with rotation.

## Authorization

Check on every request; never trust the frontend. Use a policy engine (CASL, Oso) or explicit checks. Test the negative — "user A accesses user B's resource" must fail. Audit log access denials.

## Secrets

Env vars locally (never `.env` in git); CI secret store; vault for prod (HashiCorp Vault, AWS Secrets Manager). Rotate regularly and on suspected leak; never log secrets; scrub logs for known patterns.

## Dependencies

`npm audit` and `npm audit fix`; pin versions in the lockfile; review major bumps; subscribe to advisories.

## Secure Headers

Use `helmet()`, or set explicitly: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy: default-src 'self'`, `Referrer-Policy`.

## Common Mistakes

Plain-text passwords; md5/sha1; SQL string concat; "trust the frontend" authz; secrets in git; no rate limit on auth; session in localStorage; no CSP; logging secrets; no HTTPS; user-controlled redirects; eval on input; no CORS config; no security headers; default admin creds; error messages revealing internals.

## Red Flags

`.env` in git; bcrypt replaced with sha256; "auth later"; client-trusted user IDs; no rate limit; secrets in logs; no CSP; permissive CORS; default creds; SQL concat; eval on input; "private" routes without auth.

## Anti-Patterns

**"Auth later"**; **bcrypt-less**; **client-trusted IDs**; **no rate limit**; **secrets in code**; **"we're internal"**; **security by obscurity**.
