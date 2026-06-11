#!/usr/bin/env node
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadValidators } from './schema.js';
import type { ServerContext } from './context.js';
import * as listBlueprints from './tools/list-blueprints.js';
import * as getBlueprint from './tools/get-blueprint.js';
import * as validateBlueprint from './tools/validate-blueprint.js';
import * as scaffoldBlueprint from './tools/scaffold-blueprint.js';
import * as exportPrompt from './tools/export-prompt.js';
import * as submitReport from './tools/submit-report.js';
import * as listProjects from './tools/list-projects.js';
import * as getProject from './tools/get-project.js';
import * as validateProject from './tools/validate-project.js';

function resolveWorkspaceRoot(): string {
  const fromArg = process.argv[2];
  const fromEnv = process.env.AUB_WORKSPACE;
  return resolve(fromArg ?? fromEnv ?? process.cwd());
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function fail(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

async function main(): Promise<void> {
  const root = resolveWorkspaceRoot();
  const validators = await loadValidators();
  const ctx: ServerContext = { root, validators };

  const server = new McpServer({ name: 'aub-mcp-server', version: '0.3.0' });

  server.registerTool(listBlueprints.name, listBlueprints.config, async () => {
    try {
      return ok(await listBlueprints.run(ctx));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(getBlueprint.name, getBlueprint.config, async (args) => {
    try {
      return ok(await getBlueprint.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(validateBlueprint.name, validateBlueprint.config, async (args) => {
    try {
      return ok(await validateBlueprint.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(scaffoldBlueprint.name, scaffoldBlueprint.config, async (args) => {
    try {
      return ok(await scaffoldBlueprint.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(exportPrompt.name, exportPrompt.config, async (args) => {
    try {
      return ok(await exportPrompt.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(submitReport.name, submitReport.config, async (args) => {
    try {
      return ok(await submitReport.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(listProjects.name, listProjects.config, async () => {
    try {
      return ok(await listProjects.run(ctx));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(getProject.name, getProject.config, async (args) => {
    try {
      return ok(await getProject.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool(validateProject.name, validateProject.config, async (args) => {
    try {
      return ok(await validateProject.run(ctx, args));
    } catch (error) {
      return fail(error);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`aub-mcp-server ready (workspace: ${root})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
