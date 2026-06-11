import test from 'node:test';
import assert from 'node:assert/strict';
import { findRepoRoot } from '../dist/repo.js';
import { loadValidators } from '../dist/schema.js';
import { createImplementationReportTemplate } from '../dist/aub.js';
import { run as listBlueprints } from '../dist/tools/list-blueprints.js';
import { run as getBlueprint } from '../dist/tools/get-blueprint.js';
import { run as validateBlueprint } from '../dist/tools/validate-blueprint.js';
import { run as scaffoldBlueprint } from '../dist/tools/scaffold-blueprint.js';
import { run as exportPrompt } from '../dist/tools/export-prompt.js';
import { run as submitReport } from '../dist/tools/submit-report.js';
import { run as listProjects } from '../dist/tools/list-projects.js';
import { run as getProject } from '../dist/tools/get-project.js';
import { run as validateProject } from '../dist/tools/validate-project.js';

const SCREEN_ID = 'dashboard.overview';
const ctx = { root: findRepoRoot(), validators: await loadValidators() };

function passingReport(blueprint) {
  const report = createImplementationReportTemplate(blueprint);
  report.implementation = { framework: 'react', route: '/dashboard', files: ['src/Dashboard.tsx'] };
  report.node_mappings = report.node_mappings.map((mapping) => ({
    ...mapping,
    status: 'mapped',
    file: 'src/Dashboard.tsx',
  }));
  report.acceptance_results = report.acceptance_results.map((result) => ({
    ...result,
    status: 'pass',
    evidence: [{ type: 'command', reference: 'pnpm test' }],
  }));
  report.unresolved = [];
  return report;
}

test('list_blueprints finds the canonical dashboard example', async () => {
  const result = await listBlueprints(ctx);
  assert.ok(result.count >= 1);
  const ids = result.blueprints.map((entry) => entry.screenId);
  assert.ok(ids.includes(SCREEN_ID), `expected ${SCREEN_ID} in ${ids.join(', ')}`);
});

test('get_blueprint resolves by screen id and by file path', async () => {
  const byId = await getBlueprint(ctx, { ref: SCREEN_ID });
  assert.equal(byId.blueprint.screen.id, SCREEN_ID);

  const byPath = await getBlueprint(ctx, { ref: 'examples/dashboard.ui.json' });
  assert.equal(byPath.blueprint.screen.id, SCREEN_ID);
});

