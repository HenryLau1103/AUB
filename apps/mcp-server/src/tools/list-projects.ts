import type { ServerContext } from '../context.js';
import { listProjects } from '../workspace.js';

export const name = 'list_projects';

export const config = {
  title: 'List Projects',
  description:
    'Scan the AUB workspace root and return every multi-screen project file (.aub.project.json / .aub.project.yaml) with its id, name, and screen count.',
  inputSchema: {},
};

export async function run(ctx: ServerContext) {
  const projects = await listProjects(ctx.root);
  return { root: ctx.root, count: projects.length, projects };
}
