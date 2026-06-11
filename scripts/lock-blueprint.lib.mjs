import { createHash } from 'node:crypto';

export function createBlueprintLock(
  blueprint,
  {
    sourceFile = '',
    exportedAt = new Date().toISOString(),
    sourceEditorVersion = '0.3.0',
  } = {}
) {
  const sortedIds = [...blueprint.nodes.map((node) => node.id)].sort();
  const layoutSubset = blueprint.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    layout: node.layout ?? null,
    placements: node.placements ?? null,
  }));
  const treeSubset = blueprint.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    parent_id: node.parent_id,
    children: node.children ?? [],
  }));

  return {
    $schema: 'https://henrylau1103.github.io/AUB/schema/ui-blueprint-lock.schema.json',
    version: blueprint.version,
    source_file: sourceFile,
    exported_at: exportedAt,
    source_editor_version: sourceEditorVersion,
    hashes: {
      blueprint: sha256(stableStringify(blueprint)),
      node_ids: sha256(stableStringify(sortedIds)),
      layout: sha256(stableStringify(layoutSubset)),
      design_system: sha256(stableStringify(blueprint.design_system ?? null)),
      component_tree: sha256(stableStringify(treeSubset)),
      interactions: sha256(stableStringify(blueprint.interactions ?? [])),
      acceptance: sha256(stableStringify(blueprint.acceptance ?? [])),
    },
    counts: {
      nodes: blueprint.nodes.length,
      interactions: (blueprint.interactions ?? []).length,
      responsive: (blueprint.responsive ?? []).length,
      acceptance: (blueprint.acceptance ?? []).length,
    },
  };
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}
