// Pure-ish library for reference-based multi-screen AUB projects.
//
// A project document (*.aub.project.json) lists member single-screen Blueprint
// files by relative path, declares a navigation graph between them, names an
// entry screen, and optionally carries project-level shared design tokens.
//
// This module keeps the *semantic* validation pure (no IO), and isolates file
// resolution into clearly-named async helpers so callers (CLI/MCP) can load a
// project and its member screens. It never mutates inputs.

import { readFile } from 'node:fs/promises';
import { extname, dirname, resolve, isAbsolute } from 'node:path';
import yaml from 'js-yaml';

export const NAVIGATION_TRIGGERS = ['click', 'submit', 'change', 'load', 'system', 'gesture'];
export const PROJECT_VERSION = '0.1.0';

/** Parse a project document from text by extension (.json or .yaml/.yml). */
export function parseProjectText(text, filePath = 'project') {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(text);
  }
  return JSON.parse(text);
}

/**
 * Validate project-level semantic rules that JSON Schema cannot express.
 * Pure: takes the parsed project plus an optional map of loaded member
 * blueprints (id -> blueprint) to cross-check screen.id consistency.
 *
 * Returns an array of human-readable error strings (empty = valid).
 */
export function validateProjectSemantics(project, { screensById } = {}) {
  const errors = [];
  const screens = Array.isArray(project?.screens) ? project.screens : [];

  const ids = new Set();
  const paths = new Set();
  for (const screen of screens) {
    if (!screen || typeof screen !== 'object') {
      errors.push('screens[] contains a non-object entry');
      continue;
    }
    if (ids.has(screen.id)) {
      errors.push(`duplicate screen id: ${screen.id}`);
    }
    ids.add(screen.id);
    if (screen.path) {
      const normalized = String(screen.path);
      if (paths.has(normalized)) {
        errors.push(`duplicate screen path: ${normalized}`);
      }
      paths.add(normalized);
    }
  }

  if (project?.entry_screen != null && !ids.has(project.entry_screen)) {
    errors.push(`entry_screen "${project.entry_screen}" is not a declared screen`);
  }

  const edges = Array.isArray(project?.navigation) ? project.navigation : [];
  edges.forEach((edge, index) => {
    if (!edge || typeof edge !== 'object') {
      errors.push(`navigation[${index}] is not an object`);
      return;
    }
    if (!ids.has(edge.from)) {
      errors.push(`navigation[${index}].from "${edge.from}" is not a declared screen`);
    }
    if (!ids.has(edge.to)) {
      errors.push(`navigation[${index}].to "${edge.to}" is not a declared screen`);
    }
    if (edge.trigger != null && !NAVIGATION_TRIGGERS.includes(edge.trigger)) {
      errors.push(`navigation[${index}].trigger "${edge.trigger}" is not a known trigger`);
    }
  });

  if (screensById) {
    for (const screen of screens) {
      const blueprint = screensById.get(screen.id);
      if (!blueprint) continue;
      const realId = blueprint?.screen?.id;
      if (realId && realId !== screen.id) {
        errors.push(
          `screen "${screen.id}" references a Blueprint whose screen.id is "${realId}" (id mismatch)`
        );
      }
    }
  }

  return errors;
}

/** Resolve a member screen path relative to the project file directory. */
export function resolveScreenPath(projectFilePath, screenPath) {
  if (isAbsolute(screenPath)) return screenPath;
  return resolve(dirname(projectFilePath), screenPath);
}

/** Read and parse a single Blueprint file (json or yaml). */
export async function readBlueprintFile(absPath) {
  const raw = await readFile(absPath, 'utf8');
  const ext = extname(absPath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(raw);
  }
  return JSON.parse(raw);
}

/**
 * Load a project file and all of its member screens from disk.
 * Returns { project, projectPath, screens: [{ ref, path, blueprint }], screensById }.
 * Missing member files are reported via the `errors` array rather than thrown,
 * so callers can surface every problem at once.
 */
export async function loadProject(projectPathArg) {
  const projectPath = resolve(projectPathArg);
  const raw = await readFile(projectPath, 'utf8');
  const project = parseProjectText(raw, projectPath);

  const screens = [];
  const screensById = new Map();
  const errors = [];

  for (const ref of project?.screens ?? []) {
    const memberPath = resolveScreenPath(projectPath, ref.path);
    try {
      const blueprint = await readBlueprintFile(memberPath);
      screens.push({ ref, path: memberPath, blueprint });
      screensById.set(ref.id, blueprint);
    } catch (err) {
      errors.push(`screen "${ref.id}": cannot read ${ref.path} (${err.message})`);
      screens.push({ ref, path: memberPath, blueprint: null });
    }
  }

  return { project, projectPath, screens, screensById, errors };
}

/**
 * Merge project-level shared design_system with a member screen's own
 * design_system (screen overrides win). Shallow merge at the top level; pure.
 */
export function mergeDesignSystem(project, blueprint) {
  const shared = project?.design_system ?? {};
  const own = blueprint?.design_system ?? {};
  return { ...shared, ...own };
}

/**
 * Build a project document that wraps a set of existing single-screen
 * Blueprints. Pure: caller supplies the already-loaded screens with their
 * relative paths. The first screen becomes the entry by default.
 */
export function buildProject({ id, name, description, screens }) {
  if (!Array.isArray(screens) || screens.length === 0) {
    throw new Error('buildProject requires at least one screen');
  }
  const screenRefs = screens.map(({ blueprint, path }) => ({
    id: blueprint?.screen?.id,
    name: blueprint?.screen?.name,
    path,
  }));
  return {
    $schema: '../schema/ui-project.schema.json',
    version: PROJECT_VERSION,
    id,
    name,
    ...(description ? { description } : {}),
    screens: screenRefs,
    entry_screen: screenRefs[0].id,
    navigation: [],
  };
}
