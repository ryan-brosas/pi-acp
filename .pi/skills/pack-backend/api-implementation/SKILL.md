---
name: api-implementation
description: 'Use when designing or implementing HTTP APIs - REST, GraphQL, gRPC, validation, pagination, error contracts, idempotency, and versioning.'
disable-model-invocation: true
---

# API Implementation

## Use when

Designing or building HTTP APIs, adding endpoints, or standardizing error and versioning contracts.

## Do not use when

Internal function calls or library interfaces; those belong to `api-and-interface-design`.

## Key rules

- Choose the protocol by client need: REST for CRUD over HTTP, GraphQL for client-shaped queries, gRPC for internal service-to-service calls.
- Validate every input at the boundary with a schema; reject unknown fields by default.
- Consistent error envelope: machine-readable code, message, details, and a stable error ID.
- Use HTTP status semantics correctly; 4xx for client errors, 5xx for server faults, never 200 with a payload error flag.
- Paginate every list endpoint; document the cursor or offset contract.
- Idempotency keys for unsafe operations so retries do not double-write.
- Versioning: URL path for breaking changes, headers for compatible evolution.
- Publish the contract: OpenAPI for REST, protobuf for gRPC; generate clients from it.
- Authn and authz at the gateway or middleware; never trust the client for authorization.
- Timeouts on every outbound call; fail fast with a bounded retry policy.

## Red flags

Error messages leaking internals; unvalidated request bodies; unlimited list queries; breaking changes without versioning; endpoints that block on third-party calls with no timeout.

## Skill Result Contract

```xml
<skill_result>
  <skill>api-implementation</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Contract spec, endpoint list, validation and error rules applied</evidence>
  <artifacts>OpenAPI/protobuf spec or endpoint implementation</artifacts>
  <risks>Undocumented breaking change, missing authz, or none</risks>
</skill_result>
```
