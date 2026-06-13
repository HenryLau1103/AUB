/**
 * UI Blueprint Project TypeScript types.
 *
 * These types are the TypeScript surface of `ui-project.schema.json`.
 * They are hand-maintained to match the schema field-for-field.
 *
 * Synchronization rule: when the JSON Schema changes, update these types in
 * the same commit. A validation test in `tests/project.test.mjs` round-trips
 * the example project through both surfaces to catch drift.
 *
 * Source of truth: `schema/ui-project.schema.json`
 */

import type { SemVer } from './types';

/** Project schema version track. Independent from the Blueprint schema version. */
export type ProjectVersion = '0.1.0';

/** What causes a navigation between screens. */
export type NavigationTrigger =
  | 'click'
  | 'submit'
  | 'change'
  | 'load'
  | 'system'
  | 'gesture';

/** Reference to a member single-screen Blueprint file. */
export interface ProjectScreenRef {
  /** Screen identifier. MUST match the referenced Blueprint's screen.id. */
  id: string;
  /** Optional display name. Defaults to the referenced Blueprint's screen.name. */
  name?: string;
  /** Relative path from the project file to a .ui.json/.ui.yaml Blueprint; runtime loaders require it to stay inside the active workspace. */
  path: string;
}

/** Directed navigation edge between two screens. */
export interface NavigationEdge {
  /** Source screen id (must be a declared screen). */
  from: string;
  /** Destination screen id (must be a declared screen). */
  to: string;
  /** What causes the navigation. */
  trigger?: NavigationTrigger;
  /** Optional id of the source-screen interaction that triggers this navigation. */
  interaction_id?: string;
  /** Optional human-readable label for the edge. */
  label?: string;
}

/** Top-level multi-screen project document. */
export interface Project {
  /** Semantic version of the project schema this document conforms to. */
  version: ProjectVersion & SemVer;
  /** Unique project identifier. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Optional summary of the product or flow. */
  description?: string;
  /** Member screens. At least one required. */
  screens: ProjectScreenRef[];
  /** Screen id where the flow starts. MUST match a declared screen. */
  entry_screen: string;
  /** Directed navigation edges between screens. */
  navigation?: NavigationEdge[];
  /** Optional project-level shared design tokens; member screens may override. */
  design_system?: Record<string, unknown>;
  /** Optional metadata about how this project document was produced. */
  provenance?: Record<string, unknown>;
}
