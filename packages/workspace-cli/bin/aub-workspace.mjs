#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoFallbackRoot = resolve(packageRoot, '..', '..');

function parseArgs(argv) {
  const args = {
    workspace: process.cwd(),
    host: '127.0.0.1',
    mcpPort: 3100,
    editorPort: 3110,
    open: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      args.help = true;
    } else if (value === '--version' || value === '-v') {
      args.version = true;
    } else if (value === '--no-open') {
      args.open = false;
    } else if (value === '--workspace') {
      args.workspace = argv[++index];
    } else if (value === '--host') {
      args.host = argv[++index];
    } else if (value === '--mcp-port') {
      args.mcpPort = Number(argv[++index]);
    } else if (value === '--editor-port') {
      args.editorPort = Number(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

function usage() {
  return [
    'Usage: aub-workspace [options]',
    '',
    'Options:',
    '  --workspace <path>     Existing project root. Defaults to current directory.',
    '  --mcp-port <port>      Preferred MCP HTTP port. Defaults to 3100.',
    '  --editor-port <port>   Preferred editor port. Defaults to 3110.',
    '  --host <host>          Local host binding. Defaults to 127.0.0.1.',
    '  --no-open             Print the editor URL without opening a browser.',
    '  -h, --help            Show help.',
    '  -v, --version         Show version.',
  ].join('\n');
}

function validatePort(port, name) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name}: ${String(port)}`);
  }
}

async function findOpenPort(host, preferredPort) {
  for (let port = preferredPort; port < preferredPort + 50; port += 1) {
    const server = createServer();
    const available = await new Promise((resolveAvailable) => {
      server.once('error', () => resolveAvailable(false));
      server.once('listening', () => resolveAvailable(true));
      server.listen(port, host);
    });
    if (available) {
      await new Promise((resolveClose) => server.close(resolveClose));
      return port;
    }
  }
  throw new Error(`Could not find an open port starting at ${preferredPort}`);
}

function findAubRuntimeRoot() {
  const vendorRoot = join(packageRoot, 'vendor', 'aub');
  if (existsSync(join(vendorRoot, 'schema', 'ui-blueprint.schema.json'))) return vendorRoot;
  if (existsSync(join(repoFallbackRoot, 'schema', 'ui-blueprint.schema.json'))) return repoFallbackRoot;
  throw new Error('AUB runtime payload is missing. Rebuild the package with: pnpm workspace:package');
}

function mimeType(path) {
  switch (extname(path)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

function isInside(root, filePath) {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  return filePath === root || filePath.startsWith(normalizedRoot);
}

function createEditorServer(editorRoot) {
  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      const rawPath = decodeURIComponent(requestUrl.pathname);
      const relativePath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
      let filePath = resolve(editorRoot, relativePath);
      if (!isInside(editorRoot, filePath)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      try {
        const info = await stat(filePath);
        if (!info.isFile()) throw new Error('not a file');
      } catch {
        filePath = join(editorRoot, 'index.html');
      }
      res.writeHead(200, { 'content-type': mimeType(filePath) });
      createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });
}

async function listen(server, host, preferredPort) {
  const port = await findOpenPort(host, preferredPort);
  server.listen(port, host);
  await once(server, 'listening');
  return port;
}

async function waitForHealth(url) {
  const deadline = Date.now() + 10000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`MCP server did not become healthy: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

async function stopChildProcess(child, timeoutMs = 2500) {
  if (child.killed || child.exitCode !== null) return;
  child.kill('SIGTERM');
  let exited = false;
  await Promise.race([
    once(child, 'exit').then(() => {
      exited = true;
    }),
    new Promise((resolveTimer) => setTimeout(resolveTimer, timeoutMs)),
  ]);
  if (!exited && !child.killed) {
    child.kill('SIGKILL');
    await once(child, 'exit').catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.version) {
    console.log('0.3.0');
    return;
  }

  validatePort(args.mcpPort, 'MCP port');
  validatePort(args.editorPort, 'editor port');

  const workspace = resolve(args.workspace);
  const workspaceInfo = await stat(workspace).catch(() => null);
  if (!workspaceInfo?.isDirectory()) {
    throw new Error(`Workspace is not a directory: ${workspace}`);
  }

  const aubRoot = findAubRuntimeRoot();
  const mcpEntry = join(aubRoot, 'apps', 'mcp-server', 'dist', 'http.js');
  const editorRoot = join(aubRoot, 'apps', 'editor', 'dist');
  if (!existsSync(mcpEntry)) throw new Error(`MCP server build is missing: ${mcpEntry}`);
  if (!existsSync(join(editorRoot, 'index.html'))) throw new Error(`Editor build is missing: ${editorRoot}`);

  const mcpPort = await findOpenPort(args.host, args.mcpPort);
  const mcp = spawn(process.execPath, [
    mcpEntry,
    '--workspace',
    workspace,
    '--host',
    args.host,
    '--port',
    String(mcpPort),
  ], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
  });

  const mcpUrl = `http://${args.host}:${mcpPort}/mcp`;
  await waitForHealth(`http://${args.host}:${mcpPort}/health`);

  const editorServer = createEditorServer(editorRoot);
  const editorPort = await listen(editorServer, args.host, args.editorPort);
  const editorUrl = new URL(`http://${args.host}:${editorPort}/`);
  editorUrl.searchParams.set('mcp', mcpUrl);

  console.error('');
  console.error('AUB Workspace is running');
  console.error(`Workspace: ${workspace}`);
  console.error(`Editor:    ${editorUrl.href}`);
  console.error(`MCP:       ${mcpUrl}`);
  console.error('Stop:      Ctrl+C');
  console.error('');

  if (args.open) openBrowser(editorUrl.href);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    editorServer.close();
    void stopChildProcess(mcp)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  mcp.on('exit', (code) => {
    if (shuttingDown) return;
    editorServer.close(() => process.exit(code ?? 0));
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
