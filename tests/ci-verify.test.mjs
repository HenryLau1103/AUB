import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWorkspace } from '../scripts/ci-verify.lib.mjs';
import { createImplementationReportTemplate } from '../scripts/implementation-report.lib.mjs';

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

test('CI4: min_safety_score fails low-evidence implementation reports', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-ci-score-'));
  await mkdir(join(workspace, '.aub', 'reports'), { recursive: true });
  await mkdir(join(workspace, 'screens'), { recursive: true });
  const blueprint = JSON.parse(await readFile(resolve(ROOT, 'examples/freeform-actions.ui.json'), 'utf8'));
  const report = createImplementationReportTemplate(blueprint);
  await writeFile(join(workspace, 'screens', 'freeform-actions.ui.json'), `${JSON.stringify(blueprint, null, 2)}\n`, 'utf8');
  await writeFile(join(workspace, '.aub', 'reports', 'freeform-actions.implementation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(workspace, '.aub', 'ci.json'), `${JSON.stringify({
    version: '1.0.0',
    blueprints: ['screens/freeform-actions.ui.json'],
    reports: [{
      blueprint: 'screens/freeform-actions.ui.json',
      report: '.aub/reports/freeform-actions.implementation-report.json',
    }],
    min_safety_score: 70,
  }, null, 2)}\n`, 'utf8');

  const result = await verifyWorkspace({
    workspace,
    configPath: '.aub/ci.json',
  });

  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.message.includes('safety score')));
  assert.equal(result.checks.find((check) => check.kind === 'report')?.safetyScore.grade, 'fail');
});

test('CI5: AUB self-dogfood editor report passes the evidence gate', async () => {
  const result = await verifyWorkspace({
    workspace: ROOT,
    configPath: 'examples/dogfood/aub.ci.json',
    requireReports: true,
    requireEvidence: true,
    minSafetyScore: 70,
  });

  assert.equal(result.valid, true, JSON.stringify(result.failures));
  const report = result.checks.find((check) => check.kind === 'report');
  assert.equal(report?.safetyScore.grade, 'pass');
  assert.equal(report?.reportSummary.acceptance_passed, report?.reportSummary.acceptance_total);
});
