import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createBlueprintLock } from '../scripts/lock-blueprint.lib.mjs';

const BLUEPRINT_URL = new URL('../examples/dashboard.ui.json', import.meta.url);
const SCHEMA_URL = new URL('../schema/ui-blueprint-lock.schema.json', import.meta.url);

test('LOCK1: generated lock is schema-valid and deterministic', async () => {
  const [blueprint, schema] = await Promise.all([
    readFile(BLUEPRINT_URL, 'utf8').then(JSON.parse),
    readFile(SCHEMA_URL, 'utf8').then(JSON.parse),
  ]);
  const options = {
    sourceFile: 'examples/dashboard.ui.json',
    exportedAt: '2026-06-11T00:00:00.000Z',
  };
  const first = createBlueprintLock(blueprint, options);
  const second = createBlueprintLock(blueprint, options);
  assert.deepEqual(second, first);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
  assert.match(first.hashes.blueprint, /^sha256:[a-f0-9]{64}$/);
});
