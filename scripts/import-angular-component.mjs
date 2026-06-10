#!/usr/bin/env node

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { importAngularComponent } from './angular-importer.lib.mjs';

const args = process.argv.slice(2);
const options = parseArgs(args);
if (options.sources.length === 0 || !options.output) {
  console.error('Usage: pnpm import:angular -- <file-or-directory...> --output screen.ui.json [--entry app-selector]');
  process.exit(2);
}

const cwd = process.cwd();
const sourcePaths = await expandSources(options.sources);
const files = await Promise.all(sourcePaths.map(async (path) => ({
  path: relative(commonBase(sourcePaths), path).replace(/\\/g, '/'),
  content: await readFile(path, 'utf8'),
})));
const result = await importAngularComponent(files, { entry: options.entry });
await writeFile(resolve(options.output), `${JSON.stringify(result.blueprint, null, 2)}\n`, 'utf8');

const warnings = result.diagnostics.filter((item) => item.severity === 'warning').length;
console.error(`✓ imported ${files.length} files into ${options.output}`);
console.error(`  ${result.blueprint.nodes.length} nodes, ${result.blueprint.interactions.length} interactions, ${warnings} warnings`);

function parseArgs(values) {
  const result = { sources: [], entry: undefined, output: undefined };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--entry') result.entry = values[++index];
    else if (values[index] === '--output' || values[index] === '-o') result.output = values[++index];
    else result.sources.push(values[index]);
  }
  return result;
}

async function expandSources(sources) {
  const result = [];
  for (const source of sources) {
    const path = resolve(cwd, source);
    const info = await stat(path);
    if (info.isDirectory()) result.push(...await walk(path));
    else if (isSource(path)) result.push(path);
  }
  return [...new Set(result)].sort();
}

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (isSource(path)) result.push(path);
  }
  return result;
}

function isSource(path) {
  return ['.html', '.scss', '.css', '.ts'].includes(extname(path).toLowerCase())
    && !/\.spec\.ts$/i.test(path);
}

function commonBase(paths) {
  if (paths.length === 1) return resolve(paths[0], '..');
  const parts = paths.map((path) => resolve(path).split('/'));
  const common = [];
  for (let index = 0; index < Math.min(...parts.map((value) => value.length)); index += 1) {
    if (parts.every((value) => value[index] === parts[0][index])) common.push(parts[0][index]);
    else break;
  }
  return common.join('/') || '/';
}
