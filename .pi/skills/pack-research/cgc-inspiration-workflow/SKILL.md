---
name: cgc-inspiration-workflow
description: "Use when finding, cloning, indexing, refreshing, comparing, or extracting capabilities from inspiration repositories through CodeGraphContext."
disable-model-invocation: true
---

# CGC Inspiration Workflow

Discover the covering repository, reuse or clone it under the resolved inspo
root, register and index its CGC context, query one repository at a time, then
make an evidence-backed adopt/adapt/omit decision.

**Inspo root:** resolve from `$INSPO_ROOT` or ask the user; never assume a
machine-specific path.

## Workflow

0. **Discover.** List contexts with `cgc context list` and repositories with
   `cgc list`. If the inspo-root context is missing, create it with
   `cgc context create "<inspo-root>"`, then index it with
   `cgc index "<inspo-root>" --summarize`. Discover the covering repository with
   `cgc find content "<domain>" --context "<inspo-root>"`; read the repository
   from the returned path prefix rather than guessing its name.
1. **Resolve.** Confirm the owner/repository URL and license before cloning.
2. **Reuse or clone.** Reuse `<inspo-root>/<repo>/.git` when present; otherwise
   clone the verified URL there. Never clone into an active project's `sources/`.
3. **Capture provenance.** Record URL, absolute path, commit SHA, branch, license,
   and retrieval date.
4. **Index.** Register the repository context if needed, then run
   `cgc index "<inspo-root>/<repo>" --summarize` and confirm with
   `cgc stats "<inspo-root>/<repo>"`. The indexed graph is the query surface;
   never grep an inspiration clone.
5. **Query one repository.** Use `cgc find name "<symbol>" --context
   "<inspo-root>/<repo>"`, `cgc find content "<pattern>" --context ...`, and
   `cgc analyze ...` for relationships. Treat each repository as a separate
   evidence source.
6. **Fallback.** Use the current DeepWiki index/page actions only for a bounded
   GitHub overview when the CGC context is unavailable; it is not a replacement
   for an indexed clone.
7. **Refresh.** After `git pull`, run `cgc update "<inspo-root>/<repo>"`; use
   `cgc index --force` only for a named stale or corrupt graph.
8. **Compare.** Map the active project with Pi Fovea and build a matrix of
   capability, reference evidence, local evidence, gap, and decision.
9. **Record.** For each capability choose `adopt`, `adapt`, or `omit`, with
   rationale, reference SHA, and license note.

## Stop Conditions

Stop when the reference answers the question, two independent sources agree, or
two named gaps produce no progress. Mark unknowns and ask instead of indexing
more repositories.

<skill_result>
  <skill>cgc-inspiration-workflow</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Per-repository CGC queries with provenance, matrix, and decisions</evidence>
  <artifacts>Provenance record and capability matrix</artifacts>
  <risks>Missing license, stale graph, unregistered context, or none</risks>
</skill_result>
