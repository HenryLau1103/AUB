import { cp, mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { scanProjectUi, generateTemplateFromSource } from '../scripts/workspace-loop.lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = JSON.parse(await readFile(resolve(ROOT, 'schema/ui-blueprint.schema.json'), 'utf8'));
const execFileAsync = promisify(execFile);

async function copyFixture(name) {
  const source = resolve(ROOT, 'examples', 'workspace-fixtures', name);
  const target = await mkdtemp(join(tmpdir(), `aub-${name}-`));
  await cp(source, target, { recursive: true });
  return target;
}

function validateBlueprint(blueprint) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(SCHEMA);
  assert.equal(validate(blueprint), true, JSON.stringify(validate.errors));
}

test('WL1: Next scanner generates a source-driven candidate template', async () => {
  const root = await copyFixture('next-dashboard');
  try {
    const scan = await scanProjectUi(root);
    assert.ok(scan.frameworks.includes('next'));
    assert.equal(scan.storybook.detected, true);
    assert.equal(scan.storybook.storyCount, 1);
    assert.ok(scan.scanAudit.filesScanned > 0);
    assert.equal(scan.scanReportPath, '.aub/scan-report.json');
    assert.equal(scan.scanReport.format, 'aub-scan-report');
    assert.equal(scan.scanReport.summary.routes, scan.routes.length);
    assert.ok(scan.scanReport.summary.trustScore >= 60);
    assert.equal(scan.scanReport.trust.breakdown.routeResolved, true);
    assert.ok(scan.scanReport.trust.breakdown.filesScanned > 0);
    const persistedScanReport = JSON.parse(await readFile(join(root, '.aub', 'scan-report.json'), 'utf8'));
    assert.equal(persistedScanReport.summary.componentCandidates, scan.components.length);
    assert.equal(persistedScanReport.trust.breakdown.storybookDetected, true);
    assert.ok(scan.scanAudit.directoriesSkipped > 0);
    assert.equal(scan.components.some((component) => component.componentName === 'HiddenWidget'), false);
    assert.ok(scan.routes.some((route) => route.route === '/risk'));
    assert.ok(scan.components.some((component) => component.componentName === 'RiskSummaryCard'));
    assert.ok(scan.components.some((component) =>
      component.componentName === 'RiskSummaryCard'
      && component.storybookStories?.some((story) => story.path === 'components/RiskSummaryCard.stories.tsx')
    ));
    assert.ok(scan.components.some((component) => component.sourceUsage?.some((usage) => usage.file === 'app/risk/page.tsx')));

    const result = await generateTemplateFromSource(root, {
      sourcePath: 'app/risk/page.tsx',
      name: 'Risk dashboard',
      route: '/risk',
    });

    validateBlueprint(result.template.blueprint);
    assert.equal(result.template.status, 'candidate');
    assert.ok(result.template.blueprint.nodes.length >= 8);
    assert.ok(result.template.blueprint.nodes.some((node) => node.type === 'data_table'));
    assert.ok(result.template.blueprint.nodes.some((node) => node.type === 'form'));
    assert.ok(result.template.missingMappings.some((mapping) => mapping.componentName === 'RiskSummaryCard'));
    assert.ok(result.template.sourceReferences.length >= 6);
    assert.ok(result.template.trustBreakdown.sourceReferenceCoverage >= 90);
    assert.ok(result.template.trustBreakdown.nodeCount >= 8);
    assert.ok(result.template.trustBreakdown.reasons.some((reason) => reason.includes('non-placeholder')));
    assert.ok(result.template.blueprint.nodes.filter((node) => node.id !== 'root').every((node) => node.source?.file));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('WL2: Angular scanner resolves templateUrl routes and selector candidates', async () => {
  const root = await copyFixture('angular-enterprise');
  try {
    const scan = await scanProjectUi(root, { namespace: 'portal' });
    assert.ok(scan.frameworks.includes('angular'));
    assert.ok(scan.routes.some((route) => route.route === '/operations/dashboard' && route.path.endsWith('operations-dashboard.component.html')));
    assert.equal(scan.routes.some((route) => route.route.includes('*')), false);
    assert.ok(scan.components.some((component) => component.selector === 'app-domain-card'));
    assert.ok(scan.components.some((component) => component.selector === 'app-operations-table'));

    const result = await generateTemplateFromSource(root, {
      sourcePath: 'src/app/operations/operations-dashboard.component.html',
      name: 'Operations dashboard',
      framework: 'angular',
      route: '/operations/dashboard',
    });

    validateBlueprint(result.template.blueprint);
    assert.ok(result.template.blueprint.nodes.some((node) => node.type === 'data_table'));
    assert.ok(result.template.missingMappings.some((mapping) => mapping.suggestedType === 'portal:domain_card'));
    assert.ok(result.template.sourceReferences.some((reference) => reference.selector?.includes('app-domain-card')));
    assert.equal(result.template.trustBreakdown.routeResolved, true);
    assert.ok(result.template.trustBreakdown.unresolvedCustomComponents >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('WL3: scanner records aggregate source byte budget skips', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-scan-budget-'));
  try {
    await mkdir(join(root, 'components'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"name":"budget-demo","dependencies":{"next":"latest"}}\n', 'utf8');
    const base = 'export function BudgetWidget(){ return <section>Budget</section>; }\n';
    const filler = 'x'.repeat((512 * 1024) - base.length);
    for (let index = 0; index < 130; index += 1) {
      await writeFile(join(root, 'components', `BudgetWidget${index}.tsx`), `${base}${filler}`, 'utf8');
    }
    const scan = await scanProjectUi(root);
    assert.equal(scan.scanAudit.sourceByteLimitReached, true);
    assert.ok(scan.scanAudit.sourceFilesSkippedByBudget > 0);
    assert.ok(scan.scanReport.trust.breakdown.sourceByteLimitReached);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('WL4: workspace session updates are serialized across processes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-session-cross-process-'));
  try {
    const script = [
      "import { updateAubSession } from './scripts/workspace-loop.lib.mjs';",
      "await updateAubSession(process.argv[1], JSON.parse(process.argv[2]));",
    ].join('\n');
    await Promise.all([
      execFileAsync(process.execPath, ['--input-type=module', '-e', script, root, JSON.stringify({
        activeBlueprint: 'screens/settings.ui.json',
      })], { cwd: ROOT }),
      execFileAsync(process.execPath, ['--input-type=module', '-e', script, root, JSON.stringify({
        preview: { route: '/settings' },
      })], { cwd: ROOT }),
    ]);
    const stored = JSON.parse(await readFile(join(root, '.aub', 'session.json'), 'utf8'));
    assert.equal(stored.activeBlueprint, 'screens/settings.ui.json');
    assert.equal(stored.preview.route, '/settings');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('WL5: component candidate reviews are serialized across processes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-candidates-cross-process-'));
  try {
    await mkdir(join(root, '.aub'), { recursive: true });
    await writeFile(join(root, '.aub', 'component-candidates.json'), `${JSON.stringify({
      format: 'aub-component-candidates',
      format_version: '0.1.0',
      candidates: [
        {
          id: 'card-a',
          status: 'candidate',
          sourcePath: 'src/CardA.tsx',
          framework: 'react',
          componentName: 'CardA',
          suggestedType: 'app:card_a',
          suggestedCoreType: 'card',
          props: [],
          reviewHistory: [],
        },
        {
          id: 'nav-b',
          status: 'candidate',
          sourcePath: 'src/NavB.tsx',
          framework: 'react',
          componentName: 'NavB',
          suggestedType: 'app:nav_b',
          suggestedCoreType: 'nav_menu',
          props: [],
          reviewHistory: [],
        },
      ],
    }, null, 2)}\n`, 'utf8');
    const script = [
      "import { approveComponentCandidate } from './scripts/workspace-loop.lib.mjs';",
      "await approveComponentCandidate(process.argv[1], JSON.parse(process.argv[2]));",
    ].join('\n');
    await Promise.all([
      execFileAsync(process.execPath, ['--input-type=module', '-e', script, root, JSON.stringify({
        id: 'card-a',
        action: 'map_core',
        coreType: 'card',
      })], { cwd: ROOT }),
      execFileAsync(process.execPath, ['--input-type=module', '-e', script, root, JSON.stringify({
        id: 'nav-b',
        action: 'map_core',
        coreType: 'nav_menu',
      })], { cwd: ROOT }),
    ]);
    const stored = JSON.parse(await readFile(join(root, '.aub', 'component-candidates.json'), 'utf8'));
    const byId = new Map(stored.candidates.map((candidate) => [candidate.id, candidate]));
    assert.equal(byId.get('card-a').approvedAs, 'card');
    assert.equal(byId.get('nav-b').approvedAs, 'nav_menu');
    assert.equal(byId.get('card-a').reviewHistory.length, 1);
    assert.equal(byId.get('nav-b').reviewHistory.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
