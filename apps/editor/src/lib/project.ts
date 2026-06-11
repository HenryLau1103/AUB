// Pure, browser-safe project model for the editor.
// NOTE: never import scripts/project.lib.mjs here — it pulls in node:fs/promises
// and would break Vite. Only TYPE imports from the schema package are allowed
// (they are erased at compile time).

import type {
  Project,
  ProjectScreenRef,
  NavigationEdge,
  NavigationTrigger,
} from '../../../../schema/project-types';
import type { Blueprint } from '../types';

export type { Project, ProjectScreenRef, NavigationEdge, NavigationTrigger };

export const NAV_TRIGGERS: NavigationTrigger[] = [
  'click',
  'submit',
  'change',
  'load',
  'system',
  'gesture',
];

export interface EditorScreen {
  id: string;
  name: string;
  path: string;
  blueprint: Blueprint;
}

export interface EditorProject {
  id: string;
  name: string;
  description?: string;
  entryScreenId: string;
  navigation: NavigationEdge[];
  designSystem?: Record<string, unknown>;
  screens: EditorScreen[];
}

/** Parse a `*.aub.project.json` document. Project files are JSON in the editor. */
export function parseProjectDocument(text: string): Project {
  return JSON.parse(text) as Project;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

/**
 * Resolve a project document against a map of available Blueprints keyed by
 * filename (basename). Unresolved screen paths are collected in `missing`.
 */
export function buildEditorProject(
  doc: Project,
  blueprintsByFilename: Map<string, Blueprint>
): { project: EditorProject; missing: string[] } {
  const missing: string[] = [];
  const screens: EditorScreen[] = [];
  for (const ref of doc.screens) {
    const blueprint = blueprintsByFilename.get(basename(ref.path));
    if (!blueprint) {
      missing.push(ref.path);
      continue;
    }
    screens.push({
      id: ref.id,
      name: ref.name ?? blueprint.screen.name,
      path: ref.path,
      blueprint,
    });
  }
  const project: EditorProject = {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    entryScreenId: doc.entry_screen,
    navigation: doc.navigation ? doc.navigation.map((edge) => ({ ...edge })) : [],
    designSystem: doc.design_system,
    screens,
  };
  return { project, missing };
}

/** Serialize an editor project back into an on-disk project document. */
export function toProjectDocument(project: EditorProject): Project {
  const screens: ProjectScreenRef[] = project.screens.map((screen) => ({
    id: screen.id,
    name: screen.name,
    path: screen.path,
  }));
  const doc: Project = {
    version: '0.1.0',
    id: project.id,
    name: project.name,
    screens,
    entry_screen: project.entryScreenId,
  };
  if (project.description) doc.description = project.description;
  if (project.navigation.length) doc.navigation = project.navigation.map((edge) => ({ ...edge }));
  if (project.designSystem) doc.design_system = project.designSystem;
  return doc;
}

function kebab(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'screen';
}

/** Wrap a single Blueprint into a one-screen project. */
export function createProjectFromBlueprint(blueprint: Blueprint): EditorProject {
  const screenId = blueprint.screen.id;
  const slug = kebab(screenId);
  const screen: EditorScreen = {
    id: screenId,
    name: blueprint.screen.name,
    path: `${slug}.ui.json`,
    blueprint,
  };
  return {
    id: `${slug}-project`,
    name: blueprint.screen.name,
    entryScreenId: screenId,
    navigation: [],
    screens: [screen],
  };
}

/** Pure validation mirroring the backend checks. Returns human-readable warnings. */
export function validateProjectModel(project: EditorProject): string[] {
  const issues: string[] = [];
  const ids = project.screens.map((screen) => screen.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`Duplicate screen id: ${id}`);
    seen.add(id);
  }
  if (project.screens.length === 0) {
    issues.push('Project has no screens.');
  }
  if (!seen.has(project.entryScreenId)) {
    issues.push(`Entry screen "${project.entryScreenId}" is not a declared screen.`);
  }
  const triggers = new Set<string>(NAV_TRIGGERS);
  for (const edge of project.navigation) {
    if (!seen.has(edge.from)) issues.push(`Navigation source "${edge.from}" is not a declared screen.`);
    if (!seen.has(edge.to)) issues.push(`Navigation target "${edge.to}" is not a declared screen.`);
    if (edge.trigger && !triggers.has(edge.trigger)) {
      issues.push(`Navigation trigger "${edge.trigger}" is not a known trigger.`);
    }
  }
  return issues;
}
