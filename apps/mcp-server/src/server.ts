import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerContext } from './context.js';
import * as listBlueprints from './tools/list-blueprints.js';
import * as getBlueprint from './tools/get-blueprint.js';
import * as validateBlueprint from './tools/validate-blueprint.js';
import * as scaffoldBlueprint from './tools/scaffold-blueprint.js';
import * as importDesignBridge from './tools/import-design-bridge.js';
import * as writeBlueprint from './tools/write-blueprint.js';
import * as exportPrompt from './tools/export-prompt.js';
import * as exportHandoff from './tools/export-handoff.js';
import * as submitReport from './tools/submit-report.js';
import * as listProjects from './tools/list-projects.js';
import * as getProject from './tools/get-project.js';
import * as validateProject from './tools/validate-project.js';
import * as resolveComponent from './tools/resolve-component.js';
import * as diffBlueprints from './tools/diff-blueprints.js';
import * as migrateBlueprint from './tools/migrate-blueprint.js';
import * as lockBlueprint from './tools/lock-blueprint.js';
import * as getAubSession from './tools/get-aub-session.js';
import * as updateAubSession from './tools/update-aub-session.js';
import * as getWorkspaceStatus from './tools/get-workspace-status.js';
import * as scanProjectUi from './tools/scan-project-ui.js';
import * as generateTemplateFromSource from './tools/generate-template-from-source.js';
import * as approveComponentCandidate from './tools/approve-component-candidate.js';
import * as exportTemplateAuthoringPrompt from './tools/export-template-authoring-prompt.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
type ToolModule = {
  name: string;
  config: Record<string, unknown>;
  run: (ctx: ServerContext, args: any) => Promise<unknown>;
};

const tools: ToolModule[] = [
  listBlueprints,
  getBlueprint,
  validateBlueprint,
  scaffoldBlueprint,
  importDesignBridge,
  writeBlueprint,
  exportPrompt,
  exportHandoff,
  submitReport,
  listProjects,
  getProject,
  validateProject,
  resolveComponent,
  diffBlueprints,
  migrateBlueprint,
  lockBlueprint,
  getAubSession,
  updateAubSession,
  getWorkspaceStatus,
  scanProjectUi,
  generateTemplateFromSource,
  approveComponentCandidate,
  exportTemplateAuthoringPrompt,
];

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function fail(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

export function createAubServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: 'aub-mcp-server', version: '0.3.0' });
  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, async (args) => {
      try {
        return ok(await tool.run(ctx, args));
      } catch (error) {
        return fail(error);
      }
    });
  }
  return server;
}

export function registeredToolNames(): string[] {
  return tools.map((tool) => tool.name);
}

export async function runAubTool(ctx: ServerContext, name: string, args: any = {}): Promise<unknown> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Unknown AUB tool "${name}". Available: ${registeredToolNames().join(', ')}.`);
  }
  return tool.run(ctx, args);
}
