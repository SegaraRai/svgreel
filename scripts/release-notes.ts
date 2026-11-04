// Prints the release tag and writes the changelog section of the current svgreel version:
//
//   node scripts/release-notes.ts <body file>
//
// The section comes from packages/core/CHANGELOG.md, which `pnpm version -r` updates from the
// change intents. The Release workflow uses it as the body of the draft GitHub Release.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bodyFile = process.argv[2];
if (!bodyFile) {
  console.error("Usage: node scripts/release-notes.ts <body file>");
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, "packages/core/package.json"), "utf8")) as {
  version: string;
};
const changelogPath = path.join(root, "packages/core/CHANGELOG.md");
const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex((line) => line.trim() === `## ${version}`);
let section = "";
if (start !== -1) {
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  section = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}
const npm = `https://www.npmjs.com/package/svgreel/v/${version}`;
fs.writeFileSync(bodyFile, `${section || "_No changelog entry._"}\n\n[svgreel@${version} on npm](${npm})\n`);
console.log(`v${version}`);
