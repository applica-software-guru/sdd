#!/usr/bin/env node
// Reads .md files from packages/skill/ and generates templates.generated.ts
// so that packages/skill/ remains the single source of truth.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, "../../skill");
const outFile = resolve(__dirname, "../src/scaffold/templates.generated.ts");

const SKILL_MAP = [
  { file: "sdd/SKILL.md", exportName: "SKILL_MD_TEMPLATE" },
  { file: "sdd-ui/SKILL.md", exportName: "SKILL_UI_MD_TEMPLATE" },
  { file: "sdd-remote/SKILL.md", exportName: "SKILL_REMOTE_MD_TEMPLATE" },
  { file: "sdd/references/file-format.md", exportName: "FILE_FORMAT_REFERENCE" },
  { file: "sdd/references/change-requests.md", exportName: "CHANGE_REQUESTS_REFERENCE" },
  { file: "sdd/references/bugs.md", exportName: "BUGS_REFERENCE" },
];

function escapeForTemplateLiteral(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const exports = SKILL_MAP.map(({ file, exportName }) => {
  const content = readFileSync(resolve(skillDir, file), "utf-8");
  const escaped = escapeForTemplateLiteral(content);
  return `export const ${exportName} = \`${escaped}\`;\n`;
});

const output = `// @generated — DO NOT EDIT. Source of truth: packages/skill/
// Regenerate with: node packages/core/scripts/generate-templates.mjs

${exports.join("\n")}`;

writeFileSync(outFile, output, "utf-8");
console.log(`Generated ${outFile}`);
