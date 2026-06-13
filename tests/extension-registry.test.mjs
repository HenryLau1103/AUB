import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';
import {
  buildKnownTypes,
  buildCoreKnownTypes,
  parseExtensionRegistry,
  discoverExtensionRegistry,
  discoverWorkspaceExtensionRegistry,
  resolveKnownTypesForBlueprint,
  EXTENSION_NAME_PATTERN,
} from '../scripts/registry.lib.mjs';

const EXAMPLE = new URL('../examples/extensions/analytics-insights.ui.json', import.meta.url).pathname;
const EXAMPLE_REGISTRY = new URL('../examples/extensions/aub.registry.json', import.meta.url).pathname;

async function loadExample() {
  return JSON.parse(await readFile(EXAMPLE, 'utf8'));
}

test('extension example validates when its registry is supplied', async () => {
  const blueprint = await loadExample();
  const { knownTypes } = await buildKnownTypes({ extensionPath: EXAMPLE_REGISTRY, discover: false });
  const errors = validateBlueprintSemantics(blueprint, { knownTypes });
  assert.deepEqual(errors, []);
});

test('namespaced types without a registry are reported as unknown', async () => {
  const blueprint = await loadExample();
  const knownTypes = await buildCoreKnownTypes();
  const errors = validateBlueprintSemantics(blueprint, { knownTypes });
  assert.ok(errors.some((e) => e.includes('unknown component type "acme:metric_sparkline"')));
  assert.ok(errors.every((e) => !e.includes('acme:metric_sparkline') || e.includes('aub.registry.json')));
});

test('a registered extension container may declare children', async () => {
  const knownTypes = new Map([
    ['page', { isContainer: true }],
    ['acme:insight_card', { isContainer: true }],
    ['heading', { isContainer: false }],
  ]);
  const blueprint = {
    nodes: [
      { id: 'page', type: 'page', parent_id: null, children: ['card'] },
      { id: 'card', type: 'acme:insight_card', parent_id: 'page', children: ['h'] },
      { id: 'h', type: 'heading', parent_id: 'card', children: [] },
    ],
  };
  const errors = validateBlueprintSemantics(blueprint, { knownTypes });
  assert.deepEqual(errors, []);
});

test('a registered extension leaf with children is rejected', async () => {
  const knownTypes = new Map([
    ['page', { isContainer: true }],
    ['acme:metric_sparkline', { isContainer: false }],
    ['heading', { isContainer: false }],
  ]);
  const blueprint = {
    nodes: [
      { id: 'page', type: 'page', parent_id: null, children: ['spark'] },
      { id: 'spark', type: 'acme:metric_sparkline', parent_id: 'page', children: ['h'] },
      { id: 'h', type: 'heading', parent_id: 'spark', children: [] },
    ],
  };
  const errors = validateBlueprintSemantics(blueprint, { knownTypes });
  assert.ok(errors.some((e) => e.includes('is a leaf (isContainer:false) but declares children')));
});

test('parseExtensionRegistry rejects collisions with core types', async () => {
  const core = new Set((await buildCoreKnownTypes()).keys());
  assert.throws(
    () => parseExtensionRegistry({ components: [{ name: 'acme:card', isContainer: true }] }, new Set(['acme:card'])),
    /collides with a core component type/
  );
  // A real core name namespaced is fine (different string); a literal core collision is caught:
  assert.throws(
    () => parseExtensionRegistry({ components: [{ name: 'button', isContainer: false }] }, core),
    /must match team:component/
  );
});

test('parseExtensionRegistry rejects bad names, duplicates, and missing isContainer', () => {
  assert.throws(
    () => parseExtensionRegistry({ components: [{ name: 'Acme:Card', isContainer: true }] }, new Set()),
    /must match team:component/
  );
  assert.throws(
    () => parseExtensionRegistry({ components: [{ name: 'acme:card' }] }, new Set()),
    /must declare isContainer/
  );
  assert.throws(
    () =>
      parseExtensionRegistry(
        { components: [{ name: 'acme:card', isContainer: true }, { name: 'acme:card', isContainer: false }] },
        new Set()
      ),
    /duplicate extension component/
  );
  assert.throws(() => parseExtensionRegistry({}, new Set()), /missing required "components" array/);
});

test('EXTENSION_NAME_PATTERN accepts team:component and rejects core/snake names', () => {
  assert.ok(EXTENSION_NAME_PATTERN.test('acme:data_card'));
  assert.ok(EXTENSION_NAME_PATTERN.test('a:b'));
  assert.ok(!EXTENSION_NAME_PATTERN.test('metric_card'));
  assert.ok(!EXTENSION_NAME_PATTERN.test('Acme:Card'));
  assert.ok(!EXTENSION_NAME_PATTERN.test('acme:'));
  assert.ok(!EXTENSION_NAME_PATTERN.test(':card'));
});

test('discoverExtensionRegistry finds aub.registry.json by walking up', async () => {
  const base = await mkdtemp(join(tmpdir(), 'aub-reg-'));
  const nested = join(base, 'a', 'b');
  await mkdir(nested, { recursive: true });
  await writeFile(join(base, 'aub.registry.json'), '{"components":[]}\n');
  const found = discoverExtensionRegistry(nested);
  assert.equal(found, join(base, 'aub.registry.json'));
});

