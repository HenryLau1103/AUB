import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  exportAgentPrompt,
  supportedAgentAdapters,
  supportedAgentTasks,
} from '../scripts/export-agent-prompt.lib.mjs';

const EXAMPLE = new URL('../examples/freeform-actions.ui.json', import.meta.url);

test('P1: adapter interface exposes supported agents and tasks', () => {
  assert.deepEqual(supportedAgentAdapters(), ['generic', 'codex', 'claude-code', 'copilot']);
  assert.deepEqual(supportedAgentTasks(), ['author', 'implement', 'plan', 'review']);
});

test('P1b: Copilot adapter embeds Copilot-native repository instructions', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  const prompt = exportAgentPrompt(blueprint, { adapter: 'copilot', task: 'implement' });
  assert.ok(prompt.includes('Adapter: **GitHub Copilot**'));
  assert.ok(prompt.includes('.github/copilot-instructions.md'));
  for (const item of blueprint.acceptance) assert.ok(prompt.includes(item.id));
});

test('P4: author task tells agents to generate validated registered components', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  const prompt = exportAgentPrompt(blueprint, { adapter: 'codex', task: 'author' });
  assert.ok(prompt.includes('Author a UI Blueprint'));
  assert.ok(prompt.includes('Use only registered component types'));
  assert.ok(prompt.includes('do not invent missing behavior'));
  assert.ok(prompt.includes('every leaf must use `children: []`'));
  assert.ok(prompt.includes('Return one complete Blueprint JSON object and no prose'));
  assert.ok(!prompt.includes('Machine-readable implementation report'));
});

test('P2: Codex adapter preserves exact Blueprint context and acceptance ids', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  const prompt = exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' });
  assert.ok(prompt.includes('Read every applicable AGENTS.md'));
  assert.ok(prompt.includes("replying in the user's language"));
  assert.ok(prompt.includes('Explain what AUB is'));
  assert.ok(prompt.includes('primary_cta  (button)'));
  assert.ok(prompt.includes('| `primary_cta` | `desktop` | 80 | 220 | 160 | 44 | 2 |'));
  for (const item of blueprint.acceptance) assert.ok(prompt.includes(item.id));
});

test('P3: Claude Code adapter supports deterministic plan and review prompts', async () => {
  const blueprint = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  const planA = exportAgentPrompt(blueprint, { adapter: 'claude-code', task: 'plan' });
  const planB = exportAgentPrompt(blueprint, { adapter: 'claude-code', task: 'plan' });
  const review = exportAgentPrompt(blueprint, { adapter: 'claude-code', task: 'review' });
  assert.equal(planA, planB);
  assert.ok(planA.includes('Read CLAUDE.md'));
  assert.ok(planA.includes('without changing files'));
  assert.ok(review.includes('Report mismatches with file references'));
});
