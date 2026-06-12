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

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (['.html', '.scss', '.css', '.ts'].includes(extname(path))) result.push(path);
  }
  return result.sort();
}
