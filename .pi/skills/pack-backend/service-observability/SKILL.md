---
name: service-observability
description: "Use when adding observability to services - structured logs, metrics, distributed tracing, health checks, and correlation IDs."
disable-model-invocation: true
---

# Service Observability

## Use when

Adding logging, metrics, tracing, or health checks to a service, or debugging cross-service failures.

## Do not use when

Local one-off scripts; `debugging-and-error-recovery` covers those.

## Key rules

- Structured JSON logs with a correlation ID propagated across every call.
- Log at the boundary: request start, response, and errors; never log secrets or payload bodies.
- Metrics for the four signals: latency, traffic, errors, saturation.
- Distributed tracing via OpenTelemetry; propagate trace context in headers.
- Health endpoints: liveness (process up) separate from readiness (dependencies reachable).
- Request IDs generated at the edge and passed downstream; surface them in errors.
- Alert on SLOs and error budgets, not raw counts; page humans only for user impact.
- Keep dashboards tied to the SLOs; each alert must name its runbook.

## Red flags

Sensitive data in logs; no correlation IDs; health checks that crash the process; alerts without owners; dashboards nobody reads.

## Skill Result Contract

```xml
<skill_result>
  <skill>service-observability</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Log schema, metric list, trace setup, health endpoints, alerts</evidence>
  <artifacts>Instrumentation code, dashboards, alert rules</artifacts>
  <risks>Missing traces, noisy alerts, or none</risks>
</skill_result>
```
