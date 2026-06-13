import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SOURCE = new URL('../apps/editor/src/lib/workspace-client.ts', import.meta.url).pathname;

async function importWorkspaceClientModule() {
  const temp = await mkdtemp(join(tmpdir(), 'aub-workspace-client-'));
  const source = await readFile(SOURCE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  const modulePath = join(temp, 'workspace-client.mjs');
  await writeFile(modulePath, transpiled, 'utf8');
  const mod = await import(`file://${modulePath}`);
  return { mod, cleanup: () => rm(temp, { recursive: true, force: true }) };
}

test('workspace client normalizes token-bearing endpoints and can reattach stored tokens', async () => {
  const { mod, cleanup } = await importWorkspaceClientModule();
  try {
    const connection = mod.normalizeWorkspaceEndpoint('http://127.0.0.1:3100/mcp?token=rpc_secret');
    assert.equal(connection.endpoint, 'http://127.0.0.1:3100/mcp');
    assert.equal(connection.rpcUrl, 'http://127.0.0.1:3100/rpc');
    assert.equal(connection.rpcToken, 'rpc_secret');

    const restored = mod.attachWorkspaceTokenIfMissing(connection.endpoint, connection.rpcToken);
    assert.equal(new URL(restored).searchParams.get('token'), 'rpc_secret');

    const explicit = mod.attachWorkspaceTokenIfMissing('http://127.0.0.1:3100/mcp?rpc-token=manual', 'stored');
    assert.equal(new URL(explicit).searchParams.get('rpc-token'), 'manual');
    assert.equal(new URL(explicit).searchParams.has('token'), false);
  } finally {
    await cleanup();
  }
});
