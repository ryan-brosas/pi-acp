# Go Development Guide

Source: adapted from claude-mpm `src/claude_mpm/skills/bundled/toolchains/golang/core/SKILL.md` (local CGC reference).

## Errors

- Handle explicitly; wrap with context: `fmt.Errorf("load config: %w", err)`.
- `errors.Is`/`As` for sentinel and typed errors; never ignore returns.

## Context and concurrency

- Pass `context.Context` first; set deadlines on every external call.
- Goroutines via `errgroup`; every goroutine gets a cancellation path.
- Channels for coordination; close once; prefer `for range` over manual receive loops.

## Modern Go

- 1.22: `for i := range 10`; loop variables are per-iteration; enhanced `ServeMux` with `"GET /items/{id}"` and `r.PathValue("id")`.
- 1.23: `slices.All`, `maps.Keys`, `iter.Seq` range functions; `unique` for interning.
- 1.24: `tool` directive in go.mod; `os.OpenRoot` for directory jails; `testing.B.Loop()`.
- `slog` for structured logging; redact PII with `LogValuer`.

## Generics

- `any` for store/pass only; `comparable` for keys; `constraints.Ordered` for comparisons.
- Prefer function params over method constraints; start concrete, genericize on duplication.

## Performance

- Profile first: `go tool pprof` CPU, heap, mutex, goroutine.
- `inuse_space` for leaks; `go build -gcflags="-m"` for escape analysis.
- Field order largest-to-smallest; run `fieldalignment`.

## Testing

- Table-driven tests; `go vet` and staticcheck in CI.
