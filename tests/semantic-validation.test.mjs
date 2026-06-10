import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';

function baseBlueprint() {
  return {
    version: '0.2.0',
    screen: { id: 'test', name: 'Test', type: 'landing', platform: 'web', primary_user_goal: 'Test validation.' },
    viewports: [{ id: 'desktop', width: 1440, height: 900 }],
    nodes: [
      { id: 'root', type: 'page', name: 'Root', role: 'Root', parent_id: null, children: ['child'], layout: { mode: 'freeform' } },
      { id: 'child', type: 'button', name: 'Child', role: 'Action', parent_id: 'root', children: [], placements: { desktop: { x: 0, y: 0, width: 100, height: 40 } } }
    ],
    interactions: [],
    responsive: [],
    acceptance: []
  };
}

test('V1: valid tree and freeform placements produce no semantic errors', () => {
  assert.deepEqual(validateBlueprintSemantics(baseBlueprint()), []);
});

test('V2: missing parent and child references are reported', () => {
  const blueprint = baseBlueprint();
  blueprint.nodes[1].parent_id = 'missing';
  const errors = validateBlueprintSemantics(blueprint);
  assert.ok(errors.some((error) => error.includes('parent_id references missing')));
  assert.ok(errors.some((error) => error.includes('has parent_id missing')));
});

test('V3: freeform children require viewport geometry', () => {
  const blueprint = baseBlueprint();
  blueprint.nodes[1].placements = {};
  assert.ok(validateBlueprintSemantics(blueprint).some((error) => error.includes('missing placement')));
});

test('V4: menu item ids are valid interaction sources', () => {
  const blueprint = baseBlueprint();
  blueprint.nodes[1].type = 'menu';
  blueprint.nodes[1].content = {
    items: [{ id: 'menu_profile', label: 'Profile', action: 'navigate:/profile' }],
  };
  blueprint.interactions = [{
    id: 'open_profile',
    trigger: 'click',
    source_node_id: 'menu_profile',
    action: 'navigate:/profile',
    result_state: 'Profile route is visible.',
  }];
  assert.deepEqual(validateBlueprintSemantics(blueprint), []);
});

test('V5: freeform geometry must be explicitly declared for every viewport', () => {
  const blueprint = baseBlueprint();
  blueprint.viewports.push({ id: 'mobile', width: 390, height: 844 });
  assert.ok(validateBlueprintSemantics(blueprint).some((error) => error.includes('missing placement for mobile')));
});

test('V6: parent and children declarations must be bidirectionally consistent', () => {
  const blueprint = baseBlueprint();
  blueprint.nodes[0].children = [];
  const errors = validateBlueprintSemantics(blueprint);
  assert.ok(errors.some((error) => error.includes('does not declare it in children')));
  assert.ok(errors.some((error) => error.includes('not reachable from root')));
});

test('V7: freeform geometry rejects negative coordinates and horizontal overflow', () => {
  const negative = baseBlueprint();
  negative.nodes[1].placements.desktop.x = -1;
  assert.ok(validateBlueprintSemantics(negative).some((error) => error.includes('negative coordinates')));

  const overflow = baseBlueprint();
  overflow.nodes[1].placements.desktop = { x: 1400, y: 0, width: 100, height: 40 };
  assert.ok(validateBlueprintSemantics(overflow).some((error) => error.includes('overflows viewport width')));
});
