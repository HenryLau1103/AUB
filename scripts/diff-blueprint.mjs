#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { diffBlueprints, renderBlueprintDiff } from './diff-blueprint.lib.mjs';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const files = args.filter((arg) => arg !== '--json');

if (files.length !== 2) {
  console.error('Usage: node scripts/diff-blueprint.mjs <before.ui.json|yaml> <after.ui.json|yaml> [--json]');
  process.exit(2);
}

const [before, after] = await Promise.all(files.map(readBlueprint));
const diff = diffBlueprints(before, after);
process.stdout.write(jsonOutput ? `${JSON.stringify(diff, null, 2)}\n` : renderBlueprintDiff(diff));

async function readBlueprint(path) {
  const text = await readFile(resolve(path), 'utf8');
  const extension = extname(path).toLowerCase();
  return extension === '.yaml' || extension === '.yml' ? yaml.load(text) : JSON.parse(text);
}
