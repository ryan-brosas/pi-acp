---
name: root-cause-tracing
description: "Use when errors occur deep in execution and you need to trace back to the original trigger - trace bugs backward through the call stack, adding instrumentation when needed."
disable-model-invocation: true
---


# Root-Cause Tracing

Companion to `debugging-and-error-recovery`. Use when the symptom is **deep** — a failure surfaces 10+ layers away from its cause. Linear debugging handles shallow failures; this is the loop-back version.

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Trace backward, not forward.** Start at the symptom. What input reached this function? What path produced it? What called it? What changed?
- **Log at the boundary, not the middle.** Add probes between suspect layers, not inside them.
- **One hypothesis per probe.** If you can't distinguish X from not-X, you're not probing — you're guessing.
- **Don't fix the symptom layer.** Fix the upstream cause. If the bad state reached the symptom, removing the symptom doesn't help.
</EXTREMELY-IMPORTANT>

## When to Use

Failure surfaces 10+ layers from the cause; the linear `debugging-and-error-recovery` workflow didn't find it; the error message is misleading or generic; the same fix keeps coming back; the failure appears only in production-like environments.

## When NOT to Use

The cause is already known (use `debugging-and-error-recovery` or `incremental-implementation`); the failure is at the entry point (no tracing needed); you have a stack trace pointing to the line (just read the code).

## The Backward Trace

```
[Symptom layer: where the failure surfaces]
  ↑ "what input did this function receive?"
  ↑ "what called this function?"
  ↑ "what data did THAT receive?"
  ↑ "where did THAT data come from?"
  ↑ [Root layer: where invalid state originated]
```

Each `↑` is a step. At each step: log the input, log the output, confirm the boundary.

## Instrumentation Strategy

```ts
// BAD: log in the middle
function processUser(user) {
  console.log("processing user", user) // noise
  // ...
}

// GOOD: log at the boundary
function processUser(user: User): Result {
  logger.debug("processUser.input", { userId: user.id, ...user })
  // ...
  logger.debug("processUser.output", { result })
  return result
}
```

Log the boundary, not the body. Body logging creates noise; boundary logging creates a chain of evidence.

## When You Find the Root

- **Write a regression test** that would have caught the original symptom.
- **Fix the upstream invariant** (a type, a guard, a parse) — not the symptom.
- **Verify** the fix by re-running the trace from symptom to root. No new issues.

## Common Mistakes

Tracing forward; adding 10 log lines at once; logging without a hypothesis; fixing the symptom layer; "the stack trace points to X" without verifying X is the cause; tracing 30 minutes without writing the chain; no regression test after.

## Red Flags

Hypothesis-free logging; log lines without structure (strings, not objects); tracing forward; "the bug is in X" without evidence; same fix looped; regression test skipped; trace stops at first plausible cause (might be a layer, not the root).

## Anti-Patterns

**Trace forward**; **log without hypothesis**; **fix the symptom layer**; **"I think X"** without distinguishing; **no regression test**; **log strings, not objects**; **infinite trace without cap**.
