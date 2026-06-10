import type { ServerContext } from '../context.js';
import { listBlueprints } from '../workspace.js';

export const name = 'list_blueprints';

export const config = {
  title: 'List Blueprints',
  description:
    'Scan the AUB workspace root and return every UI Blueprint file (.ui.json / .ui.yaml) with its screen id, name, and version.',
  inputSchema: {},
};

export async function run(ctx: ServerContext) {
  const blueprints = await listBlueprints(ctx.root);
  return { root: ctx.root, count: blueprints.length, blueprints };
}
