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
export { scaffoldBlueprint, SCAFFOLD_SECTIONS } from '../../../scripts/scaffold-blueprint.lib.mjs';
export {
  createImplementationReportTemplate,
  verifyImplementationReport,
} from '../../../scripts/implementation-report.lib.mjs';

export type Blueprint = Record<string, any>;
export type ImplementationReport = Record<string, any>;
