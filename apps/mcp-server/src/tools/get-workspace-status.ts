import type { ServerContext } from '../context.js';
import { getWorkspaceStatus } from '../aub.js';

export const name = 'get_workspace_status';

export const config = {
  title: 'Get Workspace Status',
  description:
    'Return AUB workspace-loop status: detected frameworks/routes, current session, workspace templates, and component candidates.',
  inputSchema: {},
};

export async function run(ctx: ServerContext) {
  return getWorkspaceStatus(ctx.root);
}
