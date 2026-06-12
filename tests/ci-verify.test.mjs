import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
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

test('CI3: composite action passes config through env without shell execution', async () => {
  const action = yaml.load(await readFile(resolve(ROOT, 'action.yml'), 'utf8'));
  const verifyStep = action.runs.steps.find((step) => step.name === 'Verify AUB contracts');
  assert.equal(verifyStep.env.AUB_CONFIG_INPUT, '${{ inputs.config }}');
  assert.ok(!verifyStep.run.includes('${{ inputs.config }}'));

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
