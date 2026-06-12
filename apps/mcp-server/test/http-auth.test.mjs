import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const HTTP_ENTRY = fileURLToPath(new URL('../dist/http.js', import.meta.url));

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

async function waitForHealth(port) {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError ?? new Error('Timed out waiting for HTTP server health.');
}

async function startServer(root, extraArgs = []) {
  const port = await findOpenPort();
  const child = spawn(process.execPath, [
    HTTP_ENTRY,
    '--workspace',
    root,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    ...extraArgs,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.setEncoding('utf8');
  child.stdout.setEncoding('utf8');
  await waitForHealth(port);
  return { child, port };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await once(child, 'exit').catch(() => {});
}

async function rpc(port, headers = {}) {
  return fetch(`http://127.0.0.1:${port}/rpc`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3110',
      ...headers,
    },
    body: JSON.stringify({
      tool: 'update_aub_session',
      args: { patch: { activeBlueprint: 'screens/settings.ui.json' } },
    }),
  });
}

test('HTTP RPC rejects unauthenticated requests by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-http-auth-default-'));
  const { child, port } = await startServer(root);
  try {
    const response = await rpc(port);
    assert.equal(response.status, 401);
    await assert.rejects(() => readFile(join(root, '.aub', 'session.json'), 'utf8'), /ENOENT/);
  } finally {
    await stopServer(child);
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP RPC accepts requests with a configured bearer token', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-http-auth-token-'));
  const { child, port } = await startServer(root, ['--rpc-token', 'secret-token']);
  try {
    assert.equal((await rpc(port)).status, 401);
    const response = await rpc(port, { authorization: 'Bearer secret-token' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    const stored = JSON.parse(await readFile(join(root, '.aub', 'session.json'), 'utf8'));
    assert.equal(stored.activeBlueprint, 'screens/settings.ui.json');
  } finally {
    await stopServer(child);
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP RPC allows no-token mode only with explicit opt-in', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-http-auth-optin-'));
  const { child, port } = await startServer(root, ['--allow-unauthenticated-rpc']);
  try {
    const response = await rpc(port);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
  } finally {
    await stopServer(child);
    await rm(root, { recursive: true, force: true });
  }
});
