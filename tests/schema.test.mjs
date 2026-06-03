#!/usr/bin/env node
// Schema validation tests for UI Blueprint.
// Run: node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const SCHEMA_PATH = new URL('../schema/ui-blueprint.schema.json', import.meta.url).pathname;
const EXAMPLE_JSON = new URL('../examples/dashboard.ui.json', import.meta.url).pathname;
const EXAMPLE_YAML = new URL('../examples/dashboard.ui.yaml', import.meta.url).pathname;

async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

async function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(await loadSchema());
}

test('S1: schema validates legal JSON example', async () => {
  const validate = await makeValidator();
  const doc = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const ok = validate(doc);
  assert.equal(ok, true, `expected valid; errors=${JSON.stringify(validate.errors)}`);
});

test('S2: schema rejects malformed example (missing required field)', async () => {
  const validate = await makeValidator();
  const doc = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  delete doc.screen.platform; // platform is required
  const ok = validate(doc);
  assert.equal(ok, false);
  const err = validate.errors.find((e) => e.keyword === 'required' && e.params.missingProperty === 'platform');
  assert.ok(err, `expected error about missing 'platform'; got=${JSON.stringify(validate.errors)}`);
  assert.equal(err.instancePath, '/screen');
});

test('S2: schema rejects unknown component type', async () => {
  const validate = await makeValidator();
  const doc = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  doc.nodes[0].type = 'flying_unicorn';
  const ok = validate(doc);
  assert.equal(ok, false);
  const err = validate.errors.find((e) => e.keyword === 'enum');
  assert.ok(err, 'expected enum error');
  assert.equal(err.instancePath, '/nodes/0/type');
});

test('S2: schema rejects absolute coordinates (forbidden x property)', async () => {
  const validate = await makeValidator();
  const doc = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  doc.nodes[0].layout.x = 100;
  const ok = validate(doc);
  assert.equal(ok, false);
  const err = validate.errors.find((e) => e.keyword === 'additionalProperties' && e.params.additionalProperty === 'x');
  assert.ok(err, `expected additionalProperties error on x; got=${JSON.stringify(validate.errors)}`);
});

test('S2: schema rejects acceptance with <5 items', async () => {
  const validate = await makeValidator();
  const doc = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  doc.acceptance = doc.acceptance.slice(0, 3);
  const ok = validate(doc);
  assert.equal(ok, false);
  const err = validate.errors.find((e) => e.keyword === 'minItems' && e.instancePath === '/acceptance');
  assert.ok(err, `expected minItems error; got=${JSON.stringify(validate.errors)}`);
});

test('S5: YAML example is schema-valid', async () => {
  const validate = await makeValidator();
  const raw = await readFile(EXAMPLE_YAML, 'utf8');
  const doc = yaml.load(raw);
  const ok = validate(doc);
  assert.equal(ok, true, `expected valid YAML; errors=${JSON.stringify(validate.errors)}`);
});

test('S5: YAML and JSON examples are semantically equivalent (deep equal)', async () => {
  const json = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const yamlDoc = yaml.load(await readFile(EXAMPLE_YAML, 'utf8'));
  // js-yaml may produce slightly different ordering for objects, but deep-equal works on the values.
  assert.deepEqual(yamlDoc, json);
});

test('S8: registry file exists and is well-formed', async () => {
  const registryPath = new URL('../schema/registry/components.json', import.meta.url).pathname;
  const raw = await readFile(registryPath, 'utf8');
  const registry = JSON.parse(raw);
  assert.ok(registry.version, 'registry must declare version');
  assert.ok(Array.isArray(registry.categories), 'registry must have categories array');
  assert.equal(registry.categories.length, 6, 'registry must have 6 categories (Layout/Data/Form/Action/Feedback/Navigation)');
  for (const cat of registry.categories) {
    assert.ok(cat.id, `category missing id`);
    assert.ok(cat.name, `category ${cat.id} missing name`);
    assert.ok(Array.isArray(cat.types), `category ${cat.id} missing types array`);
    for (const t of cat.types) {
      assert.ok(t.name, `type in ${cat.id} missing name`);
      assert.ok(typeof t.isContainer === 'boolean', `type ${t.name} missing isContainer flag`);
    }
  }
});

test('S8: registry has >=30 unique types', async () => {
  const registryPath = new URL('../schema/registry/components.json', import.meta.url).pathname;
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const allTypes = new Set();
  for (const cat of registry.categories) {
    for (const t of cat.types) allTypes.add(t.name);
  }
  assert.ok(allTypes.size >= 30, `expected >=30 unique types in registry, got ${allTypes.size}`);
});

