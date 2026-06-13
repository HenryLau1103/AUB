import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { Blueprint } from '../aub.js';
import { resolveBlueprint } from '../workspace.js';
import { formatAjvErrors } from '../schema.js';
import { validateBlueprintSemantics, resolveKnownTypesForBlueprint } from '../aub.js';

export const name = 'validate_blueprint';

const inputSchema = {
  ref: z
    .string()
    .optional()
    .describe('Blueprint file path or screen id to load and validate.'),
  blueprint: z
    .record(z.any())
    .optional()
    .describe('Inline Blueprint object to validate instead of loading from disk.'),
  registry: z
    .string()
    .optional()
    .describe(
      'Path to an aub.registry.json declaring namespaced (team:component) extension types. Defaults to auto-discovery from the workspace root.'
    ),
};

export const config = {
  title: 'Validate Blueprint',
  description:
    'Validate a Blueprint against the JSON Schema and the AUB semantic rules. Namespaced extension component types are resolved from a project aub.registry.json (auto-discovered, or pass "registry"). Provide either a ref or an inline blueprint object.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: { ref?: string; blueprint?: Record<string, unknown>; registry?: string }
) {
  let blueprint: Blueprint;
  let source: string;
  let blueprintAbsPath: string | null = null;

  if (args.blueprint) {
    blueprint = args.blueprint as Blueprint;
    source = 'inline';
  } else if (args.ref) {
    const resolved = await resolveBlueprint(ctx.root, args.ref);
    blueprint = resolved.blueprint;
    source = resolved.entry.path;
    blueprintAbsPath = resolved.entry.absPath;
  } else {
    throw new Error('Provide either "ref" or "blueprint".');
  }

  const schemaOk = ctx.validators.validateBlueprint(blueprint) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateBlueprint);

  let knownTypes;
  let extensionRegistry: string | null = null;
  let registryError: string | null = null;
  try {
    const resolved = await resolveKnownTypesForBlueprint({
      workspaceRoot: ctx.root,
      blueprintAbsPath,
      explicitRegistry: args.registry,
    });
    knownTypes = resolved.knownTypes;
    extensionRegistry = resolved.extensionPath;
  } catch (err) {
    registryError = err instanceof Error ? err.message : String(err);
  }

  const semanticErrors =
    schemaOk && !registryError ? validateBlueprintSemantics(blueprint, { knownTypes }) : [];
  if (registryError) semanticErrors.push(`registry: ${registryError}`);

  return {
    source,
    extensionRegistry,
    valid: schemaOk && !registryError && semanticErrors.length === 0,
    schemaErrors,
    semanticErrors,
  };
}
