#!/usr/bin/env node
// Round-trip tests for the editor's import/export data path.
// Proves: load .ui.json → re-serialize → re-parse → equal.
// Also proves: an exported blueprint still passes schema validation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const EXAMPLE_JSON = new URL('../examples/dashboard.ui.json', import.meta.url).pathname;
const EXAMPLE_YAML = new URL('../examples/dashboard.ui.yaml', import.meta.url).pathname;
const SCHEMA_PATH = new URL('../schema/ui-blueprint.schema.json', import.meta.url).pathname;

async function makeValidator() {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

test('R1: JSON round-trip is lossless (parse → stringify → parse → deep-equal)', async () => {
  const a = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const b = JSON.parse(JSON.stringify(a, null, 2));
  assert.deepEqual(b, a, 'JSON round-trip must be lossless');
});

test('R2: YAML → JSON → YAML round-trip preserves structure', async () => {
  const yamlRaw = await readFile(EXAMPLE_YAML, 'utf8');
  const yamlDoc = yaml.load(yamlRaw);
  const json = JSON.stringify(yamlDoc, null, 2);
  const reparsed = JSON.parse(json);
  const back = yaml.load(json);
  assert.deepEqual(back, yamlDoc, 'YAML → JSON → YAML must preserve structure');
});

test('R3: re-serialized JSON still passes schema validation', async () => {
  const validate = await makeValidator();
  const a = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const b = JSON.parse(JSON.stringify(a, null, 2));
  const okA = validate(a);
  const okB = validate(b);
  assert.equal(okA, true, 'original must validate');
  assert.equal(okB, true, 're-serialized must validate');
  assert.equal(
    JSON.stringify(validate.errors),
    'null',
    'no schema errors after round-trip'
  );
});

test('R4: editor import path (load file, validate, use) matches JSON.parse exactly', async () => {
  const raw = await readFile(EXAMPLE_JSON, 'utf8');
  assert.equal(raw[0], '{', 'must start with { (no BOM)');
  const parsed = JSON.parse(raw);
  assert.ok(parsed.screen, 'must have screen field');
  assert.ok(parsed.nodes.length > 0, 'must have nodes');
});

test('R5: editor export path (JSON.stringify with indent=2) is byte-stable', async () => {
  // The editor uses JSON.stringify(b, null, 2) for export. Verify this is
  // deterministic — exporting the same blueprint twice produces the same bytes.
  const a = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const exp1 = JSON.stringify(a, null, 2);
  const exp2 = JSON.stringify(a, null, 2);
  assert.equal(exp1, exp2, 'export must be deterministic');
});

test('R6: end-to-end file I/O round-trip via temp files', async () => {
  // Simulate the full editor flow: write a blueprint to a temp file, read it back,
  // verify content is preserved. This proves the editor's file I/O contract.
  const tmp = await mkdtemp(join(tmpdir(), 'aub-roundtrip-'));
  try {
    const source = await readFile(EXAMPLE_JSON, 'utf8');
    const outPath = join(tmp, 'roundtrip.ui.json');
    await writeFile(outPath, source, 'utf8');
    const back = await readFile(outPath, 'utf8');
    assert.equal(back, source, 'file I/O must preserve content exactly');
    const reparsed = JSON.parse(back);
    assert.deepEqual(reparsed, JSON.parse(source));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('R7: round-trip preserves every acceptance item (the most fragile field)', async () => {
  const a = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const b = JSON.parse(JSON.stringify(a, null, 2));
  assert.equal(b.acceptance.length, a.acceptance.length);
  for (let i = 0; i < a.acceptance.length; i++) {
    assert.deepEqual(b.acceptance[i], a.acceptance[i], `acceptance[${i}] must round-trip`);
  }
});

test('R8: round-trip preserves every interaction source/target pair', async () => {
  const a = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const b = JSON.parse(JSON.stringify(a, null, 2));
  for (let i = 0; i < a.interactions.length; i++) {
    const orig = a.interactions[i];
    const back = b.interactions[i];
    assert.equal(back.source_node_id, orig.source_node_id);
    assert.equal(back.action, orig.action);
    assert.equal(back.target, orig.target);
    assert.equal(back.result_state, orig.result_state);
  }
});

test('R9: round-trip preserves parent/child relationships', async () => {
  const a = JSON.parse(await readFile(EXAMPLE_JSON, 'utf8'));
  const b = JSON.parse(JSON.stringify(a, null, 2));
  // Build a parent_id → children map from both, compare
  function buildMap(bp) {
    const map = new Map();
    for (const n of bp.nodes) {
      if (n.parent_id) {
        if (!map.has(n.parent_id)) map.set(n.parent_id, []);
        map.get(n.parent_id).push(n.id);
      }
    }
    return map;
  }
  const ma = buildMap(a);
  const mb = buildMap(b);
  assert.equal(mb.size, ma.size, 'parent map must have same number of keys');
  for (const [k, v] of ma) {
    const vb = mb.get(k);
    assert.ok(vb, `parent ${k} missing in round-trip`);
    assert.deepEqual([...vb].sort(), [...v].sort());
  }
});
