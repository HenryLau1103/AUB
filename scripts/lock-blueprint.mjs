#!/usr/bin/env node
// Lock a UI Blueprint into a frozen acceptance snapshot (plan §6.4).
// Usage: node scripts/lock-blueprint.mjs <input.ui.json> <output.ui.lock.json>
//
// The lock file contains SHA-256 hashes of structural subsets plus provenance.
// If any of these change after the lock is created, the design has drifted
// and agents should NOT silently apply the change.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBlueprintLock } from './lock-blueprint.lib.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node scripts/lock-blueprint.mjs <input.ui.json> <output.ui.lock.json>');
    process.exit(2);
  }
  const [inputPath, outputPath] = args;
  const blueprint = JSON.parse(await readFile(resolve(inputPath), 'utf8'));

  const lock = createBlueprintLock(blueprint, {
    sourceFile: inputPath,
  });

  await writeFile(resolve(outputPath), JSON.stringify(lock, null, 2) + '\n', 'utf8');
  console.error(`✓ wrote ${outputPath}`);
  for (const [k, v] of Object.entries(lock.hashes)) {
    console.error(`    ${k}: ${v.slice(0, 16)}...`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
