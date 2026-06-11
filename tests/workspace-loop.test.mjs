import { cp, mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { scanProjectUi, generateTemplateFromSource } from '../scripts/workspace-loop.lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = JSON.parse(await readFile(resolve(ROOT, 'schema/ui-blueprint.schema.json'), 'utf8'));

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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
