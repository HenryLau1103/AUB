import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { generateTemplateFromSource } from '../aub.js';

export const name = 'generate_template_from_source';

const inputSchema = {
  sourcePath: z.string().describe('Workspace-relative route or component source file path.'),
  name: z.string().optional().describe('Template display name. Defaults to the source filename.'),
  id: z.string().optional().describe('Stable template id. Defaults to a slug derived from framework and name.'),
  category: z.string().optional().describe('Template category. Defaults to workspace.'),
  framework: z.string().optional().describe('Framework label. Defaults to path-based inference.'),
  route: z.string().optional().describe('Application route represented by the source. Defaults to path-based inference.'),
  sourceKind: z.string().optional().describe('Source kind such as route or component. Defaults to source-file.'),
  output: z
    .string()
    .optional()
    .describe('Destination .aub.template.json path inside the workspace. Defaults to .aub/templates/<id>.aub.template.json.'),
  status: z.enum(['candidate', 'approved']).optional().describe('Initial template status. Defaults to candidate.'),
};

export const config = {
  title: 'Generate Template From Source',
  description:
    'Generate a candidate AUB workspace template from a static route/component source file and save it under .aub/templates.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: Record<string, unknown>) {
  return generateTemplateFromSource(ctx.root, args ?? {});
}
