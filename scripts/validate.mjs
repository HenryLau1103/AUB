#!/usr/bin/env node
// Validates a UI Blueprint file against the JSON Schema.
// Usage: node scripts/validate.mjs <file.ui.json|file.ui.yaml>

import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { validateBlueprintSemantics } from './validate-blueprint.lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: pnpm validate <file.ui.json|file.ui.yaml>');
    process.exit(2);
  }
  const filePath = resolve(arg);
  const ext = extname(filePath).toLowerCase();

  const schemaPath = join(ROOT, 'schema', 'ui-blueprint.schema.json');
  const schemaRaw = await readFile(schemaPath, 'utf8');
  const schema = JSON.parse(schemaRaw);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const fileRaw = await readFile(filePath, 'utf8');
  let document;
  if (ext === '.yaml' || ext === '.yml') {
    document = yaml.load(fileRaw);
  } else {
    document = JSON.parse(fileRaw);
  }

  const ok = validate(document);
  const semanticErrors = ok ? validateBlueprintSemantics(document) : [];
  if (ok && semanticErrors.length === 0) {
    console.log(`✓ valid: ${arg}`);
    process.exit(0);
  }

  console.error(`✗ invalid: ${arg}`);
  for (const err of validate.errors ?? []) {
    const path = err.instancePath || '(root)';
    console.error(`  ${path} ${err.message}`);
    if (err.params) console.error(`    params: ${JSON.stringify(err.params)}`);
  }
  for (const error of semanticErrors) {
    console.error(`  semantic: ${error}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
