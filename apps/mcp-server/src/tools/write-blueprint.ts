import { extname, relative, sep } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { Blueprint } from '../aub.js';
import { buildKnownTypes, discoverWorkspaceExtensionRegistry, validateBlueprintSemantics } from '../aub.js';
import { formatAjvErrors } from '../schema.js';
import { prepareWorkspaceWritePath, resolveWorkspaceRegistryPath, writeFileAtomic } from '../workspace.js';

export const name = 'write_blueprint';

const inputSchema = {
  path: z
    .string()
    .describe('Destination path inside the workspace. Must end in .ui.json, .ui.yaml, or .ui.yml.'),
  blueprint: z.record(z.any()).describe('Complete Blueprint object to validate and write.'),
  registry: z
    .string()
    .optional()
    .describe('Optional aub.registry.json path for custom component validation.'),
  overwrite: z.boolean().optional().describe('Replace an existing file. Defaults to false.'),
};

export const config = {
  title: 'Write Blueprint',
  description:
    'Validate and atomically write a Blueprint inside the workspace. Existing files are protected unless overwrite is true.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: {
    path?: string;
    blueprint?: Record<string, unknown>;
    registry?: string;
    overwrite?: boolean;
  }
) {
  if (!args.path || !/\.ui\.(json|ya?ml)$/i.test(args.path)) {
    throw new Error('Provide a destination "path" ending in .ui.json, .ui.yaml, or .ui.yml.');
  }
  if (!args.blueprint) throw new Error('Provide a complete "blueprint" object.');

  const blueprint = args.blueprint as Blueprint;
  const schemaOk = ctx.validators.validateBlueprint(blueprint) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateBlueprint);
  const knownTypes = await buildKnownTypes({
    extensionPath: args.registry
      ? await resolveWorkspaceRegistryPath(ctx.root, args.registry)
      : discoverWorkspaceExtensionRegistry(ctx.root, ctx.root),
    discover: false,
  });
  const semanticErrors = schemaOk
    ? validateBlueprintSemantics(blueprint, { knownTypes: knownTypes.knownTypes })
    : [];
  if (!schemaOk || semanticErrors.length > 0) {
    throw new Error(
      `Blueprint validation failed:\n${[...schemaErrors, ...semanticErrors].map((item) => `- ${item}`).join('\n')}`
    );
  }

  const outputPath = await prepareWorkspaceWritePath(ctx.root, args.path);
  const ext = extname(outputPath).toLowerCase();
  const content =
    ext === '.yaml' || ext === '.yml'
      ? yaml.dump(blueprint, { noRefs: true, lineWidth: 120 })
      : `${JSON.stringify(blueprint, null, 2)}\n`;
  await writeFileAtomic(outputPath, content, {
    overwrite: Boolean(args.overwrite),
    root: ctx.root,
    displayPath: args.path,
  });

  return {
    savedPath: relative(ctx.root, outputPath).split(sep).join('/'),
    screenId: blueprint.screen.id,
    format: ext === '.json' ? 'json' : 'yaml',
    bytes: new TextEncoder().encode(content).byteLength,
    extensionRegistry: knownTypes.extensionPath,
  };
}
