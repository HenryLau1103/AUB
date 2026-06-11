#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, relative, sep } from 'node:path';
import yaml from 'js-yaml';

const args = process.argv.slice(2);
const workspace = resolve(valueAfter(args, '--workspace') ?? process.cwd());
const blueprintPath = valueAfter(args, '--blueprint');
const url = valueAfter(args, '--url');
const output = valueAfter(args, '--output');

if (!blueprintPath || !url) {
  console.error('Usage: node scripts/create-playwright-smoke.mjs --workspace <app> --blueprint <screen.ui.json|yaml> --url <preview-url> [--output <spec.ts>]');
  process.exit(2);
}

const blueprint = await readBlueprint(resolveInside(workspace, blueprintPath));
const source = buildPlaywrightSpec(blueprint, url);

if (output) {
  const outputPath = resolveInside(workspace, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, 'utf8');
  console.error(`✓ wrote ${relativePath(workspace, outputPath)}`);
} else {
  process.stdout.write(source);
}

export function buildPlaywrightSpec(blueprint, url) {
  const screenName = JSON.stringify(blueprint.screen?.name ?? blueprint.screen?.id ?? 'AUB screen');
  const nodeIds = (Array.isArray(blueprint.nodes) ? blueprint.nodes : []).map((node) => node.id).filter(Boolean);
  const viewports = (Array.isArray(blueprint.viewports) ? blueprint.viewports : [])
    .filter((viewport) => viewport?.id && Number(viewport.width) > 0 && Number(viewport.height) > 0);
  const acceptanceIds = (Array.isArray(blueprint.acceptance) ? blueprint.acceptance : []).map((item) => item.id).filter(Boolean);
  return [
    "import { expect, test } from '@playwright/test';",
    '',
    `const routeUrl = ${JSON.stringify(url)};`,
    `const nodeIds = ${JSON.stringify(nodeIds, null, 2)};`,
    `const acceptanceIds = ${JSON.stringify(acceptanceIds, null, 2)};`,
    '',
    `test.describe(${screenName}, () => {`,
    ...viewports.flatMap((viewport) => [
      `  test('${viewport.id}: renders without horizontal overflow', async ({ page }) => {`,
      `    await page.setViewportSize({ width: ${viewport.width}, height: ${viewport.height} });`,
      '    await page.goto(routeUrl);',
      '    await page.waitForLoadState(\'networkidle\');',
      '    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);',
      '    expect(horizontalOverflow).toBe(false);',
      '    const mappedNodes = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-aub-node="${id}"]`)).length, nodeIds);',
      '    expect(mappedNodes).toBeGreaterThan(0);',
      '  });',
    ]),
    '',
    "  test('records AUB acceptance ids for report evidence', async () => {",
    '    expect(acceptanceIds.length).toBeGreaterThan(0);',
    '  });',
    '});',
    '',
  ].join('\n');
}

async function readBlueprint(path) {
  const text = await readFile(path, 'utf8');
  const extension = extname(path).toLowerCase();
  return extension === '.yaml' || extension === '.yml' ? yaml.load(text) : JSON.parse(text);
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function resolveInside(root, path) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('/')) {
    throw new Error(`Path must stay inside the workspace root: ${path}`);
  }
  return absolute;
}

function relativePath(root, path) {
  return relative(root, path).split(sep).join('/');
}
