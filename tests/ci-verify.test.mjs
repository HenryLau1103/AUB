import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWorkspace } from '../scripts/ci-verify.lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('CI1: configured Blueprints and projects pass contract verification', async () => {
  const result = await verifyWorkspace({
    workspace: ROOT,
    configPath: 'examples/ci/aub.ci.json',
  });
  assert.equal(result.valid, true, JSON.stringify(result.failures));
  assert.equal(result.summary.checks, 3);
  assert.equal(result.summary.failed, 0);
});

test('CI2: require-reports fails a Blueprint without implementation evidence', async () => {
  const result = await verifyWorkspace({
    workspace: ROOT,
    configPath: 'examples/ci/aub.ci.json',
    requireReports: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.message.includes('No implementation report')));
});

test('CI3: discover mode allows an initialized workspace before Blueprints exist', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-ci-discover-'));
  await mkdir(join(workspace, '.aub'), { recursive: true });
  await writeFile(join(workspace, '.aub', 'ci.json'), `${JSON.stringify({
    version: '1.0.0',
    discover: true,
    reports: [],
  }, null, 2)}\n`, 'utf8');

  const result = await verifyWorkspace({
    workspace,
    configPath: '.aub/ci.json',
  });

  assert.equal(result.valid, true, JSON.stringify(result.failures));
  assert.equal(result.summary.checks, 0);
});
