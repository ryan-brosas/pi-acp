---
name: swift-concurrency
description: 'Use when developers mention Swift Concurrency, async/await, actors, or tasks; need migration to Swift 6; refactor closures to async/await; or hit concurrency lint warnings around Sendable, actor isolation, or MainActor.'
disable-model-invocation: true
---

# Swift Concurrency

## Iron Laws

<EXTREMELY-IMPORTANT>
- **No shared mutable state without isolation.** Actor, MainActor, or @MainActor. Not "it's safe, I checked."
- **`Sendable` is the contract.** Types that cross actor boundaries must be `Sendable`. Compiler errors are correct, not pedantic.
- **No blocking on the main actor.** `URLSession` async, not `URLSession.shared.dataTask` (sync wrapping). The user feels every block.
- **No `Task { }` in a `View.body`.** Use `.task { }` modifier — it's lifecycle-bound and cancellable.
- **No unstructured "fire and forget".** Prefer structured concurrency (`TaskGroup`, `.task`); if work must escape the task's lifetime, name the actor and the cancellation policy. The actor the work runs on matters.
</EXTREMELY-IMPORTANT>

## When to Use

Adopting `async`/`await`; refactoring closures; data race bugs; Swift 6 migration; `Sendable` errors; `MainActor` warnings; new async APIs; concurrency review.

## When NOT to Use

Trivial sync code; one-shot op; "rewrite in async" without reason; legacy targets without native async/await (iOS < 15, macOS < 12).

## Task Hierarchy

```
Task { ... }                  // unstructured
Task.detached { ... }          // detached, global executor
actor Foo { func() { ... } }   // actor's executor
@MainActor func() { ... }     // main actor
.task { await ... }            // structured, lifecycle-bound
TaskGroup { ... }              // structured, parallel
```

Pick the right one. `Task { }` in a class is rarely right.

## Actor Rules

| Pattern              | Use                                   |
| -------------------- | ------------------------------------- |
| `actor Foo { }`      | Shared state, mutated across contexts |
| `@MainActor Foo`     | UI class; everything on main          |
| `nonisolated func`   | Doesn't access actor state            |
| `isolated parameter` | Already on the actor                  |

Mark `final` and `Sendable` so the compiler can check.

## Sendable

```swift
struct User: Sendable {
  let id: UUID
  let name: String
}

class MutableState: @unchecked Sendable { /* AVOID */ }  // last resort
```

If not `Sendable`, you probably have a data race.

## Common Mistakes

`Task { }` in `View.body` (use `.task`); `Task { }` capturing self; long `await`s on the main actor keep UI work serialized (suspension does not block the thread, but the actor stays busy); closures outliving parent; `@unchecked Sendable` (lying to compiler); mixed `DispatchQueue` + async; ignoring `Sendable` warnings.

## Red Flags

`Task { }` in `View.body`; capturing self; sync `URLSession` in async; `@unchecked Sendable` to silence; mixed `DispatchQueue` + async; "I checked" (no race analysis); `Task.detached` everywhere; no cancellation handling; `await` on main for I/O.

## Common Patterns

```swift
// Network in a View
.task {
  do {
    self.user = try await api.fetchUser()
  } catch {
    self.error = error
  }
}

// Parallel
async let a = fetchA()
async let b = fetchB()
let result = try await (a, b)

// Cancellation-aware
.task(id: id) {
  // re-runs when id changes; previous is cancelled
}
```

## Anti-Patterns

**`Task { }` in `View.body`** (`.task`); **`Task { }` capturing self**; **sync I/O in async**; **`@unchecked Sendable` to silence**; **mixed `DispatchQueue` + async**; **"I checked"** (no analysis); **`Task.detached` everywhere**; **`try?` to silence**.
