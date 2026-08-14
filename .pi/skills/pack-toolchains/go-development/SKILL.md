---
name: go-development
description: "Use when writing or reviewing Go - error handling, contexts, interfaces, goroutines, modules, and testing conventions."
disable-model-invocation: true
---

# Go Development

## Use when

Writing or reviewing Go services, CLIs, or libraries.

## Do not use when

Frontend or scripting work; `shell-development` or frontend packs cover those.

## Key rules

- Handle errors explicitly; never discard them. Wrap with context: `fmt.Errorf("load config: %w", err)`.
- Context for cancellation and deadlines on every I/O call.
- Small interfaces defined by consumers, not implementors.
- Goroutines with `errgroup` or WaitGroup; every goroutine must have a cancellation path.
- Channels for coordination; avoid shared-memory concurrency.
- `go.mod` for modules; keep the standard library first, add deps deliberately.
- Table-driven tests; `go vet` and staticcheck in CI.
- Profile before optimizing; `go tool pprof` for CPU, heap, mutex.
- `slog` for structured logging; never log secrets.

## Red flags

Ignored errors; goroutine leaks; context dropped; interface bloat; global state; benchmarks without measurement.

## Skill Result Contract

```xml
<skill_result>
  <skill>go-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Error handling, context usage, tests, vet results</evidence>
  <artifacts>Module code, tests, lint config</artifacts>
  <risks>Goroutine leak, ignored error, or none</risks>
</skill_result>
```
