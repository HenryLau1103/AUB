import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { Blueprint } from '../aub.js';
import { resolveBlueprint } from '../workspace.js';
import { formatAjvErrors } from '../schema.js';
import { validateBlueprintSemantics } from '../aub.js';

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
};

export const config = {
  title: 'Validate Blueprint',
  description:
    'Validate a Blueprint against the JSON Schema and the AUB semantic rules. Provide either a ref or an inline blueprint object.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: { ref?: string; blueprint?: Record<string, unknown> }
) {
  let blueprint: Blueprint;
  let source: string;

  if (args.blueprint) {
    blueprint = args.blueprint as Blueprint;
    source = 'inline';
  } else if (args.ref) {
    const resolved = await resolveBlueprint(ctx.root, args.ref);
    blueprint = resolved.blueprint;
    source = resolved.entry.path;
  } else {
    throw new Error('Provide either "ref" or "blueprint".');
  }

  const schemaOk = ctx.validators.validateBlueprint(blueprint) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateBlueprint);
  const semanticErrors = schemaOk ? validateBlueprintSemantics(blueprint) : [];

  return {
    source,
    valid: schemaOk && semanticErrors.length === 0,
    schemaErrors,
    semanticErrors,
  };
}
