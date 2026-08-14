# Inspection KTS scripts

IntelliJ Inspection KTS scripts run by the adapter's post-turn IDE inspection
gate (`src/acp/ide-inspection.ts`) via the bridge `run_inspection_kts` tool.

## How the gate uses them

- After each turn, changed files (bounded) are analyzed with every
  `inspections/*.inspection.kts` script.
- Findings are folded into the regular IDE inspection report
  (`.pi/work/ide-inspections/<sessionId>/<ts>.json`) and counted in the
  `IDE inspection:` chat summary.
- Scripts that fail to compile surface as a diagnostic in the report and the
  summary gains a `custom inspections degraded` note; a broken script never
  fails the turn.
- The whole gate (including these scripts) is disabled by
  `PI_ACP_ENFORCE_IDE_INSPECT=0`.

## Writing a rule

- One `localInspection { psiFile, inspection -> ... }` per script; register
  each finding with `inspection.registerProblem(element, "message")`.
- Register the inspection at `HighlightDisplayLevel.WARNING`.
- Per-file rules only: `localInspection` sees one file per run. Project-wide
  rules need `globalInspection` and a full Qodana analysis (out of scope for
  the gate).
- The `id` in `InspectionKts(...)` is referenced from `qodana.yaml` when these
  scripts are later run by Qodana in CI.

## Testing a script

Use the IDE tool `ide_idea_run_inspection_kts` with `inspectionKtsCode` (the
script) and `contextPath` (a real file in the project); it returns
`compilationSuccess`, `inspectionResultMessage`, and `foundProblems`.

See the shipped examples via `ide_idea_generate_inspection_kts_examples` and
the API via `ide_idea_generate_inspection_kts_api`.
