// Pure helpers that derive the schema enums and TypeScript unions from the
// component registry. The registry (schema/registry/components.json) is the
// single source of truth; this module computes everything else from it.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const REGISTRY_PATH = resolve(ROOT, 'schema', 'registry', 'components.json');
export const SCHEMA_PATH = resolve(ROOT, 'schema', 'ui-blueprint.schema.json');
export const TYPES_PATH = resolve(ROOT, 'schema', 'types.ts');

export const TYPES_BEGIN = '// <generated:component-types>';
export const TYPES_END = '// </generated:component-types>';

export async function loadCoreRegistry() {
  return JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
}

/**
 * Flatten the registry into ordered type lists, preserving category and
 * in-category order so output is deterministic.
 */
export function computeTypeLists(registry) {
  const all = [];
  const containers = [];
  const leaves = [];
  for (const category of registry.categories ?? []) {
    for (const type of category.types ?? []) {
      all.push(type.name);
      if (type.isContainer) containers.push(type.name);
      else leaves.push(type.name);
    }
  }
  return { all, containers, leaves };
}

/** Group type names by registry category for readable, stable rendering. */
function typesByCategory(registry) {
  return (registry.categories ?? []).map((category) => ({
    id: category.id,
    names: (category.types ?? []).map((t) => t.name),
  }));
}

function renderUnionLines(groups, indent = '  ') {
  return groups
    .filter((g) => g.names.length > 0)
    .map((g) => `${indent}| ${g.names.map((n) => `'${n}'`).join(' | ')}`)
    .join('\n');
}

/** Produce the generated TypeScript block (between the sentinel markers). */
export function renderTypesSection(registry) {
  const groups = typesByCategory(registry);
  const lists = computeTypeLists(registry);
  const containerGroups = (registry.categories ?? []).map((category) => ({
    id: category.id,
    names: (category.types ?? []).filter((t) => t.isContainer).map((t) => t.name),
  }));

  const componentUnion = renderUnionLines(groups);
  const containerUnion = renderUnionLines(containerGroups, '    ');

  return [
    TYPES_BEGIN,
    '/** Semantic component type — agents read this to know WHAT a node is. */',
    'export type ComponentType =',
    `${componentUnion};`,
    '',
    'export type ContainerComponentType = Extract<',
    '  ComponentType,',
    `${containerUnion}`,
    '>;',
    '',
    'export type LeafComponentType = Exclude<ComponentType, ContainerComponentType>;',
    TYPES_END,
  ].join('\n');
}

/**
 * Return a new schema object with the generated core-type enums populated from
 * the registry. Does not mutate the input.
 */
export function applyEnumsToSchema(schema, lists) {
  const next = structuredClone(schema);
  const defs = next.$defs ?? {};
  if (!defs.coreComponentType || !defs.coreContainerComponentType || !defs.coreLeafComponentType) {
    throw new Error(
      'schema is missing coreComponentType / coreContainerComponentType / coreLeafComponentType $defs'
    );
  }
  defs.coreComponentType.enum = [...lists.all];
  defs.coreContainerComponentType.enum = [...lists.containers];
  defs.coreLeafComponentType.enum = [...lists.leaves];
  return next;
}

export function serializeSchema(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

/** Replace the generated block of an existing types.ts source string. */
export function replaceTypesSection(source, generatedBlock) {
  const start = source.indexOf(TYPES_BEGIN);
  const end = source.indexOf(TYPES_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `types.ts is missing the generated markers ${TYPES_BEGIN} / ${TYPES_END}`
    );
  }
  const before = source.slice(0, start);
  const after = source.slice(end + TYPES_END.length);
  return `${before}${generatedBlock}${after}`;
}
