import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  loadProject,
  validateProjectSemantics,
  parseProjectText,
  resolveScreenPath,
  mergeDesignSystem,
  buildProject,
  NAVIGATION_TRIGGERS,
  PROJECT_VERSION,
} from '../scripts/project.lib.mjs';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';
import { buildCoreKnownTypes } from '../scripts/registry.lib.mjs';

const PROJECT = new URL('../examples/project/app.aub.project.json', import.meta.url).pathname;
const PROJECT_SCHEMA = new URL('../schema/ui-project.schema.json', import.meta.url).pathname;
const BLUEPRINT_SCHEMA = new URL('../schema/ui-blueprint.schema.json', import.meta.url).pathname;

async function compile(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(await readFile(schemaPath, 'utf8')));
}

test('example project passes its JSON Schema', async () => {
  const validate = await compile(PROJECT_SCHEMA);
  const { project } = await loadProject(PROJECT);
  const ok = validate(project);
  assert.ok(ok, JSON.stringify(validate.errors));
});

test('loadProject resolves every member screen without errors', async () => {
  const { project, screens, screensById, errors } = await loadProject(PROJECT);
  assert.deepEqual(errors, []);
  assert.equal(screens.length, project.screens.length);
  for (const ref of project.screens) {
    assert.ok(screensById.has(ref.id), `missing loaded screen ${ref.id}`);
    assert.ok(screensById.get(ref.id).screen, `screen ${ref.id} has no screen meta`);
  }
});

test('project semantics pass for the valid example (incl. screen.id match)', async () => {
  const { project, screensById } = await loadProject(PROJECT);
  assert.deepEqual(validateProjectSemantics(project, { screensById }), []);
});

