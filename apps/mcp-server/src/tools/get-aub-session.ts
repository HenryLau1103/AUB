import type { ServerContext } from '../context.js';
import { readAubSession } from '../aub.js';

export const name = 'get_aub_session';

export const config = {
  title: 'Get AUB Session',
  description:
    'Read .aub/session.json so an agent can see which Blueprint/project/preview route the user is actively editing.',
  inputSchema: {},
};

export async function run(ctx: ServerContext) {
  return {
    path: '.aub/session.json',
    session: await readAubSession(ctx.root),
  };
}
