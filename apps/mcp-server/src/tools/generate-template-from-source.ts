import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { generateTemplateFromSource } from '../aub.js';

export const name = 'generate_template_from_source';
const sourcePathPattern = /^[^\\]+$/;

const inputSchema = {
  sourcePath: z
    .string()
    .trim()
    .min(1)
    .regex(sourcePathPattern, 'sourcePath must be a valid workspace-relative path.')
    .describe('Workspace-relative route or component source file path.'),
  name: z.string().trim().max(120).optional().describe('Template display name. Defaults to the source filename.'),
  id: z.string().trim().max(120).optional().describe('Stable template id. Defaults to a slug derived from framework and name.'),
  category: z.string().trim().max(60).optional().describe('Template category. Defaults to workspace.'),
  framework: z.string().trim().max(32).optional().describe('Framework label. Defaults to path-based inference.'),
  route: z.string().trim().max(240).optional().describe('Application route represented by the source. Defaults to path-based inference.'),
  sourceKind: z.string().trim().max(32).optional().describe('Source kind such as route or component. Defaults to source-file.'),
  output: z
    .string()
    .trim()
    .max(260)
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
