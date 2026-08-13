import { spawnSync } from "node:child_process";

const checks = [
  [process.execPath, ["scripts/validate-skill-packs.mjs"]],
  [process.execPath, ["scripts/sync-skill-manifest.mjs", "--check"]],
  [process.execPath, ["scripts/probe-skill-routing.mjs"]],
  [process.execPath, ["scripts/validate-pi-fabric.mjs"]],
  [process.execPath, ["scripts/validate-work-management.mjs"]],
  [process.execPath, ["scripts/validate-notion-workspace-skill.mjs"]],
  [process.execPath, ["scripts/validate-release-hygiene.mjs"]],
  ["git", ["diff", "--check"]],
];

for (const [command, args] of checks) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nrepository check: ok");
