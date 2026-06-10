import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  REGISTRY_PATH,
  SCHEMA_PATH,
  TYPES_PATH,
  loadCoreRegistry,
  computeTypeLists,
  applyEnumsToSchema,
  serializeSchema,
  renderTypesSection,
  replaceTypesSection,
} from '../scripts/generate-registry-artifacts.lib.mjs';

test('codegen: committed schema enums equal registry-derived lists', async () => {
  const registry = await loadCoreRegistry();
  const lists = computeTypeLists(registry);
  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  assert.deepEqual(schema.$defs.coreComponentType.enum, lists.all);
  assert.deepEqual(schema.$defs.coreContainerComponentType.enum, lists.containers);
  assert.deepEqual(schema.$defs.coreLeafComponentType.enum, lists.leaves);
});

test('codegen: --check mode passes on committed tree (schema + types.ts are fresh)', async () => {
  const registry = await loadCoreRegistry();
  const lists = computeTypeLists(registry);

  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  const regeneratedSchema = serializeSchema(applyEnumsToSchema(schema, lists));
  const committedSchema = await readFile(SCHEMA_PATH, 'utf8');
  assert.equal(regeneratedSchema, committedSchema, 'schema is stale — run pnpm gen');

  const typesSource = await readFile(TYPES_PATH, 'utf8');
  const regeneratedTypes = replaceTypesSection(typesSource, renderTypesSection(registry));
  assert.equal(regeneratedTypes, typesSource, 'types.ts is stale — run pnpm gen');
});

test('codegen: a simulated registry edit changes the derived output', async () => {
  const registry = await loadCoreRegistry();
  const edited = structuredClone(registry);
  edited.categories[0].types.push({ name: 'zz_probe', displayName: 'Probe', isContainer: false });

  const before = computeTypeLists(registry);
  const after = computeTypeLists(edited);
  assert.ok(!before.all.includes('zz_probe'));
  assert.ok(after.all.includes('zz_probe'));
  assert.ok(after.leaves.includes('zz_probe'));

  const block = renderTypesSection(edited);
  assert.match(block, /'zz_probe'/);
});

test('codegen: registry path is the single source of truth', async () => {
  const registry = await loadCoreRegistry();
  const lists = computeTypeLists(registry);
  assert.equal(lists.all.length, lists.containers.length + lists.leaves.length);
  assert.ok(REGISTRY_PATH.endsWith('schema/registry/components.json'));
});