test('discoverWorkspaceExtensionRegistry does not cross the workspace root', async () => {
  const base = await mkdtemp(join(tmpdir(), 'aub-reg-parent-'));
  try {
    const workspace = join(base, 'workspace');
    const nested = join(workspace, 'src', 'screens');
    await mkdir(nested, { recursive: true });
    await writeFile(join(base, 'aub.registry.json'), '{"components":[]}\n');
    assert.equal(discoverWorkspaceExtensionRegistry(workspace, nested), null);
    await writeFile(join(workspace, 'aub.registry.json'), '{"components":[]}\n');
    assert.ok(discoverWorkspaceExtensionRegistry(workspace, nested)?.endsWith('/workspace/aub.registry.json'));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('discoverWorkspaceExtensionRegistry rejects symlinked discovery starts outside the workspace', async () => {
  const base = await mkdtemp(join(tmpdir(), 'aub-reg-link-'));
  try {
    const workspace = join(base, 'workspace');
    const outside = join(base, 'outside');
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'aub.registry.json'), '{"components":[]}\n');
    await symlink(outside, join(workspace, 'linked-outside'));

    assert.throws(
      () => discoverWorkspaceExtensionRegistry(workspace, join(workspace, 'linked-outside')),
      /Registry discovery start directory must stay inside workspace/
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('resolveKnownTypesForBlueprint discovers only registries contained by the workspace', async () => {
  const base = await mkdtemp(join(tmpdir(), 'aub-reg-helper-'));
  try {
    const workspace = join(base, 'workspace');
    const screens = join(workspace, 'screens');
    await mkdir(screens, { recursive: true });
    await writeFile(join(workspace, 'aub.registry.json'), await readFile(EXAMPLE_REGISTRY, 'utf8'));
    await writeFile(join(screens, 'analytics.ui.json'), await readFile(EXAMPLE, 'utf8'));

    const { knownTypes, extensionPath } = await resolveKnownTypesForBlueprint({
      workspaceRoot: workspace,
      blueprintAbsPath: join(screens, 'analytics.ui.json'),
    });
    assert.ok(extensionPath.endsWith('/workspace/aub.registry.json'));
    assert.equal(knownTypes.get('acme:insight_card')?.isContainer, true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('buildKnownTypes auto-discovers from a start directory', async () => {
  const { knownTypes, extensionPath, extensions } = await buildKnownTypes({
    startDir: new URL('../examples/extensions', import.meta.url).pathname,
  });
  assert.equal(extensionPath, EXAMPLE_REGISTRY);
  assert.equal(knownTypes.get('acme:insight_card')?.isContainer, true);
  assert.equal(knownTypes.get('acme:metric_sparkline')?.isContainer, false);
  assert.equal(knownTypes.get('page')?.source, 'core');
  assert.equal(extensions[0].implementations[0].module, '@acme/analytics-ui');
  assert.equal(knownTypes.get('acme:insight_card')?.implementations[0].export, 'InsightCard');
  assert.equal(
    knownTypes.get('acme:insight_card')?.implementations[0].props.title.from,
    'content.title'
  );
});

test('parseExtensionRegistry validates production implementation mappings', () => {
  const valid = parseExtensionRegistry(
    {
      components: [
        {
          name: 'acme:card',
          isContainer: true,
          implementations: [
            {
              id: 'react',
              framework: 'react',
              module: '@acme/ui',
              export: 'Card',
              props: { title: { from: 'content.title', required: true } },
            },
          ],
        },
      ],
    },
    new Set()
  );
  assert.equal(valid.components[0].implementations[0].importStyle, 'named');
  assert.throws(
    () =>
      parseExtensionRegistry(
        {
          components: [
            {
              name: 'acme:card',
              isContainer: true,
              implementations: [{ id: 'react', framework: 'react' }],
            },
          ],
        },
        new Set()
      ),
    /must declare module/
  );
  assert.throws(
    () =>
      parseExtensionRegistry(
        {
          components: [
            {
              name: 'acme:card',
              isContainer: true,
              implementations: [
                { id: 'react', framework: 'react', module: '@acme/ui' },
                { id: 'react', framework: 'react', module: '@acme/ui-next' },
              ],
            },
          ],
        },
        new Set()
      ),
    /duplicate implementation id/
  );
});

test('aub.registry.schema.json validates the example registry and enforces the namespace pattern', async () => {
  const Ajv2020 = (await import('ajv/dist/2020.js')).default;
  const addFormats = (await import('ajv-formats')).default;
  const schema = JSON.parse(
    await readFile(new URL('../schema/aub.registry.schema.json', import.meta.url).pathname, 'utf8')
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const example = JSON.parse(await readFile(EXAMPLE_REGISTRY, 'utf8'));
  assert.equal(validate(example), true, JSON.stringify(validate.errors));

  assert.equal(validate({ components: [{ name: 'Acme:Card', isContainer: true }] }), false);
  assert.equal(validate({ components: [{ name: 'acme:card' }] }), false);
  assert.equal(
    validate({
      components: [
        {
          name: 'acme:card',
          isContainer: true,
          implementations: [{ id: 'react', framework: 'react', module: '@acme/ui' }],
        },
      ],
    }),
    true,
    JSON.stringify(validate.errors)
  );
  assert.equal(
    validate({
      components: [
        {
          name: 'acme:card',
          isContainer: true,
          implementations: [{ id: 'react', framework: 'react' }],
        },
      ],
    }),
    false
  );
  assert.equal(validate({}), false);

  // The published schema pattern must match the validator's runtime pattern.
  assert.equal(schema.$defs.extensionComponent.properties.name.pattern, EXTENSION_NAME_PATTERN.source);
});
