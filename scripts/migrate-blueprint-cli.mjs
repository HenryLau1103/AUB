#!/usr/bin/env node
// Upgrade a Blueprint to the current schema version.
// Usage: node scripts/migrate-blueprint-cli.mjs <input.ui.json|yaml> <output.ui.json|yaml>

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { migrateBlueprint } from './migrate-blueprint.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/migrate-blueprint-cli.mjs <input.ui.json|yaml> <output.ui.json|yaml>');
  process.exit(2);
}

const inputExtension = extname(inputPath).toLowerCase();
const outputExtension = extname(outputPath).toLowerCase();
const raw = await readFile(resolve(inputPath), 'utf8');
const source = inputExtension === '.yaml' || inputExtension === '.yml'
  ? yaml.load(raw)
  : JSON.parse(raw);
const migrated = migrateBlueprint(source);
const output = outputExtension === '.yaml' || outputExtension === '.yml'
  ? yaml.dump(migrated, { noRefs: true, lineWidth: 120, sortKeys: false })
  : `${JSON.stringify(migrated, null, 2)}\n`;

await writeFile(resolve(outputPath), output, 'utf8');
console.error(`✓ migrated ${inputPath} → ${outputPath}`);
