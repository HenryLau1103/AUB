// Single bridge to the repository's pure-function libraries in `scripts/`.
// All relative paths to scripts/*.lib.mjs live here so emitted dist depth stays predictable.
export { exportMarkdown } from '../../../scripts/export-md.lib.mjs';
export {
  exportAgentPrompt,
  supportedAgentAdapters,
  supportedAgentTasks,
} from '../../../scripts/export-agent-prompt.lib.mjs';
export { validateBlueprintSemantics } from '../../../scripts/validate-blueprint.lib.mjs';
export { buildKnownTypes } from '../../../scripts/registry.lib.mjs';
export { diffBlueprints } from '../../../scripts/diff-blueprint.lib.mjs';
export { migrateBlueprint } from '../../../scripts/migrate-blueprint.mjs';
export { createBlueprintLock } from '../../../scripts/lock-blueprint.lib.mjs';
export { createHandoffArchive } from '../../../scripts/handoff-package.lib.mjs';
export { importDesignBridge, DESIGN_BRIDGE_VERSION } from '../../../scripts/design-bridge.lib.mjs';
export { scaffoldBlueprint, SCAFFOLD_SECTIONS } from '../../../scripts/scaffold-blueprint.lib.mjs';
export {
  createImplementationReportTemplate,
  verifyImplementationReport,
} from '../../../scripts/implementation-report.lib.mjs';
export {
  loadProject,
  validateProjectSemantics,
  parseProjectText,
  mergeDesignSystem,
  PROJECT_VERSION,
} from '../../../scripts/project.lib.mjs';

export type Blueprint = Record<string, any>;
export type ImplementationReport = Record<string, any>;
export type Project = Record<string, any>;
