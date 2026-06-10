#!/usr/bin/env node
// Lock a UI Blueprint into a frozen acceptance snapshot (plan §6.4).
// Usage: node scripts/lock-blueprint.mjs <input.ui.json> <output.ui.lock.json>
//
// The lock file contains SHA-256 hashes of structural subsets plus provenance.
// If any of these change after the lock is created, the design has drifted
// and agents should NOT silently apply the change.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node scripts/lock-blueprint.mjs <input.ui.json> <output.ui.lock.json>');
    process.exit(2);
  }
  const [inputPath, outputPath] = args;
  const blueprint = JSON.parse(await readFile(resolve(inputPath), 'utf8'));

  const sortedIds = [...blueprint.nodes.map((n) => n.id)].sort();
  const layoutSubset = blueprint.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    layout: n.layout ?? null,
    placements: n.placements ?? null,
  }));
  const treeSubset = blueprint.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    parent_id: n.parent_id,
    children: n.children ?? [],
  }));
  const interactionsSubset = blueprint.interactions ?? [];

  const lock = {
    $schema: 'https://github.com/HenryLau1103/AUB/schema/lock.schema.json',
    version: blueprint.version,
    source_file: inputPath,
    exported_at: new Date().toISOString(),
    source_editor_version: '0.3.0',
    hashes: {
      blueprint: sha256(stableStringify(blueprint)),
      node_ids: sha256(stableStringify(sortedIds)),
      layout: sha256(stableStringify(layoutSubset)),
      design_system: sha256(stableStringify(blueprint.design_system ?? null)),
      component_tree: sha256(stableStringify(treeSubset)),
      interactions: sha256(stableStringify(interactionsSubset)),
      acceptance: sha256(stableStringify(blueprint.acceptance ?? [])),
    },
    counts: {
      nodes: blueprint.nodes.length,
      interactions: (blueprint.interactions ?? []).length,
      responsive: (blueprint.responsive ?? []).length,
      acceptance: (blueprint.acceptance ?? []).length,
    },
  };

  await writeFile(resolve(outputPath), JSON.stringify(lock, null, 2) + '\n', 'utf8');
  console.error(`✓ wrote ${outputPath}`);
  for (const [k, v] of Object.entries(lock.hashes)) {
    console.error(`    ${k}: ${v.slice(0, 16)}...`);
  }
}

function sha256(s) {
  return 'sha256:' + createHash('sha256').update(s).digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
