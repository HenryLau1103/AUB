import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { diffBlueprints, renderBlueprintDiff } from '../scripts/diff-blueprint.lib.mjs';

const EXAMPLE = new URL('../examples/freeform-actions.ui.json', import.meta.url);

test('R4: Blueprint diff identifies exactly the changed nodes and fields', async () => {
  const before = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  const after = structuredClone(before);
  after.nodes.find((node) => node.id === 'hero_heading').content.text = 'Build with confidence';
  after.nodes.find((node) => node.id === 'primary_cta').placements.desktop.x = 96;
  after.nodes.find((node) => node.id === 'stats_card').layout.gap.y = 20;

  const diff = diffBlueprints(before, after);
  assert.equal(diff.summary.nodes_changed, 3);
  assert.deepEqual(diff.nodes.changed.map((entry) => entry.key), ['hero_heading', 'primary_cta', 'stats_card']);
  assert.deepEqual(diff.nodes.changed[1].paths, ['placements.desktop.x']);

  const markdown = renderBlueprintDiff(diff);
  assert.ok(markdown.includes('Changed `hero_heading`: `content.text`'));
  assert.ok(markdown.includes('Changed `primary_cta`: `placements.desktop.x`'));
  assert.ok(markdown.includes('Changed `stats_card`: `layout.gap.y`'));
});

test('R4: Blueprint diff reports added and removed contract records', async () => {
  const before = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  const after = structuredClone(before);
  after.interactions.pop();
  after.acceptance.push({
    id: 'acc_new',
    type: 'content',
    statement: 'New content is visible.',
    target: 'hero_heading',
    priority: 'should',
    verification_method: 'manual_visual',
  });

  const diff = diffBlueprints(before, after);
  assert.equal(diff.interactions.removed.length, 1);
  assert.equal(diff.acceptance.added[0].key, 'acc_new');
});
