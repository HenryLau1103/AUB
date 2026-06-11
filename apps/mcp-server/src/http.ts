#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import { loadValidators } from './schema.js';
import type { ServerContext } from './context.js';
import { createAubServer, registeredToolNames } from './server.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveConfig() {
  const positional = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
  const root = resolve(option('--workspace') ?? positional ?? process.env.AUB_WORKSPACE ?? process.cwd());
  const host = option('--host') ?? process.env.AUB_HOST ?? '127.0.0.1';
  const port = Number(option('--port') ?? process.env.AUB_PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${String(port)}`);
  }
  return { root, host, port };
}

async function main(): Promise<void> {
  const { root, host, port } = resolveConfig();
  const validators = await loadValidators();
  const ctx: ServerContext = { root, validators };
  const app = createMcpExpressApp({ host });
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'aub-mcp-server',
      version: '0.3.0',
      workspace: root,
      tools: registeredToolNames(),
    });
  });

  app.all('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      let transport = typeof sessionId === 'string' ? transports.get(sessionId) : undefined;

      if (!transport && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });
        transport.onclose = () => {
          if (transport?.sessionId) transports.delete(transport.sessionId);
        };
        await createAubServer(ctx).connect(transport);
      }

      if (!transport) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'A valid MCP session is required.' },
          id: null,
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('AUB MCP HTTP request failed:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const listener = app.listen(port, host, () => {
    console.error(`aub-mcp-server HTTP ready at http://${host}:${port}/mcp (workspace: ${root})`);
  });

  const shutdown = async () => {
    for (const transport of transports.values()) await transport.close();
    listener.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
