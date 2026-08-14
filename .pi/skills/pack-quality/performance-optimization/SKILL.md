---
name: performance-optimization
description: Use when profiling, optimizing, or adding performance budgets to applications — covers measure-first workflow, Core Web Vitals, common anti-patterns, and performance regression prevention
disable-model-invocation: true
---


# Performance Optimization

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Measure first.** Intuition is wrong more often than not.
- **One change at a time.** 5% + 10% ≠ 15% if you didn't isolate.
- **The slowest thing is usually not where you think.** Profile.
- **Algorithmic > micro-opt.** O(n²) → O(n log n) beats any cache line.
- **Don't break correctness for speed.** Fast bug is still a bug.
</EXTREMELY-IMPORTANT>

## When to Use

Real-world slowness; Core Web Vitals failing; high p99; user "feels slow"; capacity planning; before a perf task without a number.

## When NOT to Use

Premature optimization; "I think this is slow"; "make it faster" without target; rewriting to dodge profiling.

## Workflow

1. **Define the target.** p99 < 200ms. LCP < 2.5s. Number, not "feels faster."
2. **Measure baseline.** Profile, capture traces. Record the number.
3. **Identify the bottleneck.** The slow part is usually obvious once you see it.
4. **Hypothesize.** "X is slow because Y." Testable.
5. **One change.** Smallest change targeting the bottleneck.
6. **Re-measure.** Compare to baseline. Keep or revert.
7. **Repeat.** Until target met.

## Core Web Vitals

| Metric | Target | What |
|---|---|---|
| LCP | < 2.5s | Main content renders |
| INP | < 200ms | Interaction response |
| CLS | < 0.1 | Visual stability |
| TTFB | < 800ms | Server response |
| FCP | < 1.8s | First render |

LCP + INP + CLS are the "Core" (Google ranks on these).

## Common Bottlenecks (Web)

JS bundle size (1MB = 1s+ parse+exec → code-split, tree-shake); render-blocking resources (inline critical, defer the rest); images (80% of weight → WebP/AVIF, responsive, lazy); network waterfalls (parallelize); re-renders (memo where it matters); layout thrashing (batch).

## Common Bottlenecks (Backend)

N+1 queries (use joins or batch); sync I/O in async path; no caching; pool too small; logger in hot path.

## Profiling Tools

| Domain | Tool |
|---|---|
| Web | DevTools Performance, Lighthouse, WebPageTest |
| React | React DevTools Profiler, why-did-you-render |
| Node | `node --prof`, clinic.js, 0x |
| DB | `EXPLAIN ANALYZE`, pg_stat_statements |
| General | flame graphs, OpenTelemetry |

## Anti-Patterns

Premature optimization (no measurement); micro-optimization (0.1% gain); wrong layer (3 days on CSS, real issue is 3MB JS); cache everything (cache has cost); speculative complexity ("1M users?"); perf without correctness; big-bang rewrite ("we'll rewrite in Rust" rarely ships).

## Common Mistakes

No measurement; "I think this is slow" (no); no baseline; multiple changes at once; cache invalidation bugs; rewriting to dodge profiling; ignoring algorithmic; breaking correctness; no regression test.

## Red Flags

"I think X is slow" (measure first); no baseline; change without re-measuring; perf that breaks tests; micro-opt while N² is there; "rewrite in Rust"; perf claim without number; "I added caching" without key + invalidation; no regression test.

## Self-Quiz

Did I define a number? Measure baseline? Make ONE change then re-measure? Target the trace's bottleneck? Preserve correctness? Regression test?
