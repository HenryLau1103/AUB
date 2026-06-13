export interface KnownTypeMeta {
  isContainer: boolean;
  source?: string;
  description?: string;
  implementations?: ComponentImplementation[];
}

export type KnownTypes = Map<string, KnownTypeMeta>;

export interface ExtensionComponent {
  name: string;
  isContainer: boolean;
  description: string;
  implementations: ComponentImplementation[];
}

export interface ComponentImplementation {
  id: string;
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'web-component' | 'html' | 'other';
  module: string;
  export?: string;
  importStyle: 'named' | 'default' | 'namespace' | 'side-effect' | 'custom-element';
  sourcePath?: string;
  storybookUrl?: string;
  docsUrl?: string;
  props?: Record<string, { from: string; required?: boolean; description?: string }>;
  notes?: string;
}

export interface BuildKnownTypesResult {
  knownTypes: KnownTypes;
  extensionPath: string | null;
  extensions: ExtensionComponent[];
}

export const EXTENSION_REGISTRY_FILENAME: string;
export const EXTENSION_NAME_PATTERN: RegExp;
export const REPO_ROOT: string;

export function buildCoreKnownTypes(): Promise<KnownTypes>;
export function discoverExtensionRegistry(startDir?: string): string | null;
export function discoverWorkspaceExtensionRegistry(workspaceRoot: string, startDir?: string): string | null;
export function parseExtensionRegistry(
  doc: unknown,
  coreTypes: Set<string>,
  sourceLabel?: string
): { components: ExtensionComponent[] };
export function buildKnownTypes(options?: {
  extensionPath?: string | null;
  startDir?: string;
  discover?: boolean;
}): Promise<BuildKnownTypesResult>;
export function coreTypeLists(): Promise<{ all: string[]; containers: string[]; leaves: string[] }>;