test('each member screen passes schema + semantic validation', async () => {
  const validate = await compile(BLUEPRINT_SCHEMA);
  const knownTypes = await buildCoreKnownTypes();
  const { screens } = await loadProject(PROJECT);
  for (const { ref, blueprint } of screens) {
    assert.ok(validate(blueprint), `${ref.id} schema: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual(
      validateBlueprintSemantics(blueprint, { knownTypes }),
      [],
      `${ref.id} semantics`
    );
  }
});

test('validateProjectSemantics flags a dangling entry_screen', () => {
  const project = {
    version: PROJECT_VERSION,
    id: 'p',
    name: 'P',
    screens: [{ id: 'a', path: 'a.ui.json' }],
    entry_screen: 'missing',
  };
  const errors = validateProjectSemantics(project);
  assert.ok(errors.some((e) => e.includes('entry_screen')));
});

test('validateProjectSemantics flags navigation to an undeclared screen', () => {
  const project = {
    version: PROJECT_VERSION,
    id: 'p',
    name: 'P',
    screens: [{ id: 'a', path: 'a.ui.json' }],
    entry_screen: 'a',
    navigation: [{ from: 'a', to: 'ghost' }],
  };
  const errors = validateProjectSemantics(project);
  assert.ok(errors.some((e) => e.includes('ghost')));
});

test('validateProjectSemantics flags duplicate screen ids and paths', () => {
  const project = {
    version: PROJECT_VERSION,
    id: 'p',
    name: 'P',
    screens: [
      { id: 'a', path: 'a.ui.json' },
      { id: 'a', path: 'a.ui.json' },
    ],
    entry_screen: 'a',
  };
  const errors = validateProjectSemantics(project);
  assert.ok(errors.some((e) => e.includes('duplicate screen id')));
  assert.ok(errors.some((e) => e.includes('duplicate screen path')));
});

test('validateProjectSemantics flags an unknown navigation trigger', () => {
  const project = {
    version: PROJECT_VERSION,
    id: 'p',
    name: 'P',
    screens: [{ id: 'a', path: 'a.ui.json' }],
    entry_screen: 'a',
    navigation: [{ from: 'a', to: 'a', trigger: 'telepathy' }],
  };
  assert.ok(validateProjectSemantics(project).some((e) => e.includes('telepathy')));
});

test('validateProjectSemantics flags a screen.id mismatch against the loaded blueprint', () => {
  const project = {
    version: PROJECT_VERSION,
    id: 'p',
    name: 'P',
    screens: [{ id: 'declared', path: 'a.ui.json' }],
    entry_screen: 'declared',
  };
  const screensById = new Map([['declared', { screen: { id: 'actual' } }]]);
  const errors = validateProjectSemantics(project, { screensById });
  assert.ok(errors.some((e) => e.includes('id mismatch')));
});

test('resolveScreenPath resolves relative to the project file directory', () => {
  const resolved = resolveScreenPath('/proj/app.aub.project.json', 'screens/home.ui.json');
  assert.equal(resolved, '/proj/screens/home.ui.json');
});

test('mergeDesignSystem lets the screen override project tokens', async () => {
  const project = { design_system: { a: 1, b: 2 } };
  const blueprint = { design_system: { b: 99, c: 3 } };
  assert.deepEqual(mergeDesignSystem(project, blueprint), { a: 1, b: 99, c: 3 });
});

test('buildProject wraps screens and defaults the entry to the first', () => {
  const project = buildProject({
    id: 'demo',
    name: 'Demo',
    screens: [
      { blueprint: { screen: { id: 'one', name: 'One' } }, path: 'one.ui.json' },
      { blueprint: { screen: { id: 'two', name: 'Two' } }, path: 'two.ui.json' },
    ],
  });
  assert.equal(project.version, PROJECT_VERSION);
  assert.equal(project.entry_screen, 'one');
  assert.equal(project.screens.length, 2);
  assert.deepEqual(project.screens[0], { id: 'one', name: 'One', path: 'one.ui.json' });
});

test('buildProject output validates against the project schema', async () => {
  const validate = await compile(PROJECT_SCHEMA);
  const project = buildProject({
    id: 'demo',
    name: 'Demo',
    screens: [{ blueprint: { screen: { id: 'one', name: 'One' } }, path: 'one.ui.json' }],
  });
  // Strip the editor-only $schema hint before validating against the strict schema.
  delete project.$schema;
  assert.ok(validate(project), JSON.stringify(validate.errors));
});

test('parseProjectText reads JSON and the example file round-trips', async () => {
  const raw = await readFile(PROJECT, 'utf8');
  const parsed = parseProjectText(raw, PROJECT);
  assert.equal(parsed.id, 'acme-app');
  assert.equal(parsed.entry_screen, 'acme.dashboard');
});

test('project schema allows parent segments; runtime workspace containment enforces safety', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aub-project-contained-'));
  try {
    await mkdir(join(root, 'flows'), { recursive: true });
    await mkdir(join(root, 'screens'), { recursive: true });
    await writeFile(
      join(root, 'screens', 'home.ui.json'),
      await readFile(new URL('../examples/dashboard.ui.json', import.meta.url), 'utf8'),
      'utf8'
    );
    const project = {
      version: PROJECT_VERSION,
      id: 'workspace-layout',
      name: 'Workspace Layout',
      screens: [{ id: 'dashboard.overview', path: '../screens/home.ui.json' }],
      entry_screen: 'dashboard.overview',
    };
    await writeFile(join(root, 'flows', 'app.aub.project.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8');

    const validate = await compile(PROJECT_SCHEMA);
    assert.equal(validate(project), true, JSON.stringify(validate.errors));

    const loaded = await loadProject(join(root, 'flows', 'app.aub.project.json'), { workspaceRoot: root });
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.screens[0].blueprint.screen.id, 'dashboard.overview');

    const defaultLoaded = await loadProject(join(root, 'flows', 'app.aub.project.json'));
    assert.ok(defaultLoaded.errors.some((error) => /inside workspace/.test(error)), JSON.stringify(defaultLoaded.errors));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('NAVIGATION_TRIGGERS lists the supported triggers', () => {
  assert.deepEqual(NAVIGATION_TRIGGERS, ['click', 'submit', 'change', 'load', 'system', 'gesture']);
});
