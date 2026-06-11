import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { Blueprint } from '../aub.js';
import { resolveBlueprint } from '../workspace.js';
import { migrateBlueprint } from '../aub.js';

export const name = 'migrate_blueprint';

const inputSchema = {
  ref: z.string().optional().describe('Blueprint file path or screen id to migrate.'),
  blueprint: z.record(z.any()).optional().describe('Inline Blueprint object to migrate.'),
};

export const config = {
  title: 'Migrate Blueprint',
  description:
    'Migrate a v0.1 or v0.2 Blueprint to the current schema version. Returns the migrated object without writing files.',
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
  const fromVersion = blueprint.version ?? '0.1.0';
  const migrated = migrateBlueprint(blueprint);
  return {
    source,
    fromVersion,
    toVersion: migrated.version,
    changed: fromVersion !== migrated.version,
    blueprint: migrated,
  };
}
