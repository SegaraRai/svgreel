// Writes template/ as the template repository's contents: node scripts/sync-template.ts <dir>
//
// <dir> is a checkout of the template repository. Everything in it except .git is replaced.
// template.pnpm-workspace.yaml becomes pnpm-workspace.yaml (in this repo it would make template/
// a separate workspace root), and the `workspace:*` dependency on svgreel becomes the version in
// packages/core/package.json. The caller regenerates the lockfile.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "template");
const SKIP = new Set(["node_modules", "dist", "pnpm-lock.yaml"]);

const dest = process.argv[2];
if (!dest) {
  console.error("Usage: node scripts/sync-template.ts <template repository checkout>");
  process.exit(1);
}
if (!fs.existsSync(path.join(dest, ".git"))) {
  console.error(`${dest} is not a git checkout`);
  process.exit(1);
}

for (const entry of fs.readdirSync(dest)) {
  if (entry !== ".git") {
    fs.rmSync(path.join(dest, entry), { recursive: true, force: true });
  }
}
for (const entry of fs.readdirSync(source)) {
  if (!SKIP.has(entry)) {
    fs.cpSync(path.join(source, entry), path.join(dest, entry), { recursive: true });
  }
}
fs.renameSync(path.join(dest, "template.pnpm-workspace.yaml"), path.join(dest, "pnpm-workspace.yaml"));

const { version } = JSON.parse(fs.readFileSync(path.join(root, "packages/core/package.json"), "utf8")) as {
  version: string;
};
const pkgPath = path.join(dest, "package.json");
const pkg = fs.readFileSync(pkgPath, "utf8");
const replaced = pkg.replaceAll('"svgreel": "workspace:*"', `"svgreel": "^${version}"`);
if (replaced === pkg || replaced.includes("workspace:")) {
  console.error('template/package.json must depend on "svgreel": "workspace:*" and nothing else from the workspace');
  process.exit(1);
}
fs.writeFileSync(pkgPath, replaced);
console.log(`Synced template/ to ${dest} with svgreel ^${version}`);
