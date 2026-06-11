/// <reference types="vite/client" />

// Type declarations for un-typed sibling scripts imported by the editor.
// Vite bundles the actual .mjs files; this file is purely for type checking.

declare module '*/export-md.lib.mjs' {
  import type { Blueprint } from './types';
  export function exportMarkdown(blueprint: Blueprint): string;
}

declare module '*/export-agent-prompt.lib.mjs' {
  import type { Blueprint } from './types';
  export function exportAgentPrompt(
    blueprint: Blueprint,
    options?: {
      adapter?: 'generic' | 'codex' | 'claude-code';
      task?: 'implement' | 'plan' | 'review' | 'author';
    }
  ): string;
}

declare module '*/implementation-report.lib.mjs' {
  import type { Blueprint } from './types';
  export function createImplementationReportTemplate(blueprint: Blueprint): Record<string, unknown>;
}

declare module '*/handoff-package.lib.mjs' {
  import type { Blueprint } from './types';
  export function createHandoffArchive(input: {
    blueprint: Blueprint;
    markdown: string;
    genericPrompt: string;
    codexPrompt: string;
    agentGuide: string;
    agentGuideZhHant: string;
    reportTemplate: Record<string, unknown>;
    reportSchema: Record<string, unknown>;
    viewportImages: Record<string, string>;
    extensionRegistry?: string;
    generatedAt?: string;
  }): Promise<{
    bytes: Uint8Array;
    manifest: Record<string, unknown>;
  }>;
}

declare module '*/design-bridge.lib.mjs' {
  import type { Blueprint } from './types';
  export function importDesignBridge(input: unknown): {
    blueprint: Blueprint;
    source: Record<string, unknown>;
    sourceMap: Record<string, unknown>;
  };
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare module '*/migrate-blueprint.mjs' {
  import type { Blueprint } from './types';
  export function migrateBlueprint(input: unknown): Blueprint;
  export function defaultDesignSystem(): NonNullable<Blueprint['design_system']>;
  export const CURRENT_VERSION: string;
}

declare module '*/validate-blueprint.lib.mjs' {
  import type { Blueprint, Placement, UINode, ViewportId } from './types';
  export function validateBlueprintSemantics(blueprint: Blueprint): string[];
  export function resolvePlacement(node: UINode, viewportId: ViewportId): Placement | null;
}

declare module '*/drag-intent.mjs' {
  export function directDragMode(input: {
    altKey: boolean;
    currentParentId: string | null;
    destinationId: string | null;
  }): 'move' | 'reparent';
}

declare module '*/angular-importer.lib.mjs' {
  export function discoverAngularComponents(input: unknown): unknown[];
  export function importAngularComponent(input: unknown, options?: { entry?: string }): Promise<unknown>;
}
