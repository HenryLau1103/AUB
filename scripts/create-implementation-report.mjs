#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { createImplementationReportTemplate } from './implementation-report.lib.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error('Usage: node scripts/create-implementation-report.mjs <blueprint.ui.json|yaml> [report.json]');
  process.exit(2);
}

const text = await readFile(resolve(inputPath), 'utf8');
const extension = extname(inputPath).toLowerCase();
const blueprint = extension === '.yaml' || extension === '.yml' ? yaml.load(text) : JSON.parse(text);
const output = `${JSON.stringify(createImplementationReportTemplate(blueprint), null, 2)}\n`;

if (outputPath && outputPath !== '-') {
  await writeFile(resolve(outputPath), output, 'utf8');
  console.error(`✓ wrote ${outputPath}`);
} else {
  process.stdout.write(output);
}
