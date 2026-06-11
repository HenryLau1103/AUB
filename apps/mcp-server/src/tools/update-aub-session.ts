import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { updateAubSession } from '../aub.js';

export const name = 'update_aub_session';

const inputSchema = {
  patch: z.record(z.any()).describe('Partial .aub/session.json content to merge into the current workspace session.'),
};

export const config = {
  title: 'Update AUB Session',
  description:
    'Merge workspace session state into .aub/session.json. Use after the editor saves a Blueprint or updates preview route metadata.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: { patch?: Record<string, unknown> }) {
  return updateAubSession(ctx.root, args.patch ?? {});
}
