import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { resolveBlueprint } from '../workspace.js';
import { exportAgentPrompt, supportedAgentAdapters, supportedAgentTasks } from '../aub.js';

export const name = 'export_prompt';

const inputSchema = {
  ref: z.string().describe('Blueprint file path or screen id.'),
  adapter: z
    .string()
    .optional()
    .describe('Agent adapter: generic | codex | claude-code. Defaults to generic.'),
  task: z
    .string()
    .optional()
    .describe('Prompt task: author | plan | implement | review. Defaults to implement.'),
};

export const config = {
  title: 'Export Agent Prompt',
  description:
    'Generate an agent-ready prompt (with embedded Blueprint context) for a given adapter and task.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: { ref: string; adapter?: string; task?: string }
) {
  const adapter = args.adapter ?? 'generic';
  const task = args.task ?? 'implement';

  const adapters = supportedAgentAdapters();
  const tasks = supportedAgentTasks();
  if (!adapters.includes(adapter)) {
    throw new Error(`Unknown adapter "${adapter}". Supported: ${adapters.join(', ')}.`);
  }
  if (!tasks.includes(task)) {
    throw new Error(`Unknown task "${task}". Supported: ${tasks.join(', ')}.`);
  }

  const { blueprint, entry } = await resolveBlueprint(ctx.root, args.ref);
  const prompt = exportAgentPrompt(blueprint, { adapter, task });

  return { screenId: entry.screenId, path: entry.path, adapter, task, prompt };
}
