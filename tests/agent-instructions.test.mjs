import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const SCRIPT = new URL('../scripts/export-agent-instructions.mjs', import.meta.url);

test('AI1: agent instructions include current AUB session when available', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-agent-instructions-'));
  await mkdir(join(workspace, '.aub'), { recursive: true });
  await writeFile(join(workspace, '.aub', 'session.json'), `${JSON.stringify({
    version: '0.1.0',
    activeBlueprint: 'screens/settings.ui.json',
    activeProject: null,
    targetRoute: '/settings',
    preview: {
      devServerUrl: 'http://localhost:3000',
      route: '/settings',
      lastImplementationReport: null,
    },
    updatedAt: '2026-06-11T00:00:00.000Z',
  }, null, 2)}\n`, 'utf8');

  const { stdout } = await execFileAsync(process.execPath, [
    SCRIPT.pathname,
    '--workspace',
    workspace,
    '--target',
    'codex',
  ]);

  assert.match(stdout, /Codex AUB UI implementation instruction/);
  assert.match(stdout, /screens\/settings\.ui\.json/);
  assert.match(stdout, /http:\/\/localhost:3000\/settings/);
  assert.match(stdout, /PR Safety Score/);
});
