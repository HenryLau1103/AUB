import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';
import { scoreAgentOutput } from '../scripts/score-agent-readability.mjs';

const FIXTURE = new URL('../examples/freeform-actions.ui.json', import.meta.url);
const SCHEMA = new URL('../schema/ui-blueprint.schema.json', import.meta.url);

test('A1: agent-readability fixture is schema and semantics valid', async () => {
  const blueprint = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const schema = JSON.parse(await readFile(SCHEMA, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(blueprint), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateBlueprintSemantics(blueprint), []);
});

test('A2: benchmark expected answer remains synchronized with the fixture', async () => {
  const blueprint = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const expected = JSON.parse(await readFile(new URL('../benchmarks/agent-readability/expected.json', import.meta.url), 'utf8'));
  const primary = blueprint.nodes.find((node) => node.id === 'primary_cta');
  const secondary = blueprint.nodes.find((node) => node.id === 'secondary_cta');
  const card = blueprint.nodes.find((node) => node.id === 'stats_card');
  const root = blueprint.nodes.find((node) => node.parent_id === null);
  assert.deepEqual(expected, {
    version: blueprint.version,
    root_id: root.id,
    root_layout_mode: root.layout.mode,
    node_count: blueprint.nodes.length,
    direct_root_children: root.children,
    primary_cta_desktop: primary.placements.desktop,
    primary_cta_mobile: primary.placements.mobile,
    secondary_cta_mobile_x: secondary.placements.mobile.x,
    stats_card_layout_mode: card.layout.mode,
    stats_card_direction: card.layout.direction,
    action_primary_token: blueprint.design_system.colors['action.primary'],
    primary_action: primary.content.action,
    interaction_count: blueprint.interactions.length,
    acceptance_count: blueprint.acceptance.length,
  });
});

test('A3: benchmark output schema accepts the authoritative answer', async () => {
  const expected = JSON.parse(await readFile(new URL('../benchmarks/agent-readability/expected.json', import.meta.url), 'utf8'));
  const outputSchema = JSON.parse(await readFile(new URL('../benchmarks/agent-readability/output.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(outputSchema);
  assert.equal(validate(expected), true, JSON.stringify(validate.errors));
});

test('A4: scorer gives 100 only to exact output and reports a changed fact', async () => {
  const expected = JSON.parse(await readFile(new URL('../benchmarks/agent-readability/expected.json', import.meta.url), 'utf8'));
  assert.equal(scoreAgentOutput(expected, expected).score, 100);

  const inaccurate = structuredClone(expected);
  inaccurate.primary_cta_desktop.x += 1;
  const report = scoreAgentOutput(inaccurate, expected);
  assert.ok(report.score < 100);
  assert.deepEqual(
    report.checks.find((check) => check.path === '$.primary_cta_desktop.x'),
    {
      path: '$.primary_cta_desktop.x',
      pass: false,
      expected: expected.primary_cta_desktop.x,
      actual: inaccurate.primary_cta_desktop.x,
    }
  );
});
