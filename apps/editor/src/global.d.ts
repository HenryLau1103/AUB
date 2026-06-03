// Type declarations for un-typed sibling scripts imported by the editor.
// Vite bundles the actual .mjs files; this file is purely for type checking.

declare module '*/export-md.lib.mjs' {
  import type { Blueprint } from './types';
  export function exportMarkdown(blueprint: Blueprint): string;
}
