import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { approveComponentCandidate } from '../aub.js';

export const name = 'approve_component_candidate';

const inputSchema = {
  id: z.string().describe('Component candidate id from .aub/component-candidates.json.'),
  action: z
    .enum(['create_extension', 'map_core', 'ignore'])
    .describe('Review decision. create_extension writes aub.registry.json; map_core and ignore only update the candidate record.'),
  coreType: z.string().optional().describe('Core AUB component type when action is map_core.'),
  namespacedType: z.string().optional().describe('Approved team:component type when action is create_extension.'),
  isContainer: z.boolean().optional().describe('Container behavior override for create_extension.'),
  description: z.string().optional().describe('Description override for the extension entry.'),
  module: z.string().optional().describe('Production module/source override for the extension implementation.'),
  export: z.string().optional().describe('Production export symbol override for the extension implementation.'),
  importStyle: z
    .enum(['named', 'default', 'namespace', 'side-effect', 'custom-element'])
    .optional()
    .describe('Production import style override for the extension implementation.'),
};

export const config = {
  title: 'Approve Component Candidate',
  description:
    'Review a scanned custom component candidate. Only create_extension writes aub.registry.json; other decisions stay in .aub/component-candidates.json.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: Record<string, unknown>) {
  return approveComponentCandidate(ctx.root, args ?? {});
}
