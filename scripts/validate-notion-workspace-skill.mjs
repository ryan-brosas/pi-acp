// Usage: node scripts/validate-notion-workspace-skill.mjs
// Fails (exit 1) when the notion-workspace skill or its registrations are
// missing or unsafe: no public name, no auth check, no search-before-fetch,
// no source-of-truth boundary, no surgical-edit rule, no duplicate
// prevention, no flexible hub sections, no router listing, no catalog
// membership.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const skillPath = join(root, ".pi", "skills", "pack-authoring", "notion-workspace", "SKILL.md");
const routerPath = join(root, ".pi", "skills", "pack-authoring", "SKILL.md");
const catalogPath = join(root, ".pi", "skills", "packs.json");

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`PASS ${message}`);
  else { failures++; console.log(`FAIL ${message}`); }
};

let skill = "";
try { skill = readFileSync(skillPath, "utf8"); } catch { /* Missing skill is reported by the checks below. */ }
const router = readFileSync(routerPath, "utf8");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const authoring = catalog.packs.find((pack) => pack.id === "pack-authoring");

check(skill.includes("name: notion-workspace"), "skill exists with the public notion-workspace name");
check(/notion-cli auth status/.test(skill) && /search/.test(skill) && /fetch/.test(skill), "skill verifies auth and discovers existing structure before writes");
check(/GitHub/.test(skill) && /ryan-workspace/.test(skill) && /source of truth/i.test(skill), "skill preserves source-of-truth boundaries");
check(/page edit/.test(skill) && /page update/.test(skill), "skill prefers surgical edits over full-page replacement");
check(/duplicate/i.test(skill) && /destructive/i.test(skill) && /credential/i.test(skill), "skill prevents duplicate systems and protects destructive actions and credentials");
check(/Projects/.test(skill) && /Tasks/.test(skill) && /Notes/.test(skill) && /Content/.test(skill) && /Learning/.test(skill), "skill supports a flexible second-brain hub");
check(/Second Brain/.test(skill) && /single central hub|only central dashboard/i.test(skill), "skill makes the existing top-level Second Brain the single central hub");
check(/Creator’s Companion/.test(skill) && /content system/i.test(skill) && /reuse/i.test(skill), "skill reuses Creator’s Companion as the content system");
check(!/Personal Brand/.test(skill), "skill does not name Personal Brand as a content system");
check(/never create a parallel|do not create.{0,40}(parallel|another hub)/i.test(skill), "skill prohibits creating a parallel central hub");
check(router.includes("notion-workspace:"), "authoring router lists notion-workspace");
check(authoring?.members.includes("notion-workspace"), "catalog assigns notion-workspace once");

console.log(failures ? "notion workspace skill: FAIL" : "notion workspace skill: all pass");
process.exit(failures ? 1 : 0);