test('get_blueprint returns markdown and yaml formats', async () => {
  const md = await getBlueprint(ctx, { ref: SCREEN_ID, format: 'markdown' });
  assert.equal(md.format, 'markdown');
  assert.match(md.content, /^#\s/);

  const yamlOut = await getBlueprint(ctx, { ref: SCREEN_ID, format: 'yaml' });
  assert.equal(yamlOut.format, 'yaml');
  assert.match(yamlOut.content, /screen:/);
});

test('validate_blueprint passes on the canonical example', async () => {
  const result = await validateBlueprint(ctx, { ref: 'examples/dashboard.ui.json' });
  assert.equal(result.valid, true);
  assert.equal(result.schemaErrors.length, 0);
  assert.equal(result.semanticErrors.length, 0);
});

test('validate_blueprint reports schema errors for a malformed blueprint', async () => {
  const result = await validateBlueprint(ctx, { blueprint: { version: '0.3.0' } });
  assert.equal(result.valid, false);
  assert.ok(result.schemaErrors.length > 0);
});

test('validate_blueprint requires a ref or an inline blueprint', async () => {
  await assert.rejects(() => validateBlueprint(ctx, {}), /ref.*blueprint/i);
});

test('validate_blueprint resolves extension types via an explicit registry', async () => {
  const result = await validateBlueprint(ctx, {
    ref: 'examples/extensions/analytics-insights.ui.json',
    registry: 'examples/extensions/aub.registry.json',
  });
  assert.equal(result.valid, true, JSON.stringify(result.semanticErrors));
  assert.ok(result.extensionRegistry?.endsWith('aub.registry.json'));
});

test('validate_blueprint reports unknown extension types without a registry', async () => {
  const blueprint = (
    await getBlueprint(ctx, { ref: 'examples/extensions/analytics-insights.ui.json' })
  ).blueprint;
  const result = await validateBlueprint(ctx, { blueprint });
  assert.equal(result.valid, false);
  assert.ok(
    result.semanticErrors.some((message) => message.includes('unknown component type')),
    JSON.stringify(result.semanticErrors)
  );
});

test('scaffold_blueprint fills empty spec sections and the result validates', async () => {
  const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
  const stripped = { ...blueprint, interactions: [], responsive: [], acceptance: [] };
  const result = await scaffoldBlueprint(ctx, { blueprint: stripped });
  assert.ok(result.summary.interactions > 0);
  assert.ok(result.summary.acceptance >= 5);
  const validated = await validateBlueprint(ctx, { blueprint: result.blueprint });
  assert.equal(validated.valid, true, JSON.stringify(validated.semanticErrors));
});

test('scaffold_blueprint honors the sections argument', async () => {
  const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
  const stripped = { ...blueprint, interactions: [], responsive: [], acceptance: [] };
  const result = await scaffoldBlueprint(ctx, { blueprint: stripped, sections: ['acceptance'] });
  assert.equal(result.summary.interactions, 0);
  assert.equal(result.summary.responsive, 0);
  assert.ok(result.summary.acceptance >= 5);
});

test('scaffold_blueprint requires a ref or an inline blueprint', async () => {
  await assert.rejects(() => scaffoldBlueprint(ctx, {}), /ref.*blueprint/i);
});

test('export_prompt embeds blueprint context for a valid adapter and task', async () => {
  const result = await exportPrompt(ctx, { ref: SCREEN_ID, adapter: 'codex', task: 'implement' });
  assert.equal(result.adapter, 'codex');
  assert.equal(result.task, 'implement');
  assert.match(result.prompt, /<aub_blueprint_context>/);
});

test('export_prompt rejects an unknown adapter', async () => {
  await assert.rejects(
    () => exportPrompt(ctx, { ref: SCREEN_ID, adapter: 'nope' }),
    /Unknown adapter/
  );
});

test('submit_report rejects the empty template', async () => {
  const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
  const template = createImplementationReportTemplate(blueprint);
  const result = await submitReport(ctx, { ref: SCREEN_ID, report: template, persist: false });
  assert.equal(result.accepted, false);
  assert.ok(result.errors.length > 0);
  assert.equal(result.savedPath, undefined);
});

test('submit_report accepts a fully mapped, passing report', async () => {
  const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
  const report = passingReport(blueprint);
  const result = await submitReport(ctx, { ref: SCREEN_ID, report, persist: false });
  assert.equal(result.schemaErrors.length, 0);
  assert.equal(result.accepted, true, `errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.summary.acceptance_passed, result.summary.acceptance_total);
});

const PROJECT_REF = 'examples/project/app.aub.project.json';

test('list_projects finds the acme-app example project', async () => {
  const result = await listProjects(ctx);
  assert.ok(result.count >= 1);
  const ids = result.projects.map((entry) => entry.id);
  assert.ok(ids.includes('acme-app'), `expected acme-app in ${ids.join(', ')}`);
});

test('validate_project passes on the canonical example project', async () => {
  const result = await validateProject(ctx, { ref: PROJECT_REF });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.schemaErrors.length, 0);
  assert.equal(result.semanticErrors.length, 0);
  assert.equal(result.screens.length, 2);
  assert.ok(result.screens.every((screen) => screen.valid));
});

test('validate_project resolves by project id', async () => {
  const result = await validateProject(ctx, { ref: 'acme-app' });
  assert.equal(result.valid, true, JSON.stringify(result));
});

test('get_project with inlineScreens returns full member blueprints', async () => {
  const result = await getProject(ctx, { ref: PROJECT_REF, inlineScreens: true });
  assert.equal(result.screens.length, 2);
  for (const screen of result.screens) {
    assert.ok(screen.blueprint, `expected blueprint for ${screen.id}`);
    assert.ok(screen.mergedDesignSystem);
  }
});

test('get_project without inlineScreens returns refs only', async () => {
  const result = await getProject(ctx, { ref: PROJECT_REF });
  assert.equal(result.screens.length, 2);
  assert.ok(result.screens.every((screen) => screen.blueprint === undefined));
  assert.ok(result.screens.every((screen) => screen.loaded === true));
});

test('get_project requires a ref', async () => {
  await assert.rejects(() => getProject(ctx, {}), /ref/i);
});
