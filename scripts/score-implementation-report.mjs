#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { scoreImplementationSafety } from './implementation-report.lib.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const positional = args.filter((arg) => !arg.startsWith('--'));
const [blueprintPath, reportPath] = positional;

if (!blueprintPath || !reportPath) {
  console.error('Usage: node scripts/score-implementation-report.mjs <blueprint.ui.json|yaml> <report.json> [--write]');
  process.exit(2);
}

const [blueprint, report] = await Promise.all([
  readBlueprint(blueprintPath),
  readFile(resolve(reportPath), 'utf8').then(JSON.parse),
]);
const score = scoreImplementationSafety(blueprint, report);

if (write) {
  report.safety_score = score;
  await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(`✓ wrote safety_score to ${reportPath}`);
}

console.log(JSON.stringify(score, null, 2));

async function readBlueprint(path) {
  const text = await readFile(resolve(path), 'utf8');
  const extension = extname(path).toLowerCase();
  return extension === '.yaml' || extension === '.yml' ? yaml.load(text) : JSON.parse(text);
}
