import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWorkspace } from '../scripts/ci-verify.lib.mjs';

const execFileAsync = promisify(execFile);
const CLI = new URL('../packages/workspace-cli/bin/aub-workspace.mjs', import.meta.url);

test('WCLI5: aub-workspace demo creates a synthetic safety gate workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-cli-demo-'));
  await rm(root, { recursive: true, force: true });
  await execFileAsync(process.execPath, [CLI.pathname, 'demo', '--workspace', root]);

  assert.equal(existsSync(join(root, '.aub', 'scan-report.json')), true);
  assert.equal(existsSync(join(root, '.aub', 'templates', 'risk-dashboard.aub.template.json')), true);
  assert.equal(existsSync(join(root, 'screens', 'risk-dashboard.ui.json')), true);
  assert.equal(existsSync(join(root, '.aub', 'reports', 'risk-dashboard.fail.implementation-report.json')), true);
  assert.equal(existsSync(join(root, '.aub', 'reports', 'risk-dashboard.pass.implementation-report.json')), true);
  assert.equal(existsSync(join(root, '.aub', 'pr-comment.fail.md')), true);
  assert.equal(existsSync(join(root, '.aub', 'pr-comment.pass.md')), true);

  const scanReport = JSON.parse(await readFile(join(root, '.aub', 'scan-report.json'), 'utf8'));
  assert.equal(scanReport.format, 'aub-scan-report');
  assert.ok(scanReport.summary.routes >= 1);
  assert.ok(scanReport.summary.componentCandidates >= 1);

  const failComment = await readFile(join(root, '.aub', 'pr-comment.fail.md'), 'utf8');
  const passComment = await readFile(join(root, '.aub', 'pr-comment.pass.md'), 'utf8');
  assert.match(failComment, /Decision:\*\* Do not merge/);
  assert.match(failComment, /Evidence Matrix/);
  assert.match(passComment, /Decision:\*\* Ready for review/);
  assert.match(passComment, /Evidence Matrix/);

  const pass = await verifyWorkspace({
    workspace: root,
    configPath: '.aub/ci.pass.json',
    requireReports: true,
    requireEvidence: true,
    minSafetyScore: 70,
  });
  assert.equal(pass.valid, true, JSON.stringify(pass.failures));

  const fail = await verifyWorkspace({
    workspace: root,
    configPath: '.aub/ci.json',
    requireReports: true,
    requireEvidence: true,
    minSafetyScore: 70,
  });
  assert.equal(fail.valid, false);
  assert.ok(fail.failures.some((failure) => failure.message.includes('safety score')));
});
