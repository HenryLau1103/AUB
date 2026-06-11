import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { importDesignBridge } from '../scripts/design-bridge.lib.mjs';
import { validateBlueprintSemantics } from '../scripts/validate-blueprint.lib.mjs';

const example = JSON.parse(
  await readFile(resolve('examples/design-bridge/figma-hero.aub.bridge.json'), 'utf8')
);
const bridgeSchema = JSON.parse(await readFile(resolve('schema/design-bridge.schema.json'), 'utf8'));
const blueprintSchema = JSON.parse(await readFile(resolve('schema/ui-blueprint.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(blueprintSchema);
const validateBridge = ajv.compile(bridgeSchema);

test('DB1: example Design Bridge validates and imports without semantic inference', () => {
  assert.equal(validateBridge(example), true, JSON.stringify(validateBridge.errors));
  const result = importDesignBridge(example);
  assert.equal(result.blueprint.provenance.source_kind, 'figma');
  assert.equal(result.blueprint.nodes[1].source.selector, '2:2');
  assert.equal(result.sourceMap.primary_cta.component_key, 'button/primary');
  assert.deepEqual(validateBlueprintSemantics(result.blueprint), []);
});

test('DB2: node_map must exactly cover the Blueprint node tree', () => {
  const incomplete = structuredClone(example);
  delete incomplete.node_map.headline;
  assert.throws(() => importDesignBridge(incomplete), /missing node mappings: headline/);
});

test('DB3: Penpot is preserved as Blueprint provenance', () => {
  const penpot = structuredClone(example);
  penpot.source = {
    kind: 'penpot',
    document_id: 'penpot-demo',
    page_id: 'page-1',
    frame_id: 'board-1',
  };
  const result = importDesignBridge(penpot);
  assert.equal(result.blueprint.provenance.source_kind, 'penpot');
  assert.match(result.blueprint.provenance.source_files[0], /^penpot:\/\//);
});
