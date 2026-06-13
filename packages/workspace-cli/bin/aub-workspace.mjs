#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
    workspaceSet: false,
  };
  if (['start', 'init', 'demo'].includes(argv[0])) {
    args.command = argv[0];
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
      args.workspaceSet = true;
    } else if (value === '--host') {
      args.host = argv[++index];
    } else if (value === '--mcp-port') {
      args.mcpPort = Number(argv[++index]);
    } else if (value === '--editor-port') {
      args.editorPort = Number(argv[++index]);
    } else if (!value.startsWith('-') && !args.workspaceSet) {
      args.workspace = value;
      args.workspaceSet = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (args.command === 'demo' && !args.workspaceSet) {
    args.workspace = join(process.cwd(), 'aub-safety-demo');
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  aub-workspace [options]',
    '  aub-workspace init [options]',
    '  aub-workspace demo [options]',
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
  if (existsSync(join(repoFallbackRoot, 'schema', 'ui-blueprint.schema.json'))) return repoFallbackRoot;
  if (existsSync(join(vendorRoot, 'schema', 'ui-blueprint.schema.json'))) return vendorRoot;
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
    'permissions:',
    '  contents: read',
    '  pull-requests: write',
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
    '          comment-pr: "true"',
    '          github-token: ${{ github.token }}',
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

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function demoSourceFiles() {
  return [
    ['package.json', json({
      name: 'aub-safety-demo',
      private: true,
      version: '0.1.0',
      scripts: {
        dev: 'next dev',
      },
      dependencies: {
        '@angular/core': '^18.0.0',
        next: '^15.0.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        '@storybook/react': '^8.0.0',
      },
    })],
    ['app/risk/page.tsx', [
      "import { ExposureTable } from '../../components/ExposureTable';",
      "import { RiskFilterForm } from '../../components/RiskFilterForm';",
      "import { RiskSummaryCard } from '../../components/RiskSummaryCard';",
      '',
      'const exposures = [',
      "  { id: 'demo-001', name: 'North ledger exposure', owner: 'Ops', status: 'review' },",
      "  { id: 'demo-002', name: 'Partner settlement drift', owner: 'Finance', status: 'open' },",
      '];',
      '',
      'export default function RiskPage() {',
      '  return (',
      '    <main className="risk-page">',
      '      <header className="risk-hero">',
      '        <nav aria-label="Risk workspace">',
      '          <a href="/risk">Overview</a>',
      '          <a href="/risk/review">Review queue</a>',
      '        </nav>',
      '        <section>',
      '          <h1>Risk dashboard</h1>',
      '          <p>Review synthetic operational risk signals before approval.</p>',
      '          <button type="button">Assign reviewer</button>',
      '        </section>',
      '      </header>',
      '      <section className="risk-summary-grid">',
      '        <RiskSummaryCard title="Open exposure" value="$1.2M" trend="up" />',
      '        <RiskSummaryCard title="Pending reviews" value="18" trend="flat" />',
      '        <RiskSummaryCard title="Resolved today" value="7" trend="down" />',
      '      </section>',
      '      <section className="risk-workbench">',
      '        <RiskFilterForm />',
      '        <ExposureTable rows={exposures} />',
      '      </section>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n')],
    ['components/RiskSummaryCard.tsx', [
      'interface RiskSummaryCardProps {',
      '  title: string;',
      '  value: string;',
      "  trend: 'up' | 'flat' | 'down';",
      '}',
      '',
      'export function RiskSummaryCard({ title, value, trend }: RiskSummaryCardProps) {',
      '  return (',
      '    <article className={`risk-summary-card ${trend}`}>',
      '      <span>{title}</span>',
      '      <strong>{value}</strong>',
      '    </article>',
      '  );',
      '}',
      '',
    ].join('\n')],
    ['components/ExposureTable.tsx', [
      'interface ExposureRow {',
      '  id: string;',
      '  name: string;',
      '  owner: string;',
      '  status: string;',
      '}',
      '',
      'export function ExposureTable({ rows }: { rows: ExposureRow[] }) {',
      '  return (',
      '    <table className="exposure-table">',
      '      <thead>',
      '        <tr><th>ID</th><th>Name</th><th>Owner</th><th>Status</th></tr>',
      '      </thead>',
      '      <tbody>',
      '        {rows.map((row) => (',
      '          <tr key={row.id}><td>{row.id}</td><td>{row.name}</td><td>{row.owner}</td><td>{row.status}</td></tr>',
      '        ))}',
      '      </tbody>',
      '    </table>',
      '  );',
      '}',
      '',
    ].join('\n')],
    ['components/RiskFilterForm.tsx', [
      'export function RiskFilterForm() {',
      '  return (',
      '    <form className="risk-filter-form">',
      '      <label htmlFor="risk-owner">Owner</label>',
      '      <input id="risk-owner" name="owner" placeholder="Ops" />',
      '      <label htmlFor="risk-status">Status</label>',
      '      <select id="risk-status" name="status">',
      '        <option>Open</option>',
      '        <option>Review</option>',
      '      </select>',
      '      <button type="submit">Apply filters</button>',
      '    </form>',
      '  );',
      '}',
      '',
    ].join('\n')],
    ['components/RiskSummaryCard.stories.tsx', [
      "import { RiskSummaryCard } from './RiskSummaryCard';",
      '',
      "export default { title: 'Risk/RiskSummaryCard', component: RiskSummaryCard };",
      '',
      "export const OpenExposure = { args: { title: 'Open exposure', value: '$1.2M', trend: 'up' } };",
      '',
    ].join('\n')],
    ['.storybook/main.ts', [
      "export default { stories: ['../components/**/*.stories.@(tsx|mdx)'] };",
      '',
    ].join('\n')],
    ['src/app/app-route-paths.const.ts', [
      'export const appRoutePaths = {',
      "  operations: 'operations',",
      "  dashboard: 'dashboard',",
      '};',
      '',
    ].join('\n')],
    ['src/app/operations/operations-routing.module.ts', [
      "import { OperationsDashboardComponent } from './operations-dashboard.component';",
      "import { appRoutePaths } from '../app-route-paths.const';",
      '',
      'export const routes = [',
      '  { path: appRoutePaths.operations + "/" + appRoutePaths.dashboard, component: OperationsDashboardComponent },',
      "  { path: '**', redirectTo: appRoutePaths.operations + '/' + appRoutePaths.dashboard },",
      '];',
      '',
    ].join('\n')],
    ['src/app/operations/operations-dashboard.component.ts', [
      'import { Component } from "@angular/core";',
      '',
      '@Component({',
      "  selector: 'app-operations-dashboard',",
      "  templateUrl: './operations-dashboard.component.html',",
      "  styleUrls: ['./operations-dashboard.component.scss'],",
      '})',
      'export class OperationsDashboardComponent {}',
      '',
    ].join('\n')],
    ['src/app/operations/operations-dashboard.component.html', [
      '<main class="operations-dashboard">',
      '  <header><h1>Operations dashboard</h1><button type="button">Export</button></header>',
      '  <section>',
      '    <app-domain-card title="SLA health" value="98%" />',
      '    <app-domain-card title="Queue depth" value="42" />',
      '  </section>',
      '  <form><label>Search</label><input name="query" /></form>',
      '  <app-operations-table [rows]="rows"></app-operations-table>',
      '</main>',
      '',
    ].join('\n')],
    ['src/app/shared/domain-card.component.ts', [
      'import { Component, Input } from "@angular/core";',
      '',
      '@Component({ selector: "app-domain-card", template: "<article><span>{{ title }}</span><strong>{{ value }}</strong></article>" })',
      'export class DomainCardComponent {',
      '  @Input() title = "";',
      '  @Input() value = "";',
      '}',
      '',
    ].join('\n')],
    ['src/app/shared/operations-table.component.ts', [
      'import { Component, Input } from "@angular/core";',
      '',
      '@Component({ selector: "app-operations-table", template: "<table><tr *ngFor=\\"let row of rows\\"><td>{{ row.name }}</td></tr></table>" })',
      'export class OperationsTableComponent {',
      '  @Input() rows: Array<{ name: string }> = [];',
      '}',
      '',
    ].join('\n')],
  ];
}

async function createDemoReports({ workspace, blueprint, implementation }) {
  const runtimeRoot = findAubRuntimeRoot();
  const reportModule = await import(pathToFileURL(join(runtimeRoot, 'scripts', 'implementation-report.lib.mjs')).href);
  const failReport = reportModule.createImplementationReportTemplate(blueprint);
  failReport.implementation = {
    framework: 'next',
    route: '/risk',
    files: ['app/risk/page.tsx'],
  };
  failReport.unresolved = [
    'Component candidates still need review before the agent can claim reuse.',
    'No viewport screenshot or overflow evidence was captured.',
  ];
  failReport.safety_score = reportModule.scoreImplementationSafety(blueprint, failReport);

  const passReport = {
    ...reportModule.createImplementationReportTemplate(blueprint),
    implementation,
  };
  passReport.node_mappings = blueprint.nodes.map((node) => ({
    node_id: node.id,
    status: 'mapped',
    component: node.type,
    file: node.source?.file ?? 'app/risk/page.tsx',
    selector: node.source?.selector ?? `[data-aub-node="${node.id}"]`,
    notes: 'Synthetic demo mapping showing the expected evidence shape.',
  }));
  const evidence = [
    { type: 'screenshot', reference: '.aub/evidence/risk-dashboard-desktop.png', viewport: 'desktop', bytes: 128400 },
    { type: 'screenshot', reference: '.aub/evidence/risk-dashboard-tablet.png', viewport: 'tablet', bytes: 98200 },
    { type: 'screenshot', reference: '.aub/evidence/risk-dashboard-mobile.png', viewport: 'mobile', bytes: 76400 },
    { type: 'overflow', reference: 'desktop viewport horizontal overflow check', viewport: 'desktop', pass: true },
    { type: 'overflow', reference: 'tablet viewport horizontal overflow check', viewport: 'tablet', pass: true },
    { type: 'overflow', reference: 'mobile viewport horizontal overflow check', viewport: 'mobile', pass: true },
    { type: 'dom_query', reference: 'main.risk-page exists once', selector: 'main.risk-page', expected: 1, actual: 1 },
    { type: 'component_reuse', reference: 'components/RiskSummaryCard.tsx import reused' },
    { type: 'code_diff', reference: 'app/risk/page.tsx' },
  ];
  passReport.acceptance_results = blueprint.acceptance.map((item, index) => ({
    acceptance_id: item.id,
    status: 'pass',
    evidence: index === 0 ? evidence : [evidence[index % evidence.length], evidence[(index + 3) % evidence.length]],
    notes: 'Synthetic demo pass report. Replace these references with captured evidence in a real PR.',
  }));
  passReport.unresolved = [];
  passReport.safety_score = reportModule.scoreImplementationSafety(blueprint, passReport);

  await writeFile(join(workspace, '.aub', 'reports', 'risk-dashboard.fail.implementation-report.json'), json(failReport), 'utf8');
  await writeFile(join(workspace, '.aub', 'reports', 'risk-dashboard.pass.implementation-report.json'), json(passReport), 'utf8');
  return { failReport, passReport };
}

async function createDemoPrComments(workspace) {
  const runtimeRoot = findAubRuntimeRoot();
  const [{ verifyWorkspace }, { formatPrSafetyComment }] = await Promise.all([
    import(pathToFileURL(join(runtimeRoot, 'scripts', 'ci-verify.lib.mjs')).href),
    import(pathToFileURL(join(runtimeRoot, 'scripts', 'pr-safety-comment.lib.mjs')).href),
  ]);
  const failResult = await verifyWorkspace({
    workspace,
    configPath: '.aub/ci.json',
    requireReports: true,
    requireEvidence: true,
    minSafetyScore: 70,
  });
  const passResult = await verifyWorkspace({
    workspace,
    configPath: '.aub/ci.pass.json',
    requireReports: true,
    requireEvidence: true,
    minSafetyScore: 70,
  });
  await writeFile(join(workspace, '.aub', 'pr-comment.fail.md'), formatPrSafetyComment(failResult), 'utf8');
  await writeFile(join(workspace, '.aub', 'pr-comment.pass.md'), formatPrSafetyComment(passResult), 'utf8');
  return { failResult, passResult };
}

async function createDemoWorkspace(args) {
  const workspace = resolve(args.workspace);
  const workspaceInfo = await stat(workspace).catch(() => null);
  if (workspaceInfo && !workspaceInfo.isDirectory()) {
    throw new Error(`Demo workspace path is not a directory: ${workspace}`);
  }
  await mkdir(workspace, { recursive: true });
  const existing = await readdir(workspace);
  if (existing.length > 0 && !args.force) {
    throw new Error(`Demo workspace is not empty: ${workspace}. Use --force or choose an empty --workspace path.`);
  }

  const files = [
    ...demoSourceFiles(),
    ['.aubignore', INIT_FILES['.aubignore']],
    ['AGENTS.md', INIT_FILES['AGENTS.md']],
    ['.aub/README.md', INIT_FILES['.aub/README.md']],
    ['.github/workflows/aub-contracts.yml', INIT_FILES['.github/workflows/aub-contracts.yml']],
  ];
  for (const [relativePath, content] of files) {
    await writeInitFile(workspace, relativePath, content, true);
  }
  await mkdir(join(workspace, '.aub', 'reports'), { recursive: true });
  await mkdir(join(workspace, 'screens'), { recursive: true });

  const runtimeRoot = findAubRuntimeRoot();
  const workspaceModule = await import(pathToFileURL(join(runtimeRoot, 'scripts', 'workspace-loop.lib.mjs')).href);
  await workspaceModule.scanProjectUi(workspace, { namespace: 'demo' });
  const generated = await workspaceModule.generateTemplateFromSource(workspace, {
    sourcePath: 'app/risk/page.tsx',
    name: 'Risk dashboard',
    route: '/risk',
    output: '.aub/templates/risk-dashboard.aub.template.json',
  });
  const blueprint = generated.template.blueprint;
  await writeFile(join(workspace, 'screens', 'risk-dashboard.ui.json'), json(blueprint), 'utf8');
  await createDemoReports({
    workspace,
    blueprint,
    implementation: {
      framework: 'next',
      route: '/risk',
      files: [
        'app/risk/page.tsx',
        'components/RiskSummaryCard.tsx',
        'components/ExposureTable.tsx',
        'components/RiskFilterForm.tsx',
      ],
    },
  });
  await writeFile(join(workspace, '.aub', 'ci.json'), json({
    $schema: 'https://henrylau1103.github.io/AUB/schema/aub-ci.schema.json',
    version: '1.0.0',
    discover: false,
    blueprints: ['screens/risk-dashboard.ui.json'],
    projects: [],
    reports: [{
      blueprint: 'screens/risk-dashboard.ui.json',
      report: '.aub/reports/risk-dashboard.fail.implementation-report.json',
    }],
    min_safety_score: 70,
  }), 'utf8');
  await writeFile(join(workspace, '.aub', 'ci.pass.json'), json({
    $schema: 'https://henrylau1103.github.io/AUB/schema/aub-ci.schema.json',
    version: '1.0.0',
    discover: false,
    blueprints: ['screens/risk-dashboard.ui.json'],
    projects: [],
    reports: [{
      blueprint: 'screens/risk-dashboard.ui.json',
      report: '.aub/reports/risk-dashboard.pass.implementation-report.json',
    }],
    min_safety_score: 70,
  }), 'utf8');
  await createDemoPrComments(workspace);
  await workspaceModule.updateAubSession(workspace, {
    activeBlueprint: 'screens/risk-dashboard.ui.json',
    activeProject: null,
    targetRoute: '/risk',
    preview: {
      devServerUrl: 'http://localhost:3000',
      route: '/risk',
      lastImplementationReport: '.aub/reports/risk-dashboard.fail.implementation-report.json',
    },
  });
  await writeFile(join(workspace, '.aub', 'demo-readme.md'), [
    '# AUB Safety Demo',
    '',
    'This synthetic workspace demonstrates the AUB workspace loop without using real customer or local project data.',
    '',
    'What was generated:',
    '',
    '- `app/risk/page.tsx`: source route for scanner extraction.',
    '- `.aub/templates/risk-dashboard.aub.template.json`: candidate workspace template generated from source.',
    '- `screens/risk-dashboard.ui.json`: generated Blueprint used as the review contract.',
    '- `.aub/reports/risk-dashboard.fail.implementation-report.json`: low-evidence report expected to fail the gate.',
    '- `.aub/reports/risk-dashboard.pass.implementation-report.json`: evidence-shaped report expected to pass the gate.',
    '- `.aub/pr-comment.fail.md`: PR comment showing the blocked low-evidence path.',
    '- `.aub/pr-comment.pass.md`: PR comment showing the audit-ready evidence path.',
    '- `.aub/scan-report.json`: scanner trust report.',
    '',
    'Try the gate from the AUB repo root:',
    '',
    '```bash',
    `pnpm ci:verify -- --workspace ${workspace} --config .aub/ci.json --require-reports --require-evidence --min-safety-score 70`,
    `pnpm ci:verify -- --workspace ${workspace} --config .aub/ci.pass.json --require-reports --require-evidence --min-safety-score 70`,
    '```',
    '',
  ].join('\n'), 'utf8');

  console.error('AUB safety demo workspace created');
  console.error(`Workspace: ${workspace}`);
  console.error('');
  console.error('Generated proof files:');
  console.error('  .aub/scan-report.json');
  console.error('  .aub/templates/risk-dashboard.aub.template.json');
  console.error('  screens/risk-dashboard.ui.json');
  console.error('  .aub/reports/risk-dashboard.fail.implementation-report.json');
  console.error('  .aub/reports/risk-dashboard.pass.implementation-report.json');
  console.error('  .aub/pr-comment.fail.md');
  console.error('  .aub/pr-comment.pass.md');
  console.error('');
  console.error('Next steps:');
  console.error(`  1. npx aub-workspace --workspace ${workspace}`);
  console.error(`  2. pnpm ci:verify -- --workspace ${workspace} --config .aub/ci.json --require-reports --require-evidence --min-safety-score 70`);
  console.error(`  3. pnpm ci:verify -- --workspace ${workspace} --config .aub/ci.pass.json --require-reports --require-evidence --min-safety-score 70`);
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

  if (args.command === 'demo') {
    await createDemoWorkspace(args);
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
  const rpcToken = randomBytes(32).toString('base64url');
  const mcp = spawn(process.execPath, [
    mcpEntry,
    '--workspace',
    workspace,
    '--host',
    args.host,
    '--port',
    String(mcpPort),
    '--rpc-token',
    rpcToken,
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
  editorUrl.searchParams.set('token', rpcToken);

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
