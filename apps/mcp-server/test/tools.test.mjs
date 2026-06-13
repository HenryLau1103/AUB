import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import JSZip from 'jszip';
import { findRepoRoot } from '../dist/repo.js';
import { loadValidators } from '../dist/schema.js';
import { createImplementationReportTemplate } from '../dist/aub.js';
import { run as listBlueprints } from '../dist/tools/list-blueprints.js';
import { run as getBlueprint } from '../dist/tools/get-blueprint.js';
import { run as validateBlueprint } from '../dist/tools/validate-blueprint.js';
import { run as scaffoldBlueprint } from '../dist/tools/scaffold-blueprint.js';
import { run as importDesignBridge } from '../dist/tools/import-design-bridge.js';
import { run as writeBlueprint } from '../dist/tools/write-blueprint.js';
import { run as exportPrompt } from '../dist/tools/export-prompt.js';
import { run as exportHandoff } from '../dist/tools/export-handoff.js';
import { run as submitReport } from '../dist/tools/submit-report.js';
import { run as listProjects } from '../dist/tools/list-projects.js';
import { run as getProject } from '../dist/tools/get-project.js';
import { run as validateProject } from '../dist/tools/validate-project.js';
import { run as resolveComponent } from '../dist/tools/resolve-component.js';
import { run as diffBlueprints } from '../dist/tools/diff-blueprints.js';
import { run as migrateBlueprint } from '../dist/tools/migrate-blueprint.js';
import { run as lockBlueprint } from '../dist/tools/lock-blueprint.js';
import { run as getAubSession } from '../dist/tools/get-aub-session.js';
import { run as updateAubSession } from '../dist/tools/update-aub-session.js';
import { run as getWorkspaceStatus } from '../dist/tools/get-workspace-status.js';
import { run as scanProjectUi } from '../dist/tools/scan-project-ui.js';
import { run as generateTemplateFromSource } from '../dist/tools/generate-template-from-source.js';
import { run as approveComponentCandidate } from '../dist/tools/approve-component-candidate.js';
import { run as exportTemplateAuthoringPrompt } from '../dist/tools/export-template-authoring-prompt.js';
import { registeredToolNames } from '../dist/server.js';

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

