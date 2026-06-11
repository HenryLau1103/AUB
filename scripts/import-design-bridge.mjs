#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { importDesignBridge } from './design-bridge.lib.mjs';
import { buildKnownTypes } from './registry.lib.mjs';
import { validateBlueprintSemantics } from './validate-blueprint.lib.mjs';

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('-'));
const outputIndex = args.findIndex((arg) => arg === '--output' || arg === '-o');
const registryIndex = args.findIndex((arg) => arg === '--registry');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const registryPath = registryIndex >= 0 ? args[registryIndex + 1] : undefined;

if (!inputPath || !outputPath) {
  console.error('Usage: pnpm import:design -- <file.aub.bridge.json> --output <screen.ui.json> [--registry aub.registry.json]');
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const [bridgeSchema, blueprintSchema, input] = await Promise.all([
  readFile(resolve(root, 'schema/design-bridge.schema.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'schema/ui-blueprint.schema.json'), 'utf8').then(JSON.parse),
  readFile(resolve(inputPath), 'utf8').then(JSON.parse),
]);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(blueprintSchema);
const validateBridge = ajv.compile(bridgeSchema);
if (!validateBridge(input)) {
  for (const error of validateBridge.errors ?? []) {
    console.error(`  ${error.instancePath || '(root)'} ${error.message}`);
  }
  process.exit(1);
}

const result = importDesignBridge(input);
const validateBlueprint = ajv.getSchema(blueprintSchema.$id);
const schemaOk = validateBlueprint(result.blueprint);
const knownTypes = await buildKnownTypes({
  extensionPath: registryPath ? resolve(registryPath) : null,
  startDir: dirname(resolve(inputPath)),
});
const semanticErrors = schemaOk
  ? validateBlueprintSemantics(result.blueprint, { knownTypes: knownTypes.knownTypes })
  : [];
if (!schemaOk || semanticErrors.length > 0) {
  for (const error of validateBlueprint.errors ?? []) {
    console.error(`  ${error.instancePath || '(root)'} ${error.message}`);
  }
  for (const error of semanticErrors) console.error(`  semantic: ${error}`);
  process.exit(1);
}

await writeFile(resolve(outputPath), `${JSON.stringify(result.blueprint, null, 2)}\n`, 'utf8');
console.error(`✓ imported ${input.source.kind} frame ${input.source.frame_id} into ${outputPath}`);
console.error(`  ${result.blueprint.nodes.length} semantic nodes with complete source mapping`);
