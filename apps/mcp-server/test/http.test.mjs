import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { findRepoRoot } from '../dist/repo.js';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HTTP server did not become ready')), 10_000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`HTTP server exited before ready (${code})`));
    });
    child.stderr.on('data', (chunk) => {
      if (String(chunk).includes('HTTP ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

test('Streamable HTTP transport initializes and calls an AUB tool', async () => {
  const port = await availablePort();
  const token = 'streamable-http-test-token';
  const child = spawn(
    process.execPath,
    ['dist/http.js', '--workspace', findRepoRoot(), '--port', String(port), '--rpc-token', token],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  try {
    await waitForReady(child);
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    assert.equal(health.status, 'ok');
    assert.equal(health.tools.length, 23);

    const client = new Client({ name: 'aub-http-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: {
        headers: { authorization: `Bearer ${token}` },
      },
    });
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 23);
    const result = await client.callTool({
      name: 'validate_blueprint',
      arguments: { ref: 'examples/dashboard.ui.json' },
    });
    assert.equal(JSON.parse(result.content[0].text).valid, true);
    await client.close();
  } finally {
    child.kill('SIGTERM');
  }
});
