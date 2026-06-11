#!/usr/bin/env node
import { resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadValidators } from './schema.js';
import type { ServerContext } from './context.js';
import { createAubServer } from './server.js';

export function resolveWorkspaceRoot(): string {
  const fromArg = process.argv[2];
  const fromEnv = process.env.AUB_WORKSPACE;
  return resolve(fromArg ?? fromEnv ?? process.cwd());
}

async function main(): Promise<void> {
  const root = resolveWorkspaceRoot();
  const validators = await loadValidators();
  const ctx: ServerContext = { root, validators };
  const server = createAubServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`aub-mcp-server ready (workspace: ${root})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
