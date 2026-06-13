#!/usr/bin/env node
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { type Request, type Response } from 'express';
import { loadValidators } from './schema.js';
import type { ServerContext } from './context.js';
import { createAubServer, registeredToolNames, runAubTool } from './server.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseList(value: string | undefined): string[] {
  const seen = new Set<string>();
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function parseBoolean(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(value ?? '');
}

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
}

function isAllowedOrigin(origin: string, cfg: ReturnType<typeof resolveRpcConfig>): boolean {
  if (cfg.allowedOrigins.length > 0) return cfg.allowedOrigins.includes(origin);
  return isLocalOrigin(origin) || origin === 'https://henrylau1103.github.io';
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function rpcErrorPayload(status: number, message: string, code = -32000) {
  return {
    ok: false,
    error: message,
    ...(status === 400 ? { code } : {}),
  };
}

function mcpErrorPayload(message: string, code = -32000) {
  return {
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  };
}

function checkRpcAuthorization(req: Request, cfg: ReturnType<typeof resolveRpcConfig>): { ok: true } | { ok: false; status: number; message: string } {
  const origin = req.headers.origin;
  if (cfg.allowedOrigins.length > 0) {
    if (!origin || !isAllowedOrigin(origin, cfg)) {
      return { ok: false, status: 403, message: 'RPC origin is not allowed.' };
    }
  } else {
    if (origin && !isAllowedOrigin(origin, cfg)) {
      return { ok: false, status: 403, message: 'RPC origin is not allowed.' };
    }
  }

  if (cfg.tokens.length === 0 && cfg.allowUnauthenticated) {
    return { ok: true };
  }
  if (cfg.tokens.length === 0) {
    return { ok: false, status: 401, message: 'RPC token is required.' };
  }

  const rawAuth = req.get('authorization') ?? '';
  const tokenMatch = /^Bearer\s+(.+)$/.exec(rawAuth.trim());
  const provided = tokenMatch?.[1]?.trim() ?? rawAuth.trim();
  const match = cfg.tokens.some((candidate) => safeEquals(candidate, provided));
  if (!match) {
    return { ok: false, status: 401, message: 'Invalid or missing RPC token.' };
  }
  return { ok: true };
}

function resolveRpcConfig() {
  const configuredToken = parseList(option('--rpc-token') ?? process.env.AUB_RPC_TOKEN);
  const configuredOrigins = parseList(option('--rpc-allowed-origins') ?? process.env.AUB_RPC_ALLOWED_ORIGINS);
  const allowUnauthenticated =
    process.argv.includes('--allow-unauthenticated-rpc') ||
    parseBoolean(process.env.AUB_ALLOW_UNAUTHENTICATED_RPC);
  return {
    tokens: configuredToken,
    allowedOrigins: configuredOrigins,
    allowUnauthenticated,
  };
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
  const rpcConfig = resolveRpcConfig();
  const validators = await loadValidators();
  const ctx: ServerContext = { root, validators };
  const app = createMcpExpressApp({ host });
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.use(express.json({ limit: '20mb' }));
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin, rpcConfig)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-session-id, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'aub-mcp-server',
      version: '0.4.0',
      tools: registeredToolNames(),
    });
  });

  app.post('/rpc', async (req: Request, res: Response) => {
    const rpcAuth = checkRpcAuthorization(req, rpcConfig);
    if (!rpcAuth.ok) {
      const status = rpcAuth.status;
      res.status(status).json(rpcErrorPayload(status, rpcAuth.message, -32000));
      return;
    }

    try {
      const tool = String(req.body?.tool ?? '');
      const args = req.body?.args ?? {};
      const result = await runAubTool(ctx, tool, args);
      res.json({ ok: true, result });
    } catch (error) {
      res.status(400).json(rpcErrorPayload(400, error instanceof Error ? error.message : String(error), -32602));
    }
  });

  app.all('/mcp', async (req: Request, res: Response) => {
    const mcpAuth = checkRpcAuthorization(req, rpcConfig);
    if (!mcpAuth.ok) {
      res.status(mcpAuth.status).json(mcpErrorPayload(mcpAuth.message, -32000));
      return;
    }

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
        res.status(400).json(mcpErrorPayload('A valid MCP session is required.', -32000));
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('AUB MCP HTTP request failed:', error);
      if (!res.headersSent) {
        res.status(500).json(mcpErrorPayload('Internal server error', -32603));
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
