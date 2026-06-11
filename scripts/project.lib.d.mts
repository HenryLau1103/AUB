import type { Project, ProjectScreenRef, NavigationTrigger } from '../schema/project-types';
import type { Blueprint } from '../schema/types';

export const NAVIGATION_TRIGGERS: NavigationTrigger[];
export const PROJECT_VERSION: '0.1.0';

export function parseProjectText(text: string, filePath?: string): Project;

export function validateProjectSemantics(
  project: Project,
  options?: { screensById?: Map<string, Blueprint> }
): string[];

export function resolveScreenPath(projectFilePath: string, screenPath: string): string;

export function readBlueprintFile(absPath: string): Promise<Blueprint>;

export interface LoadedScreen {
  ref: ProjectScreenRef;
  path: string;
  blueprint: Blueprint | null;
}

export interface LoadedProject {
  project: Project;
  projectPath: string;
  screens: LoadedScreen[];
  screensById: Map<string, Blueprint>;
  errors: string[];
}

export function loadProject(projectPathArg: string): Promise<LoadedProject>;

export function mergeDesignSystem(
  project: Project,
  blueprint: Blueprint
): Record<string, unknown>;

export function buildProject(input: {
  id: string;
  name: string;
  description?: string;
  screens: Array<{ blueprint: Blueprint; path: string }>;
}): Project;
