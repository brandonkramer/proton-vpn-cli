/**
 * @protontech/openpgp only exports `./lightweight` under the `browser` condition.
 * Bun (Node-like) resolution therefore fails when @protontech/crypto imports it.
 * Add import/default conditions pointing at the same lightweight build.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packagePath = join(
  import.meta.dirname,
  "..",
  "node_modules",
  "openpgp",
  "package.json",
);

try {
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
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    console.warn("patch-openpgp: openpgp not installed yet; skipping");
    process.exit(0);
  }
  throw error;
}
