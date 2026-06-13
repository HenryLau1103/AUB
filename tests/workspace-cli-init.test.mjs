import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const CLI = new URL('../packages/workspace-cli/bin/aub-workspace.mjs', import.meta.url);

async function tempWorkspace(prefix = 'aub-cli-init-') {
  return mkdtemp(join(tmpdir(), prefix));
}

async function runInit(root, args = []) {
  return execFileAsync(process.execPath, [CLI.pathname, 'init', '--workspace', root, ...args], {
    cwd: root,
  });
}

test('WCLI1: aub-workspace init creates AUB config without app source edits', async () => {
  const root = await tempWorkspace();
  await runInit(root, ['--no-github']);

  assert.equal(existsSync(join(root, '.aub', 'ci.json')), true);
  assert.equal(existsSync(join(root, '.aub', 'README.md')), true);
  assert.equal(existsSync(join(root, '.aubignore')), true);
  assert.equal(existsSync(join(root, 'AGENTS.md')), true);
  assert.equal(existsSync(join(root, '.github')), false);

  const config = JSON.parse(await readFile(join(root, '.aub', 'ci.json'), 'utf8'));
  assert.equal(config.version, '1.0.0');
  assert.equal(config.discover, true);
});

test('WCLI2: aub-workspace init refuses to overwrite existing files without --force', async () => {
  const root = await tempWorkspace();
  await runInit(root, ['--no-github']);

  await assert.rejects(
    runInit(root, ['--no-github']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /did not overwrite existing files/);
      return true;
    }
  );
});

test('WCLI3: aub-workspace init --force overwrites existing files', async () => {
  const root = await tempWorkspace();
  await runInit(root, ['--no-github']);
  await writeFile(join(root, '.aub', 'README.md'), 'custom\n', 'utf8');

  await runInit(root, ['--no-github', '--force']);
  const readme = await readFile(join(root, '.aub', 'README.md'), 'utf8');
  assert.match(readme, /This directory is managed by AUB/);
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /AUB Agent Instructions/);
});

test('WCLI4: aub-workspace init --ci-only keeps issue templates out', async () => {
  const root = await tempWorkspace();
  await runInit(root, ['--ci-only']);

  assert.equal(existsSync(join(root, '.aub', 'ci.json')), true);
  assert.equal(existsSync(join(root, '.aub', 'README.md')), false);
  assert.equal(existsSync(join(root, '.aubignore')), false);
  assert.equal(existsSync(join(root, 'AGENTS.md')), false);
  assert.equal(existsSync(join(root, '.github', 'workflows', 'aub-contracts.yml')), true);
  assert.equal(existsSync(join(root, '.github', 'ISSUE_TEMPLATE')), false);
  assert.equal(existsSync(join(root, '.github', 'copilot-instructions.md')), false);
});
