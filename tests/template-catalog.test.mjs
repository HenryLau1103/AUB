import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const TEMPLATE_SOURCE = new URL('../apps/editor/src/lib/templates.ts', import.meta.url);

test('T1: editor exposes 18 unique common-layout templates', async () => {
  const source = await readFile(TEMPLATE_SOURCE, 'utf8');
  const block = source.match(/export const TEMPLATE_IDS:[^=]+=\s*\[([\s\S]*?)\];/);
  assert.ok(block, 'TEMPLATE_IDS must be statically declared');
  const ids = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.equal(ids.length, 18);
  assert.equal(new Set(ids).size, 18);
  for (const id of ids) {
    assert.ok(source.includes(`case '${id}':`), `template ${id} must have a builder case`);
    assert.match(source, new RegExp(`(?:^|\\n)\\s*['\"]?${id.replace('-', '\\-')}['\"]?\\s*:`), `template ${id} must have localized metadata`);
  }
});

test('T2: every template family is represented in the grouped picker', async () => {
  const source = await readFile(TEMPLATE_SOURCE, 'utf8');
  for (const group of ['business', 'productivity', 'commerce', 'consumer']) {
    assert.ok(source.includes(`id: '${group}'`), `missing template group ${group}`);
  }
});
