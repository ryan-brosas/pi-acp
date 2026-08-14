---
name: background-jobs
description: 'Use when adding background or scheduled work - queues, task retries, idempotency, poison messages, and job observability.'
disable-model-invocation: true
---

# Background Jobs

## Use when

Moving work off the request path, adding queues or schedulers, or designing reliable task execution.

## Do not use when

Work must complete before the response; keep it synchronous.

## Key rules

- Prefer a real queue (Celery, RQ, Sidekiq, SQS) over threads or `asyncio.create_task` for durable work.
- Assume at-least-once delivery: every task must be idempotent.
- Retries with exponential backoff and a max attempt count; retry only transient failures.
- Poison messages go to a dead-letter queue, not an endless retry loop.
- Deduplicate by a stable task key derived from the input, not a random ID.
- Set per-task timeouts; a stuck task should not block the worker.
- Schedule periodic work with beat or cron; keep schedules in version control.
- Monitor queue depth, age, and failure rates; alert on staleness, not just size.
- Keep tasks small; orchestrate long flows by composing tasks.

## Red flags

Non-idempotent tasks; unbounded retries; swallowing failures; jobs doing UI work; no visibility into queue age.

## Skill Result Contract

```xml
<skill_result>
  <skill>background-jobs</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Queue setup, idempotency keys, retry policy, monitoring</evidence>
  <artifacts>Task code, worker config, schedule definitions</artifacts>
  <risks>Duplicate execution, lost messages, or none</risks>
</skill_result>
```
