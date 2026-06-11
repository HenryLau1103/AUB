import type { ServerContext } from '../context.js';
import { templateAuthoringPrompt } from '../aub.js';

export const name = 'export_template_authoring_prompt';

export const config = {
  title: 'Export Template Authoring Prompt',
  description:
    'Return the agent-facing contract for scanning existing apps into AUB workspace templates and component candidates.',
  inputSchema: {},
};

export async function run(_ctx: ServerContext) {
  return {
    format: 'markdown',
    prompt: templateAuthoringPrompt(),
  };
}
