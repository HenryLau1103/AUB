import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { scanProjectUi } from '../aub.js';

export const name = 'scan_project_ui';

const inputSchema = {
  namespace: z
    .string()
    .optional()
    .describe('Optional namespace for suggested custom types. Defaults to package/app name, or app.'),
  limit: z.number().int().positive().optional().describe('Maximum files to scan. Defaults to 2000.'),
};

export const config = {
  title: 'Scan Project UI',
  description:
    'Statically scan React/Next, Vue/Nuxt, and Angular project files for routes and reusable UI components. Writes candidates to .aub/component-candidates.json; it never writes aub.registry.json.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: { namespace?: string; limit?: number }) {
  return scanProjectUi(ctx.root, args ?? {});
}