test('get_blueprint and get_project reject refs outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-ref-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-ref-outside-'));
  try {
    await writeFile(
      join(outside, 'outside.ui.json'),
      await readFile(join(findRepoRoot(), 'examples', 'dashboard.ui.json'), 'utf8')
    );
    await writeFile(
      join(outside, 'outside.aub.project.json'),
      await readFile(join(findRepoRoot(), 'examples', 'project', 'app.aub.project.json'), 'utf8')
    );
    const outsideBlueprintRef = relative(root, join(outside, 'outside.ui.json'));
    await assert.rejects(() => getBlueprint({ ...ctx, root }, { ref: outsideBlueprintRef }));
    await assert.rejects(() => getBlueprint({ ...ctx, root }, { ref: join(outside, 'outside.ui.json') }));
    await assert.rejects(() => getProject({ ...ctx, root }, { ref: join(outside, 'outside.aub.project.json') }));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('get_blueprint and get_project accept absolute refs inside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-ref-inside-'));
  try {
    await mkdir(join(root, 'screens'), { recursive: true });
    const blueprintText = await readFile(join(findRepoRoot(), 'examples', 'dashboard.ui.json'), 'utf8');
    await writeFile(join(root, 'screens', 'dashboard.ui.json'), blueprintText, 'utf8');
    await writeFile(join(root, 'app.aub.project.json'), `${JSON.stringify({
      version: '0.1.0',
      id: 'demo-app',
      name: 'Demo App',
      entry_screen: SCREEN_ID,
      screens: [{ id: SCREEN_ID, path: 'screens/dashboard.ui.json' }],
      navigation: [],
    }, null, 2)}\n`, 'utf8');

    const byAbsBlueprint = await getBlueprint({ ...ctx, root }, { ref: join(root, 'screens', 'dashboard.ui.json') });
    assert.equal(byAbsBlueprint.blueprint.screen.id, SCREEN_ID);

    const byAbsProject = await getProject({ ...ctx, root }, { ref: join(root, 'app.aub.project.json'), inlineScreens: true });
    assert.equal(byAbsProject.screens.length, 1);
    assert.ok(byAbsProject.screens[0].blueprint);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('get_project and validate_project contain member screen paths inside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-project-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-project-outside-'));
  try {
    await writeFile(
      join(outside, 'outside.ui.json'),
      await readFile(join(findRepoRoot(), 'examples', 'dashboard.ui.json'), 'utf8'),
      'utf8'
    );
    await writeFile(join(root, 'escape.aub.project.json'), `${JSON.stringify({
      version: '0.1.0',
      id: 'escape-app',
      name: 'Escape App',
      entry_screen: SCREEN_ID,
      screens: [{ id: SCREEN_ID, path: join(outside, 'outside.ui.json') }],
      navigation: [],
    }, null, 2)}\n`, 'utf8');
    await writeFile(join(root, 'escape-parent.aub.project.json'), `${JSON.stringify({
      version: '0.1.0',
      id: 'escape-parent-app',
      name: 'Escape Parent App',
      entry_screen: SCREEN_ID,
      screens: [{ id: SCREEN_ID, path: '../outside.ui.json' }],
      navigation: [],
    }, null, 2)}\n`, 'utf8');

    const project = await getProject({ ...ctx, root }, { ref: 'escape.aub.project.json', inlineScreens: true });
    assert.equal(project.screens[0].loaded, false);
    assert.equal(project.screens[0].path, join(outside, 'outside.ui.json'));
    assert.ok(project.loadErrors.some((error) => /Screen path must be relative/.test(error)));

    const validation = await validateProject({ ...ctx, root }, { ref: 'escape.aub.project.json' });
    assert.equal(validation.valid, false);
    assert.ok(validation.schemaErrors.length > 0 || validation.loadErrors.length > 0);

    const parentValidation = await validateProject({ ...ctx, root }, { ref: 'escape-parent.aub.project.json' });
    assert.equal(parentValidation.valid, false);
    assert.ok(parentValidation.schemaErrors.length > 0 || parentValidation.loadErrors.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
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

test('validate_blueprint rejects registry paths outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-registry-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-registry-outside-'));
  try {
    await mkdir(join(root, 'screens'), { recursive: true });
    await writeFile(
      join(root, 'screens', 'dashboard.ui.json'),
      await readFile(join(findRepoRoot(), 'examples', 'dashboard.ui.json'), 'utf8'),
      'utf8'
    );
    await writeFile(join(outside, 'aub.registry.json'), '{"version":"0.1.0","components":[]}\n', 'utf8');
    const result = await validateBlueprint({ ...ctx, root }, {
      ref: 'screens/dashboard.ui.json',
      registry: join(outside, 'aub.registry.json'),
    });
    assert.equal(result.valid, false);
    assert.ok(result.semanticErrors.some((error) => /registry: Path must stay inside/.test(error)));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('validate_blueprint rejects registry filenames that only end with aub.registry.json', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-registry-suffix-'));
  try {
    await mkdir(join(root, 'screens'), { recursive: true });
    await writeFile(
      join(root, 'screens', 'dashboard.ui.json'),
      await readFile(join(findRepoRoot(), 'examples', 'dashboard.ui.json'), 'utf8'),
      'utf8'
    );
    await writeFile(join(root, 'evil-aub.registry.json'), '{"version":"0.1.0","components":[]}\n', 'utf8');
    const result = await validateBlueprint({ ...ctx, root }, {
      ref: 'screens/dashboard.ui.json',
      registry: 'evil-aub.registry.json',
    });
    assert.equal(result.valid, false);
    assert.ok(result.semanticErrors.some((error) => /Registry path must point to aub\.registry\.json/.test(error)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('validate_blueprint does not auto-discover a parent registry outside the workspace', async () => {
  const base = await mkdtemp(join(tmpdir(), 'aub-parent-registry-'));
  try {
    const root = join(base, 'workspace');
    await mkdir(join(root, 'screens'), { recursive: true });
    await writeFile(
      join(base, 'aub.registry.json'),
      await readFile(join(findRepoRoot(), 'examples', 'extensions', 'aub.registry.json'), 'utf8'),
      'utf8'
    );
    await writeFile(
      join(root, 'screens', 'analytics.ui.json'),
      await readFile(join(findRepoRoot(), 'examples', 'extensions', 'analytics-insights.ui.json'), 'utf8'),
      'utf8'
    );
    const result = await validateBlueprint({ ...ctx, root }, { ref: 'screens/analytics.ui.json' });
    assert.equal(result.valid, false);
    assert.ok(result.semanticErrors.some((error) => /unknown component type "acme:/.test(error)));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
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

test('resolve_component returns production mappings for an extension type', async () => {
  const result = await resolveComponent(ctx, {
    type: 'acme:insight_card',
    registry: 'examples/extensions/aub.registry.json',
    implementation: 'react',
  });
  assert.equal(result.source, 'extension');
  assert.equal(result.isContainer, true);
  assert.equal(result.selectedImplementation.export, 'InsightCard');
  assert.equal(result.selectedImplementation.props.title.from, 'content.title');
});

test('resolve_component returns metadata for a core type', async () => {
  const result = await resolveComponent(ctx, { type: 'button' });
  assert.equal(result.source, 'core');
  assert.equal(result.isContainer, false);
  assert.equal(result.selectedImplementation, null);
});

test('resolve_component rejects registries outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-registry-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-registry-outside-'));
  try {
    await writeFile(
      join(outside, 'aub.registry.json'),
      await readFile(join(findRepoRoot(), 'examples', 'extensions', 'aub.registry.json'), 'utf8')
    );
    await assert.rejects(
      () => resolveComponent({ ...ctx, root }, {
        type: 'acme:insight_card',
        registry: relative(root, join(outside, 'aub.registry.json')),
      }),
      /inside the workspace root|relative to the workspace root/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('diff_blueprints reports changes between Blueprint revisions', async () => {
  const result = await diffBlueprints(ctx, {
    before: 'examples/dashboard.ui.json',
    after: 'examples/project/dashboard.ui.json',
  });
  assert.ok(result.diff.summary.nodes_changed >= 0);
  assert.equal(result.diff.before.screen_id, SCREEN_ID);
});

test('migrate_blueprint migrates an inline v0.1 Blueprint', async () => {
  const current = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
  const legacy = { ...current, version: '0.1.0', design_system: undefined };
  const result = await migrateBlueprint(ctx, { blueprint: legacy });
  assert.equal(result.fromVersion, '0.1.0');
  assert.equal(result.toVersion, '0.3.0');
  assert.ok(result.blueprint.design_system);
});

test('lock_blueprint returns deterministic structural hashes', async () => {
  const result = await lockBlueprint(ctx, { ref: SCREEN_ID });
  assert.match(result.lock.hashes.blueprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.lock.counts.nodes, 24);
  const second = await lockBlueprint(ctx, { ref: SCREEN_ID });
  assert.equal(second.lock.hashes.blueprint, result.lock.hashes.blueprint);
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

test('import_design_bridge preserves source mapping and returns a valid Blueprint', async () => {
  const result = await importDesignBridge(ctx, {
    path: 'examples/design-bridge/figma-hero.aub.bridge.json',
  });
  assert.equal(result.designSource.kind, 'figma');
  assert.equal(result.blueprint.provenance.source_kind, 'figma');
  assert.equal(result.sourceMap.primary_cta.component_key, 'button/primary');
});

test('write_blueprint validates, writes atomically, and rejects paths outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-write-'));
  try {
    const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
    const localCtx = { ...ctx, root };
    const result = await writeBlueprint(localCtx, {
      path: 'specs/dashboard.ui.json',
      blueprint,
    });
    assert.equal(result.savedPath, 'specs/dashboard.ui.json');
    assert.equal(JSON.parse(await readFile(join(root, result.savedPath), 'utf8')).screen.id, SCREEN_ID);
    await assert.rejects(
      () => writeBlueprint(localCtx, { path: '../outside.ui.json', blueprint }),
      /inside the workspace root/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('write_blueprint rejects symlinked output parents outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-write-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-mcp-write-outside-'));
  try {
    await symlink(outside, join(root, 'linkdir'));
    const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
    await assert.rejects(
      () => writeBlueprint({ ...ctx, root }, {
        path: 'linkdir/escaped.ui.json',
        blueprint,
        overwrite: true,
      }),
      /inside the workspace root/
    );
    await assert.rejects(() => readFile(join(outside, 'escaped.ui.json'), 'utf8'), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('write_blueprint concurrent writes do not collide on temp paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-write-race-'));
  try {
    const first = structuredClone((await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint);
    const second = structuredClone(first);
    first.screen.name = 'Concurrent First';
    second.screen.name = 'Concurrent Second';
    const localCtx = { ...ctx, root };
    await Promise.all([
      writeBlueprint(localCtx, { path: 'specs/race.ui.json', blueprint: first, overwrite: true }),
      writeBlueprint(localCtx, { path: 'specs/race.ui.json', blueprint: second, overwrite: true }),
    ]);
    const stored = JSON.parse(await readFile(join(root, 'specs', 'race.ui.json'), 'utf8'));
    assert.ok(['Concurrent First', 'Concurrent Second'].includes(stored.screen.name));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('write_blueprint concurrent overwrite:false writes allow exactly one creator', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-write-create-race-'));
  try {
    const first = structuredClone((await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint);
    const second = structuredClone(first);
    first.screen.name = 'Create Race First';
    second.screen.name = 'Create Race Second';
    const localCtx = { ...ctx, root };
    const results = await Promise.allSettled([
      writeBlueprint(localCtx, { path: 'specs/race.ui.json', blueprint: first, overwrite: false }),
      writeBlueprint(localCtx, { path: 'specs/race.ui.json', blueprint: second, overwrite: false }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const stored = JSON.parse(await readFile(join(root, 'specs', 'race.ui.json'), 'utf8'));
    assert.ok(['Create Race First', 'Create Race Second'].includes(stored.screen.name));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('export_handoff writes a verifiable package inside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-handoff-'));
  try {
    const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
    await writeFile(join(root, 'dashboard.ui.json'), `${JSON.stringify(blueprint, null, 2)}\n`);
    const result = await exportHandoff({ ...ctx, root }, { ref: 'dashboard.ui.json' });
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    const zip = await JSZip.loadAsync(await readFile(join(root, result.savedPath)));
    assert.ok(zip.file('AGENT-README.md'));
    assert.ok(zip.file(`${SCREEN_ID}.ui.json`));
    assert.ok(zip.file('implementation-report.schema.json'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('export_handoff concurrent overwrite:false writes allow exactly one creator', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-handoff-race-'));
  try {
    const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
    await writeFile(join(root, 'dashboard.ui.json'), `${JSON.stringify(blueprint, null, 2)}\n`);
    const localCtx = { ...ctx, root };
    const results = await Promise.allSettled([
      exportHandoff(localCtx, { ref: 'dashboard.ui.json', output: '.aub/handoffs/race.aub.zip' }),
      exportHandoff(localCtx, { ref: 'dashboard.ui.json', output: '.aub/handoffs/race.aub.zip' }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const zip = await JSZip.loadAsync(await readFile(join(root, '.aub', 'handoffs', 'race.aub.zip')));
    assert.ok(zip.file('manifest.json'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('export_handoff rejects symlinked output parents outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-handoff-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'aub-mcp-handoff-outside-'));
  try {
    await symlink(outside, join(root, 'linkdir'));
    const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
    await writeFile(join(root, 'dashboard.ui.json'), `${JSON.stringify(blueprint, null, 2)}\n`);
    await assert.rejects(
      () => exportHandoff({ ...ctx, root }, {
        ref: 'dashboard.ui.json',
        output: 'linkdir/escaped.aub.zip',
      }),
      /inside the workspace root/
    );
    await assert.rejects(() => readFile(join(outside, 'escaped.aub.zip'), 'utf8'), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('server exposes the complete transport-neutral tool set', () => {
  assert.deepEqual(registeredToolNames(), [
    'list_blueprints',
    'get_blueprint',
    'validate_blueprint',
    'scaffold_blueprint',
    'import_design_bridge',
    'write_blueprint',
    'export_prompt',
    'export_handoff',
    'submit_report',
    'list_projects',
    'get_project',
    'validate_project',
    'resolve_component',
    'diff_blueprints',
    'migrate_blueprint',
    'lock_blueprint',
    'get_aub_session',
    'update_aub_session',
    'get_workspace_status',
    'scan_project_ui',
    'generate_template_from_source',
    'approve_component_candidate',
    'export_template_authoring_prompt',
  ]);
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

async function createWorkspaceLoopFixture() {
  const root = await mkdtemp(join(tmpdir(), 'aub-workspace-loop-'));
  await mkdir(join(root, 'app', 'settings'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await writeFile(join(root, 'package.json'), `${JSON.stringify({
    name: '@acme/web-app',
    dependencies: { next: '^15.0.0', react: '^19.0.0' },
  }, null, 2)}\n`);
  await writeFile(join(root, 'app', 'settings', 'page.tsx'), [
    'import { InsightCard } from "../../src/components/InsightCard";',
    'export default function SettingsPage() {',
    '  return <main><h1>Settings</h1><InsightCard title="Plan" /></main>;',
    '}',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'components', 'InsightCard.tsx'), [
    'interface InsightCardProps {',
    '  title: string;',
    '  tone?: "info" | "warning";',
    '}',
    'export function InsightCard(props: InsightCardProps) {',
    '  return <section>{props.title}</section>;',
    '}',
    '',
  ].join('\n'));
  return root;
}

async function createAngularWorkspaceLoopFixture() {
  const root = await mkdtemp(join(tmpdir(), 'aub-angular-workspace-loop-'));
  await mkdir(join(root, 'src', 'app', 'login'), { recursive: true });
  await mkdir(join(root, 'src', 'app', 'home'), { recursive: true });
  await mkdir(join(root, 'src', 'app', 'shared', 'constants'), { recursive: true });
  await mkdir(join(root, 'src', 'app', 'txn', 't01', 'demo-datatable'), { recursive: true });
  await writeFile(join(root, 'package.json'), `${JSON.stringify({
    name: 'enterprise-portal',
    dependencies: { '@angular/core': '^9.1.13' },
  }, null, 2)}\n`);
  await writeFile(join(root, 'src', 'app', 'app-route-paths.const.ts'), [
    'export const appRoutePaths = {',
    "  login: 'login',",
    "  home: '',",
    '};',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'app.routing.ts'), [
    "import { LoginComponent } from './login/login.component';",
    "import { HomeComponent } from './home/home.component';",
    "import { appRoutePaths } from './app-route-paths.const';",
    "const fallbackRoute = { path: '**', redirectTo: appRoutePaths.home, pathMatch: 'full' };",
    'const routes = [',
    '  { path: appRoutePaths.login, component: LoginComponent },',
    '  { path: appRoutePaths.home, component: HomeComponent },',
    '  fallbackRoute,',
    '];',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'txn', 't01', 't01.routing.ts'), [
    "import { appRoutePaths } from '../../app-route-paths.const';",
    "import { DemoDataTableComponent } from './demo-datatable/demo-datatable.component';",
    'const routes = [',
    "  { path: appRoutePaths.home + 'portal/demo/table', component: DemoDataTableComponent },",
    '];',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'login', 'login.component.ts'), [
    "import { Component } from '@angular/core';",
    "@Component({ selector: 'app-login', templateUrl: './login.component.html' })",
    'export class LoginComponent {}',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'login', 'login.component.html'), '<form><button>Login</button></form>\n');
  await writeFile(join(root, 'src', 'app', 'home', 'home.component.ts'), [
    "import { Component } from '@angular/core';",
    "@Component({ selector: 'app-home', templateUrl: './home.component.html' })",
    'export class HomeComponent {}',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'home', 'home.component.html'), '<app-demo-datatable></app-demo-datatable>\n');
  await writeFile(join(root, 'src', 'app', 'shared', 'constants', 'prod-type.constants.ts'), [
    'export const DemoConstants = {',
    "  KIND: 'demo',",
    '};',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'txn', 't01', 'demo-datatable', 'demo-datatable.component.ts'), [
    "import { Component, Input } from '@angular/core';",
    "@Component({ selector: 'app-demo-datatable', templateUrl: './demo-datatable.component.html' })",
    'export class DemoDataTableComponent {',
    '  @Input() rows = [];',
    '}',
    '',
  ].join('\n'));
  await writeFile(join(root, 'src', 'app', 'txn', 't01', 'demo-datatable', 'demo-datatable.component.html'), '<table><tr><td>Demo</td></tr></table>\n');
  return root;
}

test('workspace session tools read and update .aub/session.json', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-session-'));
  try {
    const localCtx = { ...ctx, root };
    const empty = await getAubSession(localCtx);
    assert.equal(empty.session.activeBlueprint, null);
    const updated = await updateAubSession(localCtx, {
      patch: {
        activeBlueprint: 'screens/settings.ui.json',
        preview: { devServerUrl: 'http://localhost:3000', route: '/settings' },
      },
    });
    assert.equal(updated.session.activeBlueprint, 'screens/settings.ui.json');
    assert.equal(updated.session.preview.route, '/settings');
    const stored = JSON.parse(await readFile(join(root, '.aub', 'session.json'), 'utf8'));
    assert.equal(stored.preview.devServerUrl, 'http://localhost:3000');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('scan_project_ui writes component candidates without touching aub.registry.json', async () => {
  const root = await createWorkspaceLoopFixture();
  try {
    const result = await scanProjectUi({ ...ctx, root }, {});
    assert.ok(result.frameworks.includes('next'));
    assert.ok(result.routes.some((route) => route.route === '/settings'));
    assert.ok(result.components.some((component) => component.suggestedType === 'webapp:insight_card'));
    const candidates = JSON.parse(await readFile(join(root, '.aub', 'component-candidates.json'), 'utf8'));
    assert.ok(candidates.candidates.length > 0);
    await assert.rejects(() => readFile(join(root, 'aub.registry.json'), 'utf8'), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('scan_project_ui caps the file limit and rejects invalid limits', async () => {
  const root = await createWorkspaceLoopFixture();
  try {
    await writeFile(join(root, 'src', 'components', 'Huge.tsx'), `export function Huge() { return null; }\n${'x'.repeat(600_000)}`);
    await assert.rejects(() => scanProjectUi({ ...ctx, root }, { limit: 0 }), /positive integer/);
    const result = await scanProjectUi({ ...ctx, root }, { limit: 5000 });
    assert.ok(result.components.length > 0);
    assert.equal(result.skippedSourceFiles, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('scan_project_ui parses Angular routing files without treating wildcard redirects as routes', async () => {
  const root = await createAngularWorkspaceLoopFixture();
  try {
    const result = await scanProjectUi({ ...ctx, root }, { namespace: 'portal' });
    assert.ok(result.frameworks.includes('angular'));
    assert.ok(result.routes.some((route) => route.route === '/login' && route.path === 'src/app/login/login.component.html'));
    assert.ok(result.routes.some((route) => route.route === '/portal/demo/table'));
    assert.equal(result.routes.some((route) => route.route.includes('*')), false);
    assert.ok(result.components.some((component) => component.suggestedType === 'portal:demo_datatable'));
    assert.equal(result.components.some((component) => component.componentName === 'DemoConstants'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('generate_template_from_source saves a candidate workspace template', async () => {
  const root = await createWorkspaceLoopFixture();
  try {
    await scanProjectUi({ ...ctx, root }, {});
    const result = await generateTemplateFromSource({ ...ctx, root }, {
      sourcePath: 'app/settings/page.tsx',
      name: 'Settings',
    });
    assert.equal(result.template.format, 'aub-workspace-template');
    assert.equal(result.template.status, 'candidate');
    assert.equal(result.template.blueprint.screen.name, 'Settings');
    assert.ok(result.template.registryRefs.includes('webapp:insight_card'));
    const status = await getWorkspaceStatus({ ...ctx, root });
    assert.equal(status.templateCount, 1);
    assert.equal(status.templates[0].path, result.savedPath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('generate_template_from_source rejects symlinked output parents outside the workspace', async () => {
  const root = await createWorkspaceLoopFixture();
  const outside = await mkdtemp(join(tmpdir(), 'aub-template-outside-'));
  try {
    await symlink(outside, join(root, 'linkdir'));
    await scanProjectUi({ ...ctx, root }, {});
    await assert.rejects(
      () => generateTemplateFromSource({ ...ctx, root }, {
        sourcePath: 'app/settings/page.tsx',
        name: 'Settings',
        output: 'linkdir/template-escape',
      }),
      /inside the workspace root/
    );
    await assert.rejects(() => readFile(join(outside, 'template-escape.aub.template.json'), 'utf8'), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('approve_component_candidate only writes registry for extension approval', async () => {
  const root = await createWorkspaceLoopFixture();
  try {
    const scan = await scanProjectUi({ ...ctx, root }, {});
    const candidate = scan.components.find((component) => component.suggestedType === 'webapp:insight_card');
    assert.ok(candidate);
    const mapped = await approveComponentCandidate({ ...ctx, root }, {
      id: candidate.id,
      action: 'map_core',
      coreType: 'card',
    });
    assert.equal(mapped.registryPath, null);
    await assert.rejects(() => readFile(join(root, 'aub.registry.json'), 'utf8'), /ENOENT/);

    const extension = await approveComponentCandidate({ ...ctx, root }, {
      id: candidate.id,
      action: 'create_extension',
      namespacedType: 'webapp:insight_card',
    });
    assert.equal(extension.registryPath, 'aub.registry.json');
    const registry = JSON.parse(await readFile(join(root, 'aub.registry.json'), 'utf8'));
    assert.equal(registry.components[0].name, 'webapp:insight_card');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('export_template_authoring_prompt explains candidate-first custom components', async () => {
  const result = await exportTemplateAuthoringPrompt(ctx);
  assert.equal(result.format, 'markdown');
  assert.match(result.prompt, /component-candidates\.json/);
  assert.match(result.prompt, /never directly to `aub\.registry\.json`/);
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

test('submit_report safely persists schema-valid dotted screen ids', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-report-stem-'));
  try {
    const blueprint = structuredClone((await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint);
    blueprint.screen.id = 'bad..id';
    await writeFile(join(root, 'bad.ui.json'), `${JSON.stringify(blueprint, null, 2)}\n`);
    const report = passingReport(blueprint);
    const result = await submitReport({ ...ctx, root }, { ref: 'bad.ui.json', report });
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
    assert.ok(result.savedPath);
    assert.match(result.savedPath, /^\.aub\/reports\/bad\.id-.*-[0-9a-f-]{36}\.json$/);
    const persisted = JSON.parse(await readFile(join(root, result.savedPath), 'utf8'));
    assert.equal(persisted.blueprint.screen_id, 'bad..id');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('submit_report persists safety_score with accepted reports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-mcp-report-'));
  try {
    const blueprint = (await getBlueprint(ctx, { ref: SCREEN_ID })).blueprint;
    await writeFile(join(root, 'dashboard.ui.json'), `${JSON.stringify(blueprint, null, 2)}\n`, 'utf8');
    const report = passingReport(blueprint);
    const result = await submitReport({ ...ctx, root }, { ref: 'dashboard.ui.json', report, persist: true });
    assert.equal(result.accepted, true, `errors: ${JSON.stringify(result.errors)}`);
    assert.ok(result.savedPath);
    const persisted = JSON.parse(await readFile(join(root, result.savedPath), 'utf8'));
    assert.equal(typeof persisted.safety_score?.overall, 'number');
    assert.equal(persisted.safety_score.grade, result.summary.safety_score.grade);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
