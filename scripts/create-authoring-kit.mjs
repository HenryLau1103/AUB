#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { migrateBlueprint } from './migrate-blueprint.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(process.argv[2] || 'aub-authoring-kit.zip');
const schema = JSON.parse(await readFile(resolve(root, 'schema/ui-blueprint.schema.json'), 'utf8'));
const registry = JSON.parse(await readFile(resolve(root, 'schema/registry/components.json'), 'utf8'));
const example = migrateBlueprint(JSON.parse(await readFile(resolve(root, 'examples/dashboard.ui.json'), 'utf8')));
const files = {
  'AUTHORING.md': authoringGuide(),
  'ui-blueprint.schema.json': `${JSON.stringify(schema, null, 2)}\n`,
  'components.json': `${JSON.stringify(registry, null, 2)}\n`,
  'examples/canonical.ui.json': `${JSON.stringify(example, null, 2)}\n`,
  'prompts/author.md': authorPrompt(),
  'VALIDATE.md': validationGuide(),
};
const zip = new JSZip();
const manifestFiles = {};
for (const [path, content] of Object.entries(files)) {
  const bytes = Buffer.from(content);
  manifestFiles[path] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength };
  zip.file(path, content);
}
zip.file('manifest.json', `${JSON.stringify({
  format: 'aub-authoring-kit',
  format_version: '1.0.0',
  blueprint_version: schema.properties.version.enum.at(-1),
  files: manifestFiles,
}, null, 2)}\n`);
await writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.error(`✓ wrote ${outputPath}`);

export function authoringGuide() {
  return `# AUB Blueprint Authoring

Produce a single JSON document that validates against \`ui-blueprint.schema.json\`.

## Rules

1. Use only component types declared in \`components.json\`.
2. Create exactly one root node with \`parent_id: null\`.
3. Keep every \`parent_id\` and \`children\` relationship bidirectionally consistent.
4. Read \`isContainer\` from \`components.json\`. Types with \`isContainer: false\` are leaves and MUST use \`children: []\`; represent labels and icons through \`content\`, not child nodes.
5. Use \`layout.mode: auto\` for flex/grid flow and \`freeform\` only when exact placements are known.
6. Size units are limited to \`px\`, \`%\`, \`rem\`, and \`vw\`. Never use \`fr\` in a size object; use \`grid_columns\` for fractional tracks.
7. Declare interactions, responsive behavior, and at least five acceptance criteria.
8. Include layout, interaction, responsive, and accessibility acceptance categories.
9. Never invent uncertain product behavior. Put unresolved decisions in \`screen.notes\`.
10. Before returning, verify leaf children, allowed units, unique ids, references, and acceptance coverage.
11. Return JSON only when the caller requests a machine-readable Blueprint.
`;
}

export function authorPrompt() {
  return `Create an AUB UI Blueprint from the supplied UI requirements.

Read AUTHORING.md, components.json, the JSON Schema, and the canonical example first.
Return a complete JSON object. Do not use unregistered component types.
Do not omit parent/children links, responsive rules, interactions, or acceptance criteria.
Use children only on registry types where isContainer is true. Every leaf must have children: [].
Use only px, %, rem, or vw size units; express fractional grids with grid_columns.
When source material is ambiguous, preserve the ambiguity in screen.notes instead of guessing.
Perform a final schema checklist before returning, then validate with the documented command.
`;
}

export function validationGuide() {
  return `# Validation

From the AUB repository:

\`\`\`bash
pnpm validate path/to/screen.ui.json
\`\`\`

The command must exit with status 0. Fix schema and semantic errors before handoff.
`;
}
