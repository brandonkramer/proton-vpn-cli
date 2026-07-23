/**
 * @protontech/openpgp only exports `./lightweight` under the `browser` condition.
 * Bun (Node-like) resolution therefore fails when @protontech/crypto imports it.
 * Add import/default conditions pointing at the same lightweight build.
 *
 * Looks in package-local and hoisted node_modules (global bun/npm installs).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function findOpenpgpPackageJson(): string | null {
  let dir = join(import.meta.dirname, "..");
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "node_modules", "openpgp", "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const packagePath = findOpenpgpPackageJson();
if (!packagePath) {
  console.warn("patch-openpgp: openpgp not installed yet; skipping");
  process.exit(0);
}

const raw = readFileSync(packagePath, "utf8");
const pkg = JSON.parse(raw) as {
  exports?: Record<string, Record<string, string> | string>;
};
const lightweight = pkg.exports?.["./lightweight"];
if (!lightweight || typeof lightweight === "string") {
  console.warn("patch-openpgp: unexpected openpgp exports; skipping");
  process.exit(0);
}

const target =
  lightweight.browser ?? "./dist/lightweight/openpgp.min.mjs";
let changed = false;
for (const key of ["import", "require", "default"] as const) {
  if (!lightweight[key]) {
    lightweight[key] = target;
    changed = true;
  }
}

if (changed) {
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("patch-openpgp: added Node resolution for openpgp/lightweight");
}
