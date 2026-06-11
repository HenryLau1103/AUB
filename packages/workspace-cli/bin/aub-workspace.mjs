#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoFallbackRoot = resolve(packageRoot, '..', '..');

function parseArgs(argv) {
  const args = {
    command: 'start',
    workspace: process.cwd(),
    host: '127.0.0.1',
    mcpPort: 3100,
    editorPort: 3110,
    open: true,
    force: false,
    github: true,
    ciOnly: false,
  };
  if (argv[0] === 'init') {
    args.command = 'init';
    argv = argv.slice(1);
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      args.help = true;
    } else if (value === '--version' || value === '-v') {
      args.version = true;
    } else if (value === '--no-open') {
      args.open = false;
    } else if (value === '--force') {
      args.force = true;
    } else if (value === '--no-github') {
      args.github = false;
    } else if (value === '--ci-only') {
      args.ciOnly = true;
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
    'Usage:',
    '  aub-workspace [options]',
    '  aub-workspace init [options]',
    '',
    'Options:',
    '  --workspace <path>     Existing project root. Defaults to current directory.',
    '  --mcp-port <port>      Preferred MCP HTTP port. Defaults to 3100.',
    '  --editor-port <port>   Preferred editor port. Defaults to 3110.',
    '  --host <host>          Local host binding. Defaults to 127.0.0.1.',
    '  --no-open             Print the editor URL without opening a browser.',
    '  --force               Overwrite existing files during init.',
    '  --no-github           During init, skip GitHub workflow and issue templates.',
    '  --ci-only             During init, create only CI config and workflow files.',
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

const INIT_FILES = {
  '.aub/ci.json': `${JSON.stringify({
    $schema: 'https://henrylau1103.github.io/AUB/schema/aub-ci.schema.json',
    version: '1.0.0',
    discover: true,
    blueprints: [],
    projects: [],
    reports: [],
  }, null, 2)}\n`,
  '.aubignore': [
    '# AUB scanner ignore file.',
    '# Keep secrets, generated output, caches, and large local-only files out of scan results.',
    '',
    '.env',
    '.env.*',
    '*.pem',
    '*.key',
    '*.p12',
    '*.sqlite',
    '*.db',
    '*.log',
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '',
  ].join('\n'),
  '.aub/README.md': [
    '# AUB Workspace',
    '',
    'This directory is managed by AUB.',
    '',
    'Typical files:',
    '',
    '- `session.json`: the active Blueprint, route, preview URL, and handoff state.',
    '- `component-candidates.json`: scanned custom components awaiting review.',
    '- `templates/*.aub.template.json`: candidate templates generated from existing routes.',
    '- `reports/*.implementation-report.json`: implementation evidence submitted by agents.',
    '',
    'Start the local workspace loop from this project root:',
    '',
    '```bash',
    'npx aub-workspace',
    '```',
    '',
  ].join('\n'),
  'AGENTS.md': [
    '# AUB Agent Instructions',
    '',
    'When this repository uses AUB, treat `.ui.json` as the source of truth for UI changes.',
    '',
    'Required workflow:',
    '',
    '1. Read `.aub/session.json` or call AUB MCP `get_aub_session` before editing UI source.',
    '2. Read the active Blueprint with `get_blueprint`; do not redesign from prose.',
    '3. Resolve custom component mappings through `resolve_component` and approved `aub.registry.json` entries.',
    '4. Do not auto-approve `.aub/component-candidates.json`; users must review candidates first.',
    '5. Reuse mapped production components instead of creating lookalike components.',
    '6. Produce an implementation report with screenshot, DOM, overflow, component reuse, interaction, or code-diff evidence.',
    '7. Run AUB verification before PR handoff: `npx aub-workspace` for the editor loop, then project checks plus AUB report verification.',
    '',
  ].join('\n'),
  '.github/workflows/aub-contracts.yml': [
    'name: AUB UI contracts',
    '',
    'on:',
    '  pull_request:',
    '  workflow_dispatch:',
    '',
    'jobs:',
    '  aub-contracts:',
    '    if: ${{ hashFiles(\'**/*.ui.json\', \'**/*.ui.yaml\', \'**/*.aub.project.json\', \'.aub/ci.json\') != \'\' }}',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v6',
    '      - uses: HenryLau1103/AUB@main',
    '        with:',
    '          config: .aub/ci.json',
    '          require-reports: "false"',
    '          require-evidence: "false"',
    '          min-safety-score: ""',
    '',
  ].join('\n'),
  '.github/ISSUE_TEMPLATE/aub-ui-change.yml': [
    'name: AUB UI Change',
    'description: Ask an agent to modify an existing product UI using AUB as the contract.',
    'title: "[AUB UI] "',
    'labels: ["aub", "ui-change", "agent-ready"]',
    'body:',
    '  - type: input',
    '    id: target_route',
    '    attributes:',
    '      label: Target route',
    '      placeholder: /settings/billing',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: source_files',
    '    attributes:',
    '      label: Current source files',
    '      placeholder: |',
    '        app/settings/page.tsx',
    '        components/BillingCard.tsx',
    '    validations:',
    '      required: true',
    '  - type: input',
    '    id: aub_blueprint',
    '    attributes:',
    '      label: AUB Blueprint or workspace template',
    '      placeholder: screens/settings.ui.json or .aub/templates/settings.aub.template.json',
    '  - type: textarea',
    '    id: acceptance',
    '    attributes:',
    '      label: Acceptance criteria',
    '      description: Binary checks the implementation must satisfy.',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: agent_instruction',
    '    attributes:',
    '      label: Agent instruction',
    '      description: Paste the instruction copied from AUB Editor when available.',
    '',
  ].join('\n'),
  '.github/ISSUE_TEMPLATE/aub-scan-route.yml': [
    'name: AUB Scan Existing Route',
    'description: Ask an agent to scan an existing route and create an AUB workspace template.',
    'title: "[AUB Scan] "',
    'labels: ["aub", "scan", "agent-ready"]',
    'body:',
    '  - type: input',
    '    id: source_path',
    '    attributes:',
    '      label: Source route or component file',
    '      placeholder: app/settings/page.tsx',
    '    validations:',
    '      required: true',
    '  - type: input',
    '    id: route',
    '    attributes:',
    '      label: App route',
    '      placeholder: /settings',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: review_rules',
    '    attributes:',
    '      label: Candidate review rules',
    '      value: |',
    '        Do not write custom components directly into aub.registry.json.',
    '        Put scanned custom components in .aub/component-candidates.json.',
    '        Mark low-confidence mappings as candidate.',
    '        Include source references for every generated template.',
    '',
  ].join('\n'),
  '.github/copilot-instructions.md': [
    '# AUB GitHub Agent Instructions',
    '',
    'When an issue references AUB, treat `.ui.json` as the source of truth.',
    '',
    'Required workflow:',
    '',
    '1. Read the target route, source files, Blueprint/template path, component reuse rules, preview URL, and acceptance criteria.',
    '2. Prefer AUB MCP tools when available: `get_aub_session`, `get_blueprint`, `resolve_component`, `validate_blueprint`, and `submit_report`.',
    '3. Reuse mapped production components instead of creating lookalikes.',
    '4. Do not auto-approve `.aub/component-candidates.json`; users must review candidates.',
    '5. Report evidence for each acceptance item in an implementation report or PR body.',
    '',
  ].join('\n'),
};

function initFileEntries(args) {
  const entries = [
    ['.aub/ci.json', INIT_FILES['.aub/ci.json']],
  ];
  if (!args.ciOnly) {
    entries.push(['.aub/README.md', INIT_FILES['.aub/README.md']]);
    entries.push(['.aubignore', INIT_FILES['.aubignore']]);
    entries.push(['AGENTS.md', INIT_FILES['AGENTS.md']]);
  }
  if (args.github) {
    entries.push(['.github/workflows/aub-contracts.yml', INIT_FILES['.github/workflows/aub-contracts.yml']]);
    if (!args.ciOnly) {
      entries.push(
        ['.github/ISSUE_TEMPLATE/aub-ui-change.yml', INIT_FILES['.github/ISSUE_TEMPLATE/aub-ui-change.yml']],
        ['.github/ISSUE_TEMPLATE/aub-scan-route.yml', INIT_FILES['.github/ISSUE_TEMPLATE/aub-scan-route.yml']],
        ['.github/copilot-instructions.md', INIT_FILES['.github/copilot-instructions.md']]
      );
    }
  }
  return entries;
}

async function writeInitFile(workspace, relativePath, content, force) {
  const path = resolve(workspace, relativePath);
  if (!isInside(workspace, path)) {
    throw new Error(`Init path must stay inside workspace: ${relativePath}`);
  }
  const exists = existsSync(path);
  if (exists && !force) {
    return { path: relativePath, status: 'exists' };
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  return { path: relativePath, status: exists ? 'overwritten' : 'created' };
}

async function initWorkspace(args) {
  const workspace = resolve(args.workspace);
  const workspaceInfo = await stat(workspace).catch(() => null);
  if (!workspaceInfo?.isDirectory()) {
    throw new Error(`Workspace is not a directory: ${workspace}`);
  }
  const results = [];
  for (const [relativePath, content] of initFileEntries(args)) {
    results.push(await writeInitFile(workspace, relativePath, content, args.force));
  }
  const blocked = results.filter((result) => result.status === 'exists');
  if (blocked.length > 0) {
    console.error('AUB init did not overwrite existing files:');
    for (const result of blocked) console.error(`  exists       ${result.path}`);
    console.error('');
    console.error('Run again with --force to overwrite these files.');
    process.exitCode = 1;
    return;
  }
  console.error('AUB workspace initialized');
  console.error(`Workspace: ${workspace}`);
  for (const result of results) {
    console.error(`  ${result.status.padEnd(11)} ${result.path}`);
  }
  console.error('');
  console.error('Next steps:');
  console.error('  1. npx aub-workspace');
  console.error('  2. Scan project');
  console.error('  3. Generate template');
  console.error('  4. Copy agent instruction');
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

  if (args.command === 'init') {
    await initWorkspace(args);
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
