import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { buildKnownTypes, discoverWorkspaceExtensionRegistry } from '../aub.js';
import { resolveWorkspaceRegistryPath } from '../workspace.js';

export const name = 'resolve_component';

const inputSchema = {
  type: z
    .string()
    .describe('Core or namespaced component type to resolve, for example button or acme:insight_card.'),
  registry: z
    .string()
    .optional()
    .describe('Optional path to aub.registry.json. Defaults to auto-discovery from the workspace root.'),
  implementation: z
    .string()
    .optional()
    .describe('Optional implementation id to select, for example react or angular.'),
};

export const config = {
  title: 'Resolve Component',
  description:
    'Resolve a semantic component type to its container behavior, description, and production implementation mappings. Use this before creating a bespoke component.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: { type?: string; registry?: string; implementation?: string }
) {
  if (!args.type?.trim()) {
    throw new Error('Provide a component "type".');
  }
  const resolved = await buildKnownTypes({
    extensionPath: args.registry
      ? await resolveWorkspaceRegistryPath(ctx.root, args.registry)
      : discoverWorkspaceExtensionRegistry(ctx.root, ctx.root),
    discover: false,
  });
  const metadata = resolved.knownTypes.get(args.type);
  if (!metadata) {
    throw new Error(`Unknown component type "${args.type}".`);
  }
  const implementations = metadata.implementations ?? [];
  const selected = args.implementation
    ? implementations.find((item) => item.id === args.implementation)
    : undefined;
  if (args.implementation && !selected) {
    throw new Error(
      `Component "${args.type}" has no implementation "${args.implementation}". Available: ${
        implementations.map((item) => item.id).join(', ') || 'none'
      }.`
    );
  }
  return {
    type: args.type,
    source: metadata.source,
    isContainer: metadata.isContainer,
    description: metadata.description ?? '',
    extensionRegistry: resolved.extensionPath,
    implementations,
    selectedImplementation: selected ?? null,
  };
}
