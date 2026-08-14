---
name: distributed-systems-patterns
description: 'Use when building distributed services - timeouts, retries, circuit breakers, idempotency, outbox, sagas, and consistency trade-offs.'
disable-model-invocation: true
---

# Distributed Systems Patterns

## Use when

Designing or reviewing multi-service systems where network calls and consistency matter.

## Do not use when

Single-process apps; `backend-architecture` covers those.

## Key rules

- Always set timeouts on outbound calls; a missing timeout is a latent outage.
- Retry only idempotent operations; add jitter to avoid thundering herds.
- Circuit breakers after repeated failures; open fast, test with a half-open probe.
- Idempotency keys on every write that can be retried.
- Transactional outbox for reliable event publishing; never write-then-publish.
- Sagas for multi-service transactions; each step has a compensating action.
- Prefer eventual consistency where the business tolerates it; state the trade-off.
- Degrade gracefully: fallbacks, caching, or clear failures instead of cascading timeouts.
- Load shedding at the edge; reject early rather than queueing unbounded work.

## Red flags

No timeouts; retries on non-idempotent writes; write-then-publish ordering; unbounded queues; cascading failures with no circuit breaker.

## Skill Result Contract

```xml
<skill_result>
  <skill>distributed-systems-patterns</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Timeout, retry, breaker, outbox, and saga decisions with rationale</evidence>
  <artifacts>Pattern decisions and integration notes</artifacts>
  <risks>Consistency gap, missing compensation, or none</risks>
</skill_result>
```
