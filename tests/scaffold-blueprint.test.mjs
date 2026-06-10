import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  scaffoldBlueprint,
  scaffoldInteractions,
  scaffoldResponsive,
  scaffoldAcceptance,
  SCAFFOLD_SECTIONS,
} from '../scripts/scaffold-blueprint.lib.mjs';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';
import { buildCoreKnownTypes } from '../scripts/registry.lib.mjs';

const EXAMPLE = new URL('../examples/dashboard.ui.json', import.meta.url).pathname;
const SCHEMA = new URL('../schema/ui-blueprint.schema.json', import.meta.url).pathname;

async function loadStripped() {
  const bp = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  return { ...bp, interactions: [], responsive: [], acceptance: [] };
}

async function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(await readFile(SCHEMA, 'utf8')));
}

test('scaffoldBlueprint fills all three sections from a stripped blueprint', async () => {
  const stripped = await loadStripped();
  const { blueprint, summary } = scaffoldBlueprint(stripped);
  assert.ok(summary.interactions > 0, 'should derive interactions');
  assert.ok(summary.responsive > 0, 'should derive responsive rules');
  assert.ok(summary.acceptance >= 5, 'should derive at least 5 acceptance criteria');
  assert.equal(summary.total, summary.interactions + summary.responsive + summary.acceptance);
  assert.equal(blueprint.interactions.length, summary.interactions);
});

test('scaffolding is idempotent (a second pass adds nothing)', async () => {
  const stripped = await loadStripped();
  const once = scaffoldBlueprint(stripped).blueprint;
  const twice = scaffoldBlueprint(once);
  assert.deepEqual(twice.summary, { interactions: 0, responsive: 0, acceptance: 0, total: 0 });
  assert.deepEqual(twice.blueprint.interactions, once.interactions);
  assert.deepEqual(twice.blueprint.responsive, once.responsive);
  assert.deepEqual(twice.blueprint.acceptance, once.acceptance);
});

test('scaffolding is non-destructive: existing entries are preserved and not reordered', async () => {
  const stripped = await loadStripped();
  const existingInteraction = {
    id: 'keep_me',
    trigger: 'click',
    source_node_id: stripped.nodes[0].id,
    action: 'activate:keep',
    result_state: 'Kept.',
  };
  const seeded = { ...stripped, interactions: [existingInteraction] };
  const { blueprint } = scaffoldBlueprint(seeded, { sections: ['interactions'] });
  assert.deepEqual(blueprint.interactions[0], existingInteraction);
  // The node that already had an interaction is not wired a second time.
  const sourceCount = blueprint.interactions.filter((i) => i.source_node_id === existingInteraction.source_node_id).length;
  assert.equal(sourceCount, 1);
});

test('acceptance scaffolding covers the four required types and totals >= 5', async () => {
  const stripped = await loadStripped();
  const { acceptance } = scaffoldAcceptance(stripped);
  const types = new Set(acceptance.map((item) => item.type));
  for (const required of ['layout', 'interaction', 'responsive', 'a11y']) {
    assert.ok(types.has(required), `missing required acceptance type ${required}`);
  }
  assert.ok(acceptance.length >= 5);
  assert.equal(new Set(acceptance.map((item) => item.id)).size, acceptance.length, 'ids must be unique');
});

test('interaction scaffolding only wires actionable nodes and respects submit/change triggers', async () => {
  const blueprint = {
    nodes: [
      { id: 'root', type: 'page', parent_id: null, children: ['f', 'b', 'card'] },
      { id: 'f', type: 'form', parent_id: 'root', children: [] },
      { id: 'b', type: 'button', parent_id: 'root', children: [] },
      { id: 'card', type: 'card', parent_id: 'root', children: [] },
    ],
    interactions: [],
  };
  const { added } = scaffoldInteractions(blueprint);
  const byId = Object.fromEntries(added.map((i) => [i.source_node_id, i]));
  assert.equal(byId.f.trigger, 'submit');
  assert.equal(byId.b.trigger, 'click');
  assert.ok(!byId.card, 'non-actionable card must not be wired');
});

test('responsive scaffolding maps sidebar/grid/top_bar to semantic rules for sub-desktop viewports', async () => {
  const stripped = await loadStripped();
  const { added } = scaffoldResponsive(stripped);
  assert.ok(added.some((r) => r.target_node_id === 'sidebar' && r.rule === 'drawer'));
  assert.ok(added.every((r) => r.viewport === 'tablet' || r.viewport === 'mobile'));
});

test('section selection limits what is scaffolded', async () => {
  const stripped = await loadStripped();
  const { summary } = scaffoldBlueprint(stripped, { sections: ['acceptance'] });
  assert.equal(summary.interactions, 0);
  assert.equal(summary.responsive, 0);
  assert.ok(summary.acceptance >= 5);
});

test('scaffolded blueprint passes JSON Schema and semantic validation', async () => {
  const stripped = await loadStripped();
  const { blueprint } = scaffoldBlueprint(stripped);
  const validate = await makeValidator();
  const schemaOk = validate(blueprint);
  assert.ok(schemaOk, JSON.stringify(validate.errors));
  const knownTypes = await buildCoreKnownTypes();
  const semanticErrors = validateBlueprintSemantics(blueprint, { knownTypes });
  assert.deepEqual(semanticErrors, []);
});

test('SCAFFOLD_SECTIONS exposes the three known sections', () => {
  assert.deepEqual([...SCAFFOLD_SECTIONS].sort(), ['acceptance', 'interactions', 'responsive']);
});
