import { z } from 'zod';
import { relative, sep } from 'node:path';
import type { ServerContext } from '../context.js';
import { resolveProjectRef } from '../workspace.js';
import { formatAjvErrors } from '../schema.js';
import { loadProject, validateProjectSemantics, validateBlueprintSemantics, buildKnownTypes } from '../aub.js';

export const name = 'validate_project';

const inputSchema = {
  ref: z.string().describe('Project file path or project id to load and validate.'),
};

export const config = {
  title: 'Validate Project',
  description:
    'Validate a multi-screen project against the JSON Schema and AUB project semantic rules, then validate every member screen Blueprint (schema + semantics). Returns per-screen results and an overall valid flag.',
  inputSchema,
};

export async function run(ctx: ServerContext, args: { ref?: string }) {
  if (!args.ref) {
    throw new Error('Provide a project "ref" (file path or project id).');
  }
  const { projectPath } = await resolveProjectRef(ctx.root, args.ref);
  const loaded = await loadProject(projectPath);
  const source = relative(ctx.root, loaded.projectPath).split(sep).join('/');

  const schemaOk = ctx.validators.validateProject(loaded.project) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateProject);

  const semanticErrors = validateProjectSemantics(loaded.project, {
    screensById: loaded.screensById,
  });

  let knownTypes: Awaited<ReturnType<typeof buildKnownTypes>>['knownTypes'] | undefined;
  let registryError: string | null = null;
  try {
    const resolved = await buildKnownTypes({ extensionPath: null, startDir: ctx.root });
    knownTypes = resolved.knownTypes;
  } catch (err) {
    registryError = err instanceof Error ? err.message : String(err);
  }

  const screens = loaded.screens.map((screen) => {
    if (!screen.blueprint) {
      return {
        id: screen.ref?.id ?? '',
        valid: false,
        schemaErrors: [`Member blueprint failed to load: ${screen.path}`],
        semanticErrors: [],
      };
    }
    const memberSchemaOk = ctx.validators.validateBlueprint(screen.blueprint) as boolean;
    const memberSchemaErrors = memberSchemaOk
      ? []
      : formatAjvErrors(ctx.validators.validateBlueprint);
    const memberSemanticErrors =
      memberSchemaOk && !registryError
        ? validateBlueprintSemantics(screen.blueprint, { knownTypes })
        : [];
    if (registryError) memberSemanticErrors.push(`registry: ${registryError}`);
    return {
      id: screen.ref?.id ?? '',
      valid: memberSchemaOk && !registryError && memberSemanticErrors.length === 0,
      schemaErrors: memberSchemaErrors,
      semanticErrors: memberSemanticErrors,
    };
  });

  const valid =
    schemaOk &&
    schemaErrors.length === 0 &&
    semanticErrors.length === 0 &&
    loaded.errors.length === 0 &&
    screens.every((screen) => screen.valid);

  return {
    source,
    valid,
    schemaErrors,
    semanticErrors,
    screens,
    loadErrors: loaded.errors,
  };
}
