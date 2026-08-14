// Routing contract probe: pins the two-leaf cross-pack selection rule and the
// trigger-first descriptions of the backend, toolchain, and frontend UX packs.
// Usage: node scripts/probe-skill-routing.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const skillsRoot = join(root, ".pi", "skills");
const catalog = JSON.parse(readFileSync(join(skillsRoot, "packs.json"), "utf8"));
const packOf = new Map();
for (const p of catalog.packs) for (const m of p.members || []) packOf.set(m, p.id);
const description = (name) => {
  const pack = packOf.get(name);
  const text = readFileSync(join(skillsRoot, pack, name, "SKILL.md"), "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const line = m ? m[1].split("\n").find((l) => l.startsWith("description:")) : undefined;
  return (line || "").slice("description:".length).trim().replace(/^["']|["']$/g, "");
};
const cases = [
  { task: "Flask API task", expect: ["python-development", "flask-development"], keywords: ["python", "flask"], max: 2 },
  { task: "Go service task", expect: ["go-development"], keywords: ["go"], max: 1 },
  { task: "Rust CLI task", expect: ["rust-development"], keywords: ["rust"], max: 1 },
  { task: "Java Spring service task", expect: ["java-development"], keywords: ["java"], max: 1 },
  { task: "shell script task", expect: ["shell-development"], keywords: ["shell"], max: 1 },
  { task: "Dockerfile task", expect: ["container-development"], keywords: ["container"], max: 1 },
  { task: "Django app task", expect: ["python-development", "django-development"], keywords: ["python", "django"], max: 2 },
  { task: "FastAPI endpoint task", expect: ["python-development", "fastapi-development"], keywords: ["python", "fastapi"], max: 2 },
  { task: "REST API design task", expect: ["api-implementation"], keywords: ["http"], max: 1 },
  { task: "queue worker task", expect: ["background-jobs"], keywords: ["background"], max: 1 },
  { task: "compare inspiration repository opencode-template for session summaries via CGC", expect: ["cgc-inspiration-workflow"], keywords: ["inspiration"], max: 1 },
  { task: "route library docs, GitHub overview, and web discovery for research", expect: ["evidence-router"], keywords: ["choosing"], max: 1 },
  { task: "current web discovery with cited sources", expect: ["codex-websearch"], keywords: ["current"], max: 1 },
  { task: "open-source library internals beyond docs", expect: ["opensrc"], keywords: ["internally"], max: 1 },
  { task: "find legitimate GitHub PR contribution opportunities and qualify the safest issue", expect: ["github-contribution-opportunities"], keywords: ["contribution"], max: 1 },
  { task: "execute ordered multi-task plan with acceptance review", expect: ["task-scoped-execution"], keywords: ["ordered"], max: 1 },
  { task: "UX review of an existing app for goal, flow, state, and copy evidence", expect: ["ux-review"], keywords: ["goal"], max: 1 },
  { task: "map an app's journeys and service seams before implementation", expect: ["app-experience-mapping"], keywords: ["journey"], max: 1 },
  { task: "review an app's full experience across journeys and seams before shipping", expect: ["app-experience-mapping", "black-box-experience-review"], keywords: ["journey", "seam"], max: 2 },
  { task: "write an Upwork application proposal for a virtual assistant role", expect: ["upwork-proposals"], keywords: ["proposal"], max: 1 },
];
let failures = 0;
for (const c of cases) {
  const problems = [];
  if (c.expect.length > c.max) problems.push(`expects ${c.expect.length} leaves, max ${c.max}`);
  const packs = c.expect.map((n) => packOf.get(n));
  const missing = c.expect.filter((n, i) => !packs[i]);
  if (missing.length) problems.push("missing from catalog: " + missing.join(", "));
  if (c.expect.length > 1 && new Set(packs).size !== c.expect.length) problems.push("leaves share a pack: " + c.expect.join(", "));
  for (const [i, name] of c.expect.entries()) {
    if (!packs[i]) continue;
    const d = description(name).toLowerCase();
    if (!d.startsWith("use when")) problems.push(name + " description is not trigger-first");
    if (!d.includes(c.keywords[i])) problems.push(name + " description lacks keyword " + c.keywords[i]);
  }
  if (problems.length) { failures++; console.log("FAIL " + c.task + ": " + problems.join("; ")); }
  else console.log("PASS " + c.task + " -> " + c.expect.join(" + ") + " (max " + c.max + ")");
}
for (const id of ["pack-backend", "pack-toolchains"]) {
  const text = readFileSync(join(skillsRoot, id, "SKILL.md"), "utf8");
  if (/no more than two leaves/i.test(text)) console.log("PASS " + id + " documents the two-leaf rule");
  else { failures++; console.log("FAIL " + id + " lacks the two-leaf rule"); }
}
// direct-execution invariant: task-scoped-execution must state the no-dispatch rule
const tse = readFileSync(join(skillsRoot, "pack-delivery", "task-scoped-execution", "SKILL.md"), "utf8");
if (/dispatch|delegate|subagent|agent/i.test(tse) && !/unsupported|never dispatch|no subagent/i.test(tse)) {
  failures++; console.log("FAIL task-scoped-execution lacks a no-dispatch rule");
} else console.log("PASS task-scoped-execution is direct-execution only");
console.log(failures ? "routing probes: FAIL" : "routing probes: all pass");
process.exit(failures ? 1 : 0);
