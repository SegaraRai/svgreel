// Writes template/ as the template repository's contents: node scripts/sync-template.ts <dir>
//
// <dir> is a checkout of the template repository. Everything in it except .git is replaced.
// template.pnpm-workspace.yaml becomes pnpm-workspace.yaml (in this repo it would make template/
// a separate workspace root), the `workspace:*` dependency on svgreel becomes the version in
// packages/core/package.json, and `catalog:` ranges (which `vp migrate` writes) become the
// catalog's versions. The caller regenerates the lockfile.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

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
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const deps = (manifest: Record<string, unknown>) =>
  DEP_FIELDS.flatMap((field) =>
    Object.entries((manifest[field] ?? {}) as Record<string, string>).map(([name, range]) => ({ field, name, range })),
  );

if ((pkg.dependencies as Record<string, string> | undefined)?.svgreel !== "workspace:*") {
  console.error('template/package.json must depend on "svgreel": "workspace:*"');
  process.exit(1);
}
(pkg.dependencies as Record<string, string>).svgreel = `^${version}`;

if (deps(pkg).some((d) => d.range.startsWith("catalog:"))) {
  const packed = packedManifest(source);
  for (const { field, name, range } of deps(pkg)) {
    if (range.startsWith("catalog:")) {
      (pkg[field] as Record<string, string>)[name] =
        (packed[field] as Record<string, string> | undefined)?.[name] ?? "";
    }
  }
}
const unresolved = deps(pkg).filter((d) => !d.range || /^(workspace|catalog):/.test(d.range));
if (unresolved.length) {
  console.error(
    `Unresolved ranges in template/package.json: ${unresolved.map((d) => `${d.name}@${d.range}`).join(", ")}`,
  );
  process.exit(1);
}
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Synced template/ to ${dest} with svgreel ^${version}`);

/**
 * The package.json that `vp pm pack` (pnpm pack) writes for `dir`, where pnpm has replaced
 * `catalog:` and `workspace:` ranges with versions. Only its dependency fields are used: the packed
 * manifest also drops fields such as `packageManager` and reorders the rest.
 */
function packedManifest(dir: string): Record<string, unknown> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svgreel-template-"));
  try {
    // Through the shell, which finds vp's launcher on Windows too.
    execSync(`vp pm pack --pack-destination ${JSON.stringify(tmp)}`, {
      cwd: dir,
      stdio: ["ignore", "ignore", "inherit"],
    });
    const [tarball] = fs.readdirSync(tmp).filter((f) => f.endsWith(".tgz"));
    if (!tarball) {
      throw new Error("vp pm pack wrote no tarball");
    }
    const tar = zlib.gunzipSync(fs.readFileSync(path.join(tmp, tarball)));
    // A tar archive is a sequence of 512-byte headers, each followed by its file padded to 512 bytes.
    for (let offset = 0; offset + 512 <= tar.length;) {
      const name = field(tar, offset, 100);
      if (!name) {
        break;
      }
      const size = parseInt(field(tar, offset + 124, 12).trim() || "0", 8);
      if (name === "package/package.json") {
        return JSON.parse(tar.toString("utf8", offset + 512, offset + 512 + size)) as Record<string, unknown>;
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    throw new Error(`${tarball} has no package/package.json`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** A NUL-terminated field of a tar header. */
function field(tar: Buffer, start: number, length: number): string {
  const end = tar.indexOf(0, start);
  return tar.toString("utf8", start, end === -1 || end > start + length ? start + length : end);
}
