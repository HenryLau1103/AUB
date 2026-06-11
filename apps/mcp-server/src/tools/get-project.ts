import { z } from 'zod';
import { relative, sep } from 'node:path';
import type { ServerContext } from '../context.js';
import { resolveProjectRef } from '../workspace.js';
import { loadProject, mergeDesignSystem } from '../aub.js';

export const name = 'get_project';

const inputSchema = {
  ref: z.string().describe('Project file path (relative to the workspace root) or project id.'),
  inlineScreens: z
    .boolean()
    .optional()
    .describe(
      'When true, include each member screen Blueprint inline along with its merged design system. Defaults to false (refs only).'
    ),
};

export const config = {
  title: 'Get Project',
  description:
    'Resolve a multi-screen project by file path or id and return its metadata plus member screens. Pass inlineScreens to embed each full member Blueprint.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: { ref?: string; inlineScreens?: boolean }) {
  if (!args.ref) {
    throw new Error('Provide a project "ref" (file path or project id).');
  }
  const { projectPath } = await resolveProjectRef(ctx.root, args.ref);
  const loaded = await loadProject(projectPath);
  const inline = args.inlineScreens === true;

  const screens = loaded.screens.map((screen) => {
    const base: Record<string, unknown> = {
      id: screen.ref?.id ?? '',
      name: screen.ref?.name ?? '',
      path: screen.path,
      loaded: screen.blueprint != null,
    };
    if (inline && screen.blueprint) {
      base.blueprint = screen.blueprint;
      base.mergedDesignSystem = mergeDesignSystem(loaded.project, screen.blueprint);
    }
    return base;
  });

  const source = relative(ctx.root, loaded.projectPath).split(sep).join('/');

  return {
    source,
    project: loaded.project,
    screens,
    loadErrors: loaded.errors,
  };
}
