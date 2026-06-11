import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { Blueprint } from '../aub.js';
import { resolveBlueprint } from '../workspace.js';
import { createBlueprintLock } from '../aub.js';

export const name = 'lock_blueprint';

const inputSchema = {
  ref: z.string().optional().describe('Blueprint file path or screen id to lock.'),
  blueprint: z.record(z.any()).optional().describe('Inline Blueprint object to lock.'),
};

export const config = {
  title: 'Lock Blueprint',
  description:
    'Create a deterministic acceptance lock snapshot with structural SHA-256 hashes. Returns the lock object without writing files.',
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
  return {
    source,
    lock: createBlueprintLock(blueprint, { sourceFile: source }),
  };
}
