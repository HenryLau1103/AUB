import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const SCRIPT = new URL('../scripts/create-playwright-smoke.mjs', import.meta.url);
const BLUEPRINT = new URL('../examples/dashboard.ui.json', import.meta.url);

test('PW1: Playwright bridge generates viewport and evidence smoke checks', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'aub-playwright-bridge-'));
  const output = join(workspace, 'tests', 'aub-ui.spec.ts');
  await mkdir(join(workspace, 'screens'), { recursive: true });
  await writeFile(join(workspace, 'screens', 'dashboard.ui.json'), await readFile(BLUEPRINT, 'utf8'), 'utf8');

  await execFileAsync(process.execPath, [
    SCRIPT.pathname,
    '--workspace',
    workspace,
    '--blueprint',
    'screens/dashboard.ui.json',
    '--url',
    'http://localhost:3000/dashboard',
    '--output',
    'tests/aub-ui.spec.ts',
  ]);

  const spec = await readFile(output, 'utf8');
  assert.match(spec, /@playwright\/test/);
  assert.match(spec, /horizontalOverflow/);
  assert.match(spec, /data-aub-node/);
  assert.match(spec, /acceptanceIds/);
  assert.match(spec, /desktop/);
  assert.match(spec, /mobile/);
});