test('S8: registry types are split into container and leaf (no overlap, union is all types)', async () => {
  const registryPath = new URL('../schema/registry/components.json', import.meta.url).pathname;
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const containers = new Set();
  const leaves = new Set();
  for (const cat of registry.categories) {
    for (const t of cat.types) {
      if (t.isContainer) containers.add(t.name);
      else leaves.add(t.name);
    }
  }
  // No overlap
  for (const c of containers) assert.ok(!leaves.has(c), `${c} is in both container and leaf`);
  // Union is all types
  const union = new Set([...containers, ...leaves]);
  const allTypes = new Set();
  for (const cat of registry.categories) for (const t of cat.types) allTypes.add(t.name);
  assert.equal(union.size, allTypes.size, 'container + leaf must equal all types');
});

test('S8: registry types match JSON Schema enum (sync invariant)', async () => {
  const registryPath = new URL('../schema/registry/components.json', import.meta.url).pathname;
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const schema = await loadSchema();
  const schemaTypes = new Set(schema.$defs.componentType.enum);
  const registryTypes = new Set();
  for (const cat of registry.categories) for (const t of cat.types) registryTypes.add(t.name);
  for (const t of registryTypes) {
    assert.ok(schemaTypes.has(t), `registry type ${t} not in schema enum — schema is out of sync`);
  }
  for (const t of schemaTypes) {
    assert.ok(registryTypes.has(t), `schema type ${t} not in registry — schema has orphan type`);
  }
  assert.equal(registryTypes.size, schemaTypes.size, 'registry and schema enum must have same type count');
});

test('S8: container subset in registry matches containerComponentType enum in schema', async () => {
  const registryPath = new URL('../schema/registry/components.json', import.meta.url).pathname;
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const schema = await loadSchema();
  const schemaContainers = new Set(schema.$defs.containerComponentType.enum);
  const registryContainers = new Set();
  for (const cat of registry.categories) for (const t of cat.types) if (t.isContainer) registryContainers.add(t.name);
  for (const c of registryContainers) assert.ok(schemaContainers.has(c), `registry container ${c} not in schema.containerComponentType`);
  for (const c of schemaContainers) assert.ok(registryContainers.has(c), `schema container ${c} not flagged isContainer in registry`);
});

test('S7: versioning policy file exists', async () => {
  const policyPath = new URL('../docs/schema-versioning.md', import.meta.url).pathname;
  const content = await readFile(policyPath, 'utf8');
  assert.ok(content.length > 200, 'versioning policy must be substantive');
  assert.match(content, /SemVer|MAJOR|MINOR|PATCH/i, 'must mention SemVer / MAJOR / MINOR / PATCH');
});

test('S7: schema declares a version field and $id', async () => {
  const schema = await loadSchema();
  assert.ok(schema.$id, 'schema must declare $id');
  assert.ok(schema.properties.version, 'schema must declare version property');
  // Pattern is a JSON Schema regex string: "^[0-9]+\\.[0-9]+\\.[0-9]+$".
  // Convert to JS regex syntax: \d+, then evaluate against a known good semver.
  const pattern = schema.properties.version.pattern;
  const jsRegex = new RegExp(pattern);
  assert.match('1.0.0', jsRegex, 'pattern must accept 1.0.0');
  assert.match('0.1.0', jsRegex, 'pattern must accept 0.1.0');
  assert.doesNotMatch('1.0', jsRegex, 'pattern must reject 1.0 (no patch)');
  assert.doesNotMatch('v1.0.0', jsRegex, 'pattern must reject v1.0.0');
});

test('Schema: layout enum forbids absolute coordinate names', async () => {
  const schema = await loadSchema();
  const layoutProps = Object.keys(schema.$defs.layout.properties);
  for (const forbidden of ['x', 'y', 'top', 'left', 'right', 'bottom']) {
    assert.ok(
      !layoutProps.includes(forbidden),
      `layout property "${forbidden}" is forbidden (must use padding/flex/grid only)`
    );
  }
});

test('Schema: top-level additionalProperties is false (closed root)', async () => {
  const schema = await loadSchema();
  assert.equal(schema.additionalProperties, false);
});

test('Schema: required fields are all present', async () => {
  const schema = await loadSchema();
  const required = ['version', 'screen', 'viewports', 'nodes', 'interactions', 'responsive', 'acceptance'];
  for (const f of required) {
    assert.ok(schema.required.includes(f), `top-level ${f} must be required`);
  }
});
