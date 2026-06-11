#!/usr/bin/env node
// TypeScript type-check test.
// Verifies schema/types.ts compiles and is structurally compatible with the JSON Schema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);
const ROOT = new URL('..', import.meta.url).pathname;

test('S3: tsc --noEmit on schema/types.ts produces zero errors', async () => {
  await exec('pnpm', ['typecheck'], { cwd: ROOT });
});

test('S4: schema/types.ts round-trips the example JSON via import-and-cast', async () => {
  // Create a temp tsconfig that includes the project's source files PLUS a probe.
  // This avoids passing --include (not a valid tsc CLI flag).
  const tmp = await mkdtemp(join(tmpdir(), 'aub-types-'));
  const probe = join(tmp, 'probe.ts');
  const probeTsconfig = join(tmp, 'tsconfig.json');
  const examplePath = new URL('../examples/dashboard.ui.json', import.meta.url).pathname;
  const typesPath = new URL('../schema/types.ts', import.meta.url).pathname;
  const rootTsconfig = new URL('../tsconfig.json', import.meta.url).pathname;

  const probeContent = `
import blueprint from ${JSON.stringify(examplePath)};
import type { Blueprint, Screen, InteractionTrigger, AcceptanceType, Viewport, ResolvedComponentType } from ${JSON.stringify(typesPath)};

const typed: Blueprint = blueprint as Blueprint;

// Touch every top-level field so the compiler verifies the shape.
const v: string = typed.version;
const st: Screen['type'] = typed.screen.type;
const vp: Viewport | undefined = typed.viewports[0];
if (vp) {
  const vpId: Viewport['id'] = vp.id;
}
  const node = typed.nodes[0];
  if (node) {
  const type: ResolvedComponentType = node.type;
  const trigger: InteractionTrigger | undefined = typed.interactions[0]?.trigger;
}
const a = typed.acceptance[0];
if (a) {
  const acceptanceType: AcceptanceType = a.type;
}
`;
  await writeFile(probe, probeContent, 'utf8');

  // Extend the project's tsconfig with the probe path.
  const base = JSON.parse(await readFile(rootTsconfig, 'utf8'));
  base.include = [...(base.include ?? []), probe];
  await writeFile(probeTsconfig, JSON.stringify(base, null, 2), 'utf8');

  const { stdout, stderr } = await exec(
    'pnpm',
    ['exec', 'tsc', '--noEmit', '--project', probeTsconfig],
    { cwd: ROOT }
  );
  if (stderr && !/Cannot find module/.test(stderr)) {
    assert.fail(`tsc stderr: ${stderr}`);
  }
  if (stdout && /error TS/.test(stdout)) {
    assert.fail(`tsc found type errors:\n${stdout}`);
  }
});
