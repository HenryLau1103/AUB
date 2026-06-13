import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { importAngularComponent, discoverAngularComponents } from '../scripts/angular-importer.lib.mjs';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';

const ROOT = resolve('tests/fixtures/angular');

async function fixtureFiles() {
  const paths = await walk(ROOT);
  return Promise.all(paths.map(async (path) => ({
    path: relative(ROOT, path).replace(/\\/g, '/'),
    content: await readFile(path, 'utf8'),
  })));
}

test('ANG1: discovers Angular entry and child components', async () => {
  const components = discoverAngularComponents(await fixtureFiles());
  assert.deepEqual(components.map((component) => component.selector).sort(), [
    'app-customer-results',
    'app-customer-search',
  ]);
});

test('ANG2: imports forms, bindings, validation, child table, and source map', async () => {
  const result = await importAngularComponent(await fixtureFiles(), { entry: 'app-customer-search' });
  const customerId = result.blueprint.nodes.find((node) => node.bindings?.value === 'customerId');
  const segment = result.blueprint.nodes.find((node) => node.bindings?.value === 'segment');
  const table = result.blueprint.nodes.find((node) => node.type === 'data_table');

  assert.equal(result.blueprint.version, '0.3.0');
  assert.equal(result.blueprint.provenance.entry_file, 'customer-search/customer-search.component.html');
  assert.equal(customerId.content.label, 'Customer ID');
  assert.equal(customerId.validation.required, true);
  assert.equal(customerId.validation.max_length, 12);
  assert.equal(segment.bindings.options, 'let item of segments');
  assert.equal(segment.bindings.enabled, 'false');
  assert.equal(table.content.columns.length, 4);
  assert.equal(table.content.columns[0].sticky, true);
  assert.equal(table.content.columns[1].sortable, true);
  assert.ok(result.blueprint.interactions.some((interaction) => interaction.action === 'invoke:query'));
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'unknown-custom-component'));
  assert.ok(Object.values(result.sourceMap).every((source) => !source.file.startsWith('/')));
});

test('ANG3: imported Blueprint passes schema and semantic validation', async () => {
  const schema = JSON.parse(await readFile(resolve('schema/ui-blueprint.schema.json'), 'utf8'));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const result = await importAngularComponent(await fixtureFiles(), { entry: 'app-customer-search' });
  assert.equal(validate(result.blueprint), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateBlueprintSemantics(result.blueprint), []);
});

test('ANG4: deeply nested templates fail with an explicit depth error', async () => {
  const deepTemplate = `${'<div>'.repeat(205)}Too deep${'</div>'.repeat(205)}`;
  await assert.rejects(
    () => importAngularComponent([
      {
        path: 'deep/deep.component.ts',
        content: `
          import { Component } from '@angular/core';
          @Component({ selector: 'app-deep', templateUrl: './deep.component.html' })
          export class DeepComponent {}
        `,
      },
      { path: 'deep/deep.component.html', content: deepTemplate },
    ], { entry: 'app-deep' }),
    /Angular template exceeds maximum nesting depth of 200/
  );
});

test('ANG5: wide templates fail with an explicit node-count error', async () => {
  const wideTemplate = `<section>${'<span>Item</span>'.repeat(5005)}</section>`;
  await assert.rejects(
    () => importAngularComponent([
      {
        path: 'wide/wide.component.ts',
        content: `
          import { Component } from '@angular/core';
          @Component({ selector: 'app-wide', templateUrl: './wide.component.html' })
          export class WideComponent {}
        `,
      },
      { path: 'wide/wide.component.html', content: wideTemplate },
    ], { entry: 'app-wide' }),
    /Angular template exceeds maximum (pre-parse tag count|node count)/
  );
});

test('ANG6: nodes with excessive attributes fail explicitly', async () => {
  const attrs = Array.from({ length: 81 }, (_, index) => `data-a${index}="${index}"`).join(' ');
  await assert.rejects(
    () => importAngularComponent([
      {
        path: 'attrs/attrs.component.ts',
        content: `
          import { Component } from '@angular/core';
          @Component({ selector: 'app-attrs', templateUrl: './attrs.component.html' })
          export class AttrsComponent {}
        `,
      },
      { path: 'attrs/attrs.component.html', content: `<button ${attrs}>Run</button>` },
    ], { entry: 'app-attrs' }),
    /Angular template node exceeds maximum attribute count of 80/
  );
});

test('ANG7: source file count, path length, and component count caps fail explicitly', async () => {
  await assert.rejects(
    () => importAngularComponent(Array.from({ length: 2001 }, (_, index) => ({
      path: `many/file-${index}.ts`,
      content: '',
    }))),
    /maximum file count of 2000/
  );

  await assert.rejects(
    () => importAngularComponent([
      {
        path: `${'a'.repeat(513)}.component.ts`,
        content: '',
      },
    ]),
    /source path exceeds maximum length of 512/
  );

  await assert.rejects(
    () => importAngularComponent(Array.from({ length: 501 }, (_, index) => ({
      path: `many/c${index}.component.ts`,
      content: `
        import { Component } from '@angular/core';
        @Component({ selector: 'app-c${index}', templateUrl: './c${index}.component.html' })
        export class C${index}Component {}
      `,
    }))),
    /component count exceeds maximum of 500/
  );
});

test('ANG8: child component templates also apply the full-template node cap', async () => {
  const wideTemplate = `<section>${'<span>Item</span>'.repeat(5005)}</section>`;
  await assert.rejects(
    () => importAngularComponent([
      {
        path: 'parent/parent.component.ts',
        content: `
          import { Component } from '@angular/core';
          @Component({ selector: 'app-parent', templateUrl: './parent.component.html' })
          export class ParentComponent {}
        `,
      },
      { path: 'parent/parent.component.html', content: '<app-child></app-child>' },
      {
        path: 'parent/child.component.ts',
        content: `
          import { Component } from '@angular/core';
          @Component({ selector: 'app-child', templateUrl: './child.component.html' })
          export class ChildComponent {}
        `,
      },
      { path: 'parent/child.component.html', content: wideTemplate },
    ], { entry: 'app-parent' }),
    /Angular template exceeds maximum (pre-parse tag count|node count)/
  );
});

test('ANG9: aggregate template node budget applies across child components', async () => {
  const childTemplate = `<section>${'<span>Item</span>'.repeat(2400)}</section>`;
  const childFiles = Array.from({ length: 5 }, (_, index) => ([
    {
      path: `parent/child-${index}.component.ts`,
      content: `
        import { Component } from '@angular/core';
        @Component({ selector: 'app-child-${index}', templateUrl: './child-${index}.component.html' })
        export class Child${index}Component {}
      `,
    },
    { path: `parent/child-${index}.component.html`, content: childTemplate },
  ])).flat();
  await assert.rejects(
    () => importAngularComponent([
      {
        path: 'parent/parent.component.ts',
        content: `
          import { Component } from '@angular/core';
          @Component({ selector: 'app-parent', templateUrl: './parent.component.html' })
          export class ParentComponent {}
        `,
      },
      {
        path: 'parent/parent.component.html',
        content: Array.from({ length: 5 }, (_, index) => `<app-child-${index}></app-child-${index}>`).join(''),
      },
      ...childFiles,
    ], { entry: 'app-parent' }),
    /Angular import exceeds maximum aggregate template node count of 20000/
  );
});

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (['.html', '.scss', '.css', '.ts'].includes(extname(path))) result.push(path);
  }
  return result.sort();
}
