import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

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

async function findOpenPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function ensureWorkspaceRuntimeBuilt() {
  if (existsSync(join(process.cwd(), 'apps', 'mcp-server', 'dist', 'http.js'))
    && existsSync(join(process.cwd(), 'apps', 'editor', 'dist', 'index.html'))) {
    return;
  }
  await execFileAsync('pnpm', ['--dir', 'apps/mcp-server', 'build'], { cwd: process.cwd() });
  await execFileAsync('pnpm', ['--dir', 'apps/editor', 'build'], { cwd: process.cwd() });
}

async function waitForEditorUrl(child) {
  let stderr = '';
  const deadline = Date.now() + 10000;
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const match = stderr.match(/Editor:\s+(\S+)/);
      if (match) {
        clearInterval(timer);
        resolve(match[1]);
      } else if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for editor URL.\n${stderr}`));
      }
    }, 50);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('exit', (code) => {
      clearInterval(timer);
      reject(new Error(`aub-workspace exited with ${code}.\n${stderr}`));
    });
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await once(child, 'exit').catch(() => {});
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

test('WCLI5: aub-workspace start passes the RPC token inside the MCP endpoint URL', async () => {
  await ensureWorkspaceRuntimeBuilt();
  const root = await tempWorkspace('aub-cli-start-');
  const mcpPort = await findOpenPort();
  const editorPort = await findOpenPort();
  const child = spawn(process.execPath, [
    CLI.pathname,
    '--workspace',
    root,
    '--mcp-port',
    String(mcpPort),
    '--editor-port',
    String(editorPort),
    '--no-open',
  ], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  try {
    const editorUrlText = await waitForEditorUrl(child);
    const editorUrl = new URL(editorUrlText);
    assert.equal(editorUrl.searchParams.has('token'), false);
    const endpoint = new URL(editorUrl.searchParams.get('mcp'));
    const token = endpoint.searchParams.get('token');
    assert.ok(token, 'expected RPC token inside mcp endpoint');

    const rpcUrl = new URL(endpoint.href);
    rpcUrl.pathname = rpcUrl.pathname.replace(/\/mcp$/, '/rpc');
    rpcUrl.search = '';

    const unauthorized = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${editorPort}` },
      body: JSON.stringify({ tool: 'get_workspace_status', args: {} }),
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: `http://127.0.0.1:${editorPort}`,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool: 'get_workspace_status', args: {} }),
    });
    assert.equal(authorized.status, 200);
    const payload = await authorized.json();
    assert.equal(payload.ok, true);
  } finally {
    await stopChild(child);
    await rm(root, { recursive: true, force: true });
  }
});
