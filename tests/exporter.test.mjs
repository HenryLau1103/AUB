#!/usr/bin/env node
// Tests for the programmatic Markdown exporter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportMarkdown } from '../scripts/export-md.mjs';

const EXAMPLE_JSON = new URL('../examples/dashboard.ui.json', import.meta.url).pathname;

test('E1: exporter produces non-empty Markdown for a valid blueprint', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  assert.ok(md.length > 1000, 'exporter output must be substantive');
});

test('E2: exporter output contains all 8 required sections', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  const required = [
    '## 1. Screen Summary',
    '## 2. Component Hierarchy',
    '## 3. Layout Contract',
    '## 4. Interaction Rules',
    '## 5. Responsive Rules',
    '## 6. Non-Violable Conditions',
    '## 7. Acceptance Checklist',
    '## 8. Agent Task',
  ];
  for (const s of required) {
    assert.ok(md.includes(s), `output must include section: ${s}`);
  }
});

test('E3: exporter renders the component hierarchy as a tree', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  assert.ok(md.includes('app_shell  (app_shell)'), 'must include root node');
  assert.ok(md.includes('metric_revenue  (metric_card)'), 'must include nested child');
  // The tree block is wrapped in ```
  assert.match(md, /```\napp_shell/, 'tree must be in a code block');
});

test('E4: exporter lists every interaction as a table row', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  for (const i of blueprint.interactions) {
    assert.ok(md.includes(i.source_node_id), `interaction source ${i.source_node_id} must appear`);
    assert.ok(md.includes(i.action), `interaction action ${i.action} must appear`);
  }
});

test('E5: exporter includes every acceptance item as a checkbox', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  for (const a of blueprint.acceptance) {
    assert.ok(md.includes(`- [ ] **${a.id}**`), `acceptance item ${a.id} must appear as checkbox`);
  }
});

test('E6: exporter groups acceptance items by category', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  // The 4 required categories from the spec
  assert.match(md, /### Layout \(\d+\)/);
  assert.match(md, /### Interaction \(\d+\)/);
  assert.match(md, /### Responsive \(\d+\)/);
  assert.match(md, /### Accessibility \(\d+\)/);
});

test('E7: exporter non-violable conditions come from priority=blocker acceptance items', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const md = exportMarkdown(blueprint);
  const blockerCount = blueprint.acceptance.filter((a) => a.priority === 'blocker').length;
  // Find the non-violable conditions section
  const sectionStart = md.indexOf('## 6. Non-Violable Conditions');
  const sectionEnd = md.indexOf('## 7. Acceptance Checklist');
  const section = md.slice(sectionStart, sectionEnd);
  // Count numbered list items (1. 2. 3.)
  const numbered = section.match(/^\d+\.\s/gm) ?? [];
  assert.equal(numbered.length, blockerCount, `expected ${blockerCount} blockers, got ${numbered.length}`);
});

test('E8: exporter output is deterministic (same input → same output)', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const a = exportMarkdown(blueprint);
  const b = exportMarkdown(blueprint);
  assert.equal(a, b, 'exporter must be deterministic');
});

test('E9: exporter handles empty interactions and responsive arrays gracefully', () => {
  const blueprint = {
    version: '0.1.0',
    screen: {
      id: 'test',
      name: 'Test',
      type: 'landing',
      platform: 'web',
      primary_user_goal: 'test',
    },
    viewports: [{ id: 'desktop', width: 1440, height: 900 }],
    nodes: [
      { id: 'root', type: 'page', name: 'Root', role: 'root', parent_id: null, children: [] },
    ],
    interactions: [],
    responsive: [],
    acceptance: [
      { id: 'a1', type: 'a11y', statement: 'test', target: 'root', priority: 'must', verification_method: 'manual_visual' },
    ],
  };
  const md = exportMarkdown(blueprint);
  assert.ok(md.includes('_No interactions declared._'));
  assert.ok(md.includes('_No responsive rules declared._'));
  assert.ok(md.includes('a1'));
});

test('E10: exporter includes exact freeform geometry for every declared viewport', () => {
  const blueprint = {
    version: '0.2.0',
    screen: { id: 'geometry', name: 'Geometry', type: 'landing', platform: 'web', primary_user_goal: 'Test geometry.' },
    viewports: [
      { id: 'desktop', width: 1440, height: 900 },
      { id: 'mobile', width: 390, height: 844 },
    ],
    design_system: { name: 'Test', colors: { primary: '#123456' } },
    nodes: [
      { id: 'root', type: 'page', name: 'Root', role: 'Root', parent_id: null, children: ['cta'], layout: { mode: 'freeform' } },
      {
        id: 'cta',
        type: 'button',
        name: 'CTA',
        role: 'Action',
        parent_id: 'root',
        children: [],
        placements: {
          desktop: { x: 80, y: 120, width: 160, height: 44, z_index: 2 },
          mobile: { x: 24, y: 640, width: 342, height: 48, z_index: 3 },
        },
      },
    ],
    interactions: [],
    responsive: [],
    acceptance: [],
  };
  const md = exportMarkdown(blueprint);
  assert.match(md, /\| `cta` \| `desktop` \| 80 \| 120 \| 160 \| 44 \| 2 \|/);
  assert.match(md, /\| `cta` \| `mobile` \| 24 \| 640 \| 342 \| 48 \| 3 \|/);
  assert.ok(md.includes('`primary` | `#123456`'));
});
