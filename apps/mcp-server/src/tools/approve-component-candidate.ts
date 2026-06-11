import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { approveComponentCandidate } from '../aub.js';

export const name = 'approve_component_candidate';
const extensionTypePattern = /^[a-z][a-z0-9]*:[a-z][a-z0-9_]*$/;
const coreTypePattern = /^[a-z][a-z0-9_]*$/;

const inputSchema = {
  id: z.string().describe('Component candidate id from .aub/component-candidates.json.'),
  action: z
    .enum(['create_extension', 'map_core', 'ignore'])
    .describe('Review decision. create_extension writes aub.registry.json; map_core and ignore only update the candidate record.'),
  coreType: z
    .string()
    .trim()
    .regex(coreTypePattern, 'coreType must be a snake_case AUB component type')
    .optional()
    .describe('Core AUB component type when action is map_core.'),
  namespacedType: z
    .string()
    .trim()
    .regex(extensionTypePattern, 'namespacedType must be in team:component format')
    .optional()
    .describe('Approved team:component type when action is create_extension.'),
  isContainer: z.boolean().optional().describe('Container behavior override for create_extension.'),
  description: z.string().trim().max(400).optional().describe('Description override for the extension entry.'),
  module: z.string().trim().max(260).optional().describe('Production module/source override for the extension implementation.'),
  export: z.string().trim().max(120).optional().describe('Production export symbol override for the extension implementation.'),
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
