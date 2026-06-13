import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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
    return true;
  }
  return false;
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

async function waitForStderr(child, pattern) {
  let stderr = '';
  const deadline = Date.now() + 10000;
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (pattern.test(stderr)) {
        clearInterval(timer);
        resolve(stderr);
      } else if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for stderr pattern ${pattern}.\n${stderr}`));
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
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => {
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
        resolve();
      }, 2000);
    }),
  ]).catch(() => {});
  if (child.exitCode === null) await once(child, 'exit').catch(() => {});
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

test('WCLI0: aub-workspace --version reports the package version', async () => {
  const { stdout } = await execFileAsync(process.execPath, [CLI.pathname, '--version']);
  assert.equal(stdout.trim(), '0.4.0');
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

test('WCLI5: aub-workspace start redacts terminal URLs while requiring authenticated RPC', async (t) => {
  if (!(await ensureWorkspaceRuntimeBuilt())) {
    t.skip('workspace runtime dist is missing; run apps/mcp-server build and apps/editor build for launcher smoke coverage');
    return;
  }
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
    assert.equal(token, '<redacted>');
    assert.equal(editorUrlText.includes('rpc_'), false, 'terminal output must not expose the raw RPC token');
    assert.match(editorUrlText, /%253Credacted%253E/);

    const rpcUrl = new URL(endpoint.href);
    rpcUrl.pathname = rpcUrl.pathname.replace(/\/mcp$/, '/rpc');
    rpcUrl.search = '';

    const unauthorized = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${editorPort}` },
      body: JSON.stringify({ tool: 'get_workspace_status', args: {} }),
    });
    assert.equal(unauthorized.status, 401);

    const redactedTokenRequest = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: `http://127.0.0.1:${editorPort}`,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool: 'get_workspace_status', args: {} }),
    });
    assert.equal(redactedTokenRequest.status, 401);
  } finally {
    await stopChild(child);
    await rm(root, { recursive: true, force: true });
  }
});

test('WCLI6: aub-workspace --no-open --print-auth-url prints an explicit authenticated manual URL', async (t) => {
  if (!(await ensureWorkspaceRuntimeBuilt())) {
    t.skip('workspace runtime dist is missing; run apps/mcp-server build and apps/editor build for launcher smoke coverage');
    return;
  }
  const root = await tempWorkspace('aub-cli-manual-');
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
    '--print-auth-url',
  ], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  try {
    const stderr = await waitForStderr(child, /Manual:\s+http:\/\/127\.0\.0\.1:\d+\//);
    const manualMatch = stderr.match(/Manual:\s+(\S+)/);
    assert.ok(manualMatch, stderr);
    const manualUrl = new URL(manualMatch[1]);
    const endpoint = new URL(manualUrl.searchParams.get('mcp'));
    const token = endpoint.searchParams.get('token');
    assert.ok(token);
    assert.notEqual(token, '<redacted>');
    assert.match(stderr, /Do not paste it into issues/);

    const rpcUrl = new URL(endpoint.href);
    rpcUrl.pathname = rpcUrl.pathname.replace(/\/mcp$/, '/rpc');
    rpcUrl.search = '';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: `http://127.0.0.1:${editorPort}`,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool: 'get_workspace_status', args: {} }),
    });
    assert.equal(response.status, 200);
  } finally {
    await stopChild(child);
    await rm(root, { recursive: true, force: true });
  }
});

test('WCLI7: aub-workspace init refuses symlink parents that escape the workspace', async () => {
  const root = await tempWorkspace('aub-cli-symlink-');
  const outside = await tempWorkspace('aub-cli-symlink-outside-');
  await symlink(outside, join(root, '.github'), 'dir');

  try {
    await assert.rejects(
      runInit(root, ['--force', '--ci-only']),
      (error) => {
        assert.match(error.stderr, /Init path parent must stay inside workspace/);
        return true;
      }
    );
    assert.equal(existsSync(join(outside, 'workflows', 'aub-contracts.yml')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('WCLI8: aub-workspace init creates normal nested parents after containment checks', async () => {
  const root = await tempWorkspace('aub-cli-normal-');
  await mkdir(join(root, 'src'), { recursive: true });

  await runInit(root, ['--force']);

  assert.equal(existsSync(join(root, '.github', 'workflows', 'aub-contracts.yml')), true);
  assert.equal(existsSync(join(root, '.aub', 'ci.json')), true);
});
