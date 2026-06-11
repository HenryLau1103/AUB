import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { resolveBlueprint } from '../workspace.js';
import { diffBlueprints } from '../aub.js';

export const name = 'diff_blueprints';

const inputSchema = {
  before: z.string().describe('Baseline Blueprint file path or screen id.'),
  after: z.string().describe('Updated Blueprint file path or screen id.'),
};

export const config = {
  title: 'Diff Blueprints',
  description:
    'Compare two Blueprint revisions and return structural changes across nodes, interactions, responsive rules, acceptance, viewports, and design tokens.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: { before?: string; after?: string }) {
  if (!args.before || !args.after) {
    throw new Error('Provide both "before" and "after" Blueprint refs.');
  }
  const [before, after] = await Promise.all([
    resolveBlueprint(ctx.root, args.before),
    resolveBlueprint(ctx.root, args.after),
  ]);
  return {
    beforePath: before.entry.path,
    afterPath: after.entry.path,
    diff: diffBlueprints(before.blueprint, after.blueprint),
  };
}
