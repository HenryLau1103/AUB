import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
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

test('CI3: composite action passes config through env without shell execution', async () => {
  const action = yaml.load(await readFile(resolve(ROOT, 'action.yml'), 'utf8'));
  const verifyStep = action.runs.steps.find((step) => step.name === 'Verify AUB contracts');
  const commentStep = action.runs.steps.find((step) => step.name === 'Comment PR Safety Score');
  assert.equal(verifyStep.env.AUB_CONFIG_INPUT, '${{ inputs.config }}');
  assert.equal(verifyStep.env.AUB_MIN_SAFETY_SCORE, '${{ inputs.min-safety-score }}');
  assert.ok(!verifyStep.run.includes('${{ inputs.config }}'));
  assert.ok(!verifyStep.run.includes('${{ inputs.min-safety-score }}'));
  assert.equal(commentStep.env.AUB_CONFIG_INPUT, '${{ inputs.config }}');
  assert.equal(commentStep.env.AUB_MIN_SAFETY_SCORE, '${{ inputs.min-safety-score }}');
  assert.ok(!commentStep.run.includes('${{ inputs.config }}'));
  assert.ok(!commentStep.run.includes('${{ inputs.min-safety-score }}'));

  const dir = await mkdtemp(join(tmpdir(), 'aub-action-shell-'));
  const sentinel = join(dir, 'sentinel');
  const payload = `examples/ci/aub.ci.json; touch ${sentinel}; # $(touch ${sentinel})`;
  const script = verifyStep.run.replace(
    /node "\$GITHUB_ACTION_PATH\/scripts\/ci-verify\.mjs" "\$\{args\[@\]\}"/,
    'printf "%s\\n" "${args[@]}"'
  );

  try {
    const { stdout } = await new Promise((resolveExec, rejectExec) => {
      execFile(
        'bash',
        ['-c', script],
        {
          env: {
            ...process.env,
            GITHUB_WORKSPACE: ROOT,
            AUB_CONFIG_INPUT: payload,
            AUB_REQUIRE_REPORTS: 'true',
          },
        },
        (error, stdout, stderr) => {
          if (error) rejectExec(Object.assign(error, { stdout, stderr }));
          else resolveExec({ stdout, stderr });
        }
      );
    });
    assert.match(stdout, new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await assert.rejects(() => readFile(sentinel, 'utf8'), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CI4: discover mode allows an initialized workspace before Blueprints exist', async () => {
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

test('CI5: min_safety_score fails low-evidence implementation reports', async () => {
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

test('CI6: AUB self-dogfood editor report passes the evidence gate', async () => {
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

test('CI7: CI config path must stay inside the workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-ci-config-boundary-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-ci-outside-'));
  await writeFile(join(outside, 'ci.json'), `${JSON.stringify({ version: '1.0.0' })}\n`, 'utf8');

  try {
    const relativeEscape = await verifyWorkspace({
      workspace,
      configPath: '../ci.json',
    });
    assert.equal(relativeEscape.valid, false);
    assert.ok(relativeEscape.failures.some((failure) => failure.message.includes('workspace')));

    const absoluteEscape = await verifyWorkspace({
      workspace,
      configPath: join(outside, 'ci.json'),
    });
    assert.equal(absoluteEscape.valid, false);
    assert.ok(absoluteEscape.failures.some((failure) => failure.message.includes('workspace-relative')));
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('CI8: configured refs cannot escape the workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-ci-ref-boundary-'));
  await mkdir(join(workspace, '.aub'), { recursive: true });

  try {
    await writeFile(join(workspace, '.aub', 'ci.json'), `${JSON.stringify({
      version: '1.0.0',
      blueprints: ['../outside.ui.json'],
      projects: ['/tmp/outside.aub.project.json'],
      reports: [{ blueprint: 'screens/freeform-actions.ui.json', report: '../report.json' }],
    }, null, 2)}\n`, 'utf8');

    const result = await verifyWorkspace({
      workspace,
      configPath: '.aub/ci.json',
    });
    assert.equal(result.valid, false);
    assert.ok(result.failures.some((failure) => failure.message.includes('CI config')));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('CI9: configured refs cannot follow symlinks outside the workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-ci-symlink-boundary-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-ci-symlink-outside-'));
  const blueprint = await readFile(resolve(ROOT, 'examples/freeform-actions.ui.json'), 'utf8');
  await mkdir(join(workspace, '.aub'), { recursive: true });
  await writeFile(join(outside, 'outside.ui.json'), blueprint, 'utf8');
  await symlink(join(outside, 'outside.ui.json'), join(workspace, 'linked.ui.json'));
  await writeFile(join(workspace, '.aub', 'ci.json'), `${JSON.stringify({
    version: '1.0.0',
    blueprints: ['linked.ui.json'],
  }, null, 2)}\n`, 'utf8');

  try {
    const result = await verifyWorkspace({
      workspace,
      configPath: '.aub/ci.json',
    });
    assert.equal(result.valid, false);
    assert.ok(result.failures.some((failure) => failure.message.includes('stay inside the workspace')));
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
