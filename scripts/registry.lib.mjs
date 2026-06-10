// Resolves the set of known component types for validation: core types from the
// curated registry plus optional project-defined extension types declared in an
// aub.registry.json file. Extension types are namespaced (team:component) so they
// never collide with core snake_case types and are always explicit — agents still
// resolve them, they are never free-guessed.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { loadCoreRegistry, computeTypeLists } from './generate-registry-artifacts.lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const EXTENSION_REGISTRY_FILENAME = 'aub.registry.json';
export const EXTENSION_NAME_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9_]*$/;

/** Build a Map<typeName, { isContainer, source }> for the core registry. */
export async function buildCoreKnownTypes() {
  const registry = await loadCoreRegistry();
  const known = new Map();
  for (const category of registry.categories ?? []) {
    for (const type of category.types ?? []) {
      known.set(type.name, { isContainer: Boolean(type.isContainer), source: 'core' });
    }
  }
  return known;
}

/**
 * Walk up from startDir looking for an aub.registry.json. Stops at the filesystem
 * root or after a generous depth. Returns the absolute path or null.
 */
export function discoverExtensionRegistry(startDir = process.cwd()) {
  let dir = resolve(startDir);
  for (let i = 0; i < 64; i += 1) {
    const candidate = join(dir, EXTENSION_REGISTRY_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Validate and normalize an extension registry document. Returns
 * { components: [{ name, isContainer, description }] }. Throws on malformed input.
 */
export function parseExtensionRegistry(doc, coreTypes, sourceLabel = EXTENSION_REGISTRY_FILENAME) {
  if (!doc || typeof doc !== 'object') {
    throw new Error(`${sourceLabel}: must be a JSON object`);
  }
  const components = doc.components;
  if (!Array.isArray(components)) {
    throw new Error(`${sourceLabel}: missing required "components" array`);
  }
  const seen = new Set();
  const normalized = [];
  for (const entry of components) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${sourceLabel}: each component must be an object`);
    }
    const { name } = entry;
    if (typeof name !== 'string' || !EXTENSION_NAME_PATTERN.test(name)) {
      throw new Error(
        `${sourceLabel}: component name "${String(name)}" must match team:component (e.g. acme:data_card)`
      );
    }
    if (coreTypes.has(name)) {
      throw new Error(`${sourceLabel}: extension "${name}" collides with a core component type`);
    }
    if (seen.has(name)) {
      throw new Error(`${sourceLabel}: duplicate extension component "${name}"`);
    }
    if (typeof entry.isContainer !== 'boolean') {
      throw new Error(`${sourceLabel}: extension "${name}" must declare isContainer (boolean)`);
    }
    seen.add(name);
    normalized.push({
      name,
      isContainer: entry.isContainer,
      description: typeof entry.description === 'string' ? entry.description : '',
    });
  }
  return { components: normalized };
}

/**
 * Resolve the full known-type map: core types plus any extension types. Discovery
 * order: explicit extensionPath > auto-discovered file from startDir. Pass
 * { extensionPath: null, discover: false } to use core types only.
 */
export async function buildKnownTypes({ extensionPath, startDir = process.cwd(), discover = true } = {}) {
  const known = await buildCoreKnownTypes();
  const coreTypes = new Set(known.keys());

  let path = extensionPath ?? null;
  if (!path && discover) path = discoverExtensionRegistry(startDir);
  if (!path) return { knownTypes: known, extensionPath: null, extensions: [] };

  const raw = await readFile(path, 'utf8');
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path}: invalid JSON (${err.message})`);
  }
  const { components } = parseExtensionRegistry(doc, coreTypes, path);
  for (const component of components) {
    known.set(component.name, { isContainer: component.isContainer, source: 'extension' });
  }
  return { knownTypes: known, extensionPath: path, extensions: components };
}

/** Convenience: the ordered core type lists (re-exported for callers/tests). */
export async function coreTypeLists() {
  return computeTypeLists(await loadCoreRegistry());
}

export { ROOT as REPO_ROOT };
