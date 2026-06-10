#!/usr/bin/env node

import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import yaml from 'js-yaml';
import reportSchema from '../schema/implementation-report.schema.json' with { type: 'json' };
import { verifyImplementationReport } from './implementation-report.lib.mjs';

const [blueprintPath, reportPath] = process.argv.slice(2);
if (!blueprintPath || !reportPath) {
  console.error('Usage: node scripts/verify-implementation-report.mjs <blueprint.ui.json|yaml> <report.json>');
  process.exit(2);
}

const [blueprint, report] = await Promise.all([
  readBlueprint(blueprintPath),
  readFile(resolve(reportPath), 'utf8').then(JSON.parse),
]);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(reportSchema);
if (!validate(report)) {
  for (const error of validate.errors ?? []) {
    console.error(`✗ ${error.instancePath || '(root)'} ${error.message}`);
  }
  process.exit(1);
}

const result = verifyImplementationReport(blueprint, report);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ready ? 0 : 1);

async function readBlueprint(path) {
  const text = await readFile(resolve(path), 'utf8');
  const extension = extname(path).toLowerCase();
  return extension === '.yaml' || extension === '.yml' ? yaml.load(text) : JSON.parse(text);
}
