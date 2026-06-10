#!/usr/bin/env node
// Regenerate the schema core-type enums and the types.ts component-type block
// from schema/registry/components.json (the single source of truth).
//
// Usage:
//   node scripts/generate-registry-artifacts.mjs           # write artifacts
//   node scripts/generate-registry-artifacts.mjs --check   # fail if stale

import { readFile, writeFile } from 'node:fs/promises';
import {
  SCHEMA_PATH,
  TYPES_PATH,
  loadCoreRegistry,
  computeTypeLists,
  renderTypesSection,
  replaceTypesSection,
  applyEnumsToSchema,
  serializeSchema,
} from './generate-registry-artifacts.lib.mjs';

async function build() {
  const registry = await loadCoreRegistry();
  const lists = computeTypeLists(registry);

  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  const nextSchema = serializeSchema(applyEnumsToSchema(schema, lists));

  const typesSource = await readFile(TYPES_PATH, 'utf8');
  const nextTypes = replaceTypesSection(typesSource, renderTypesSection(registry));

  return { nextSchema, nextTypes };
}

async function main() {
  const check = process.argv.includes('--check');
  const { nextSchema, nextTypes } = await build();

  if (check) {
    const [currentSchema, currentTypes] = await Promise.all([
      readFile(SCHEMA_PATH, 'utf8'),
      readFile(TYPES_PATH, 'utf8'),
    ]);
    const stale = [];
    if (currentSchema !== nextSchema) stale.push('schema/ui-blueprint.schema.json');
    if (currentTypes !== nextTypes) stale.push('schema/types.ts');
    if (stale.length > 0) {
      console.error('✗ generated artifacts are stale. Run `pnpm gen`. Out of date:');
      for (const f of stale) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log('✓ generated artifacts are up to date');
    return;
  }

  await Promise.all([
    writeFile(SCHEMA_PATH, nextSchema, 'utf8'),
    writeFile(TYPES_PATH, nextTypes, 'utf8'),
  ]);
  console.log('✓ wrote schema enums and types.ts component types from registry');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(2);
});
