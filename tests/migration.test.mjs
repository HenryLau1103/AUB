import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { migrateBlueprint } from '../scripts/migrate-blueprint.mjs';

const SCHEMA_PATH = new URL('../schema/ui-blueprint.schema.json', import.meta.url);
const EXAMPLE_PATH = new URL('../examples/dashboard.ui.json', import.meta.url);

test('M1: v0.1 blueprint migrates to v0.3 without losing nodes', async () => {
  const original = JSON.parse(await readFile(EXAMPLE_PATH, 'utf8'));
  original.version = '0.1.0';
  delete original.design_system;
  for (const node of original.nodes) {
    if (node.layout) delete node.layout.mode;
  }
  const migrated = migrateBlueprint(original);

  assert.equal(migrated.version, '0.3.0');
  assert.equal(migrated.nodes.length, original.nodes.length);
  assert.equal(migrated.nodes[0].id, original.nodes[0].id);
  assert.ok(migrated.design_system?.colors?.['surface.canvas']);
  assert.equal(migrated.nodes.find((node) => node.layout)?.layout.mode, 'auto');
});

test('M2: migrated blueprint validates against the current schema', async () => {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const migrated = migrateBlueprint(JSON.parse(await readFile(EXAMPLE_PATH, 'utf8')));

  assert.equal(validate(migrated), true, JSON.stringify(validate.errors));
});

test('M3: v0.2 freeform placements migrate to v0.3 unchanged', () => {
  const input = {
    version: '0.2.0',
    screen: { id: 'freeform', name: 'Freeform', type: 'landing', platform: 'web', primary_user_goal: 'Compose freely.' },
    viewports: [{ id: 'desktop', width: 1440, height: 900 }],
    design_system: { name: 'Test' },
    nodes: [
      { id: 'root', type: 'page', name: 'Page', role: 'Root', parent_id: null, children: ['cta'], layout: { mode: 'freeform' } },
      { id: 'cta', type: 'button', name: 'CTA', role: 'Primary action', parent_id: 'root', children: [], placements: { desktop: { x: 80, y: 120, width: 160, height: 44, z_index: 2 } } }
    ],
    interactions: [],
    responsive: [],
    acceptance: Array.from({ length: 5 }, (_, index) => ({
      id: `acc_${index}`,
      type: index === 0 ? 'layout' : index === 1 ? 'interaction' : index === 2 ? 'responsive' : index === 3 ? 'a11y' : 'content',
      statement: `Acceptance ${index}`,
      target: '*',
      priority: 'must',
      verification_method: 'manual_visual'
    }))
  };

  assert.deepEqual(migrateBlueprint(input), { ...input, version: '0.3.0' });
});
