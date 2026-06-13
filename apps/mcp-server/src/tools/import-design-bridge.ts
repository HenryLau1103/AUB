import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import {
  importDesignBridge,
  resolveKnownTypesForBlueprint,
  validateBlueprintSemantics,
} from '../aub.js';
import { formatAjvErrors } from '../schema.js';
import { resolveExistingWorkspacePath } from '../workspace.js';

export const name = 'import_design_bridge';

const inputSchema = {
  path: z
    .string()
    .optional()
    .describe('Path inside the workspace to a Figma/Penpot .aub.bridge.json document.'),
  bridge: z
    .record(z.any())
    .optional()
    .describe('Inline Design Bridge document instead of a workspace file.'),
  registry: z
    .string()
    .optional()
    .describe('Optional aub.registry.json path for custom component validation.'),
};

export const config = {
  title: 'Import Design Bridge',
  description:
    'Import a vendor-neutral Figma/Penpot Design Bridge into a validated AUB Blueprint. The bridge must explicitly map every semantic node; this tool does not guess component types.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: {
    path?: string;
    bridge?: Record<string, unknown>;
    registry?: string;
  }
) {
  if (!args.path && !args.bridge) throw new Error('Provide either "path" or inline "bridge".');
  if (args.path && args.bridge) throw new Error('Provide only one of "path" or "bridge".');

  const bridgePath = args.path ? await resolveExistingWorkspacePath(ctx.root, args.path) : null;
  const bridge = bridgePath ? JSON.parse(await readFile(bridgePath, 'utf8')) : args.bridge;
  const bridgeOk = ctx.validators.validateDesignBridge(bridge) as boolean;
  if (!bridgeOk) {
    throw new Error(
      `Design Bridge validation failed:\n${formatAjvErrors(ctx.validators.validateDesignBridge)
        .map((item) => `- ${item}`)
        .join('\n')}`
    );
  }

  const result = importDesignBridge(bridge as any);
  const schemaOk = ctx.validators.validateBlueprint(result.blueprint) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateBlueprint);
  const knownTypes = await resolveKnownTypesForBlueprint({
    workspaceRoot: ctx.root,
    blueprintAbsPath: bridgePath,
    explicitRegistry: args.registry,
  });
  const semanticErrors = schemaOk
    ? validateBlueprintSemantics(result.blueprint, { knownTypes: knownTypes.knownTypes })
    : [];
  if (!schemaOk || semanticErrors.length > 0) {
    throw new Error(
      `Imported Blueprint validation failed:\n${[...schemaErrors, ...semanticErrors]
        .map((item) => `- ${item}`)
        .join('\n')}`
    );
  }

  return {
    source: args.path ?? 'inline',
    designSource: result.source,
    extensionRegistry: knownTypes.extensionPath,
    sourceMap: result.sourceMap,
    blueprint: result.blueprint,
  };
}
