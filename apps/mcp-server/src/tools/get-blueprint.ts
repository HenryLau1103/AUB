import { z } from 'zod';
import yaml from 'js-yaml';
import type { ServerContext } from '../context.js';
import { resolveBlueprint } from '../workspace.js';
import { exportMarkdown } from '../aub.js';

export const name = 'get_blueprint';

const inputSchema = {
  ref: z.string().describe('Blueprint file path (relative to the workspace root) or screen id.'),
  format: z
    .enum(['json', 'yaml', 'markdown'])
    .optional()
    .describe('Output format. Defaults to json. markdown returns the derived .ui.md agent context.'),
};

export const config = {
  title: 'Get Blueprint',
  description:
    'Resolve a Blueprint by file path or screen id and return it as JSON, YAML, or derived Markdown agent context.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: { ref: string; format?: 'json' | 'yaml' | 'markdown' }) {
  const { blueprint, entry } = await resolveBlueprint(ctx.root, args.ref);
  const format = args.format ?? 'json';

  if (format === 'markdown') {
    return { format, path: entry.path, screenId: entry.screenId, content: exportMarkdown(blueprint) };
  }
  if (format === 'yaml') {
    return { format, path: entry.path, screenId: entry.screenId, content: yaml.dump(blueprint) };
  }
  return { format, path: entry.path, screenId: entry.screenId, blueprint };
}
