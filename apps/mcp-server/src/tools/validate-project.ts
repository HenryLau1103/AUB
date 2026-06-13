import { z } from 'zod';
import { dirname, relative, sep } from 'node:path';
import type { ServerContext } from '../context.js';
import { resolveProjectRef } from '../workspace.js';
import { formatAjvErrors } from '../schema.js';
import {
  loadProject,
  validateProjectSemantics,
  validateBlueprintSemantics,
  resolveKnownTypesForBlueprint,
} from '../aub.js';

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

const VALIDATE_PROJECT_CONCURRENCY = 8;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function run(ctx: ServerContext, args: { ref?: string }) {
  if (!args.ref) {
    throw new Error('Provide a project "ref" (file path or project id).');
  }
  const { projectPath } = await resolveProjectRef(ctx.root, args.ref);
  const loaded = await loadProject(projectPath, { workspaceRoot: ctx.root });
  const source = relative(ctx.root, loaded.projectPath).split(sep).join('/');

  const schemaOk = ctx.validators.validateProject(loaded.project) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateProject);

  const semanticErrors = validateProjectSemantics(loaded.project, {
    screensById: loaded.screensById,
  });

  const knownTypesByDirectory = new Map<string, ReturnType<typeof resolveKnownTypesForBlueprint>>();
  const screens = await mapLimit(loaded.screens, VALIDATE_PROJECT_CONCURRENCY, async (screen) => {
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
    const memberSemanticErrors: string[] = [];
    if (memberSchemaOk) {
      try {
        const directoryKey = dirname(screen.path);
        let knownTypesPromise = knownTypesByDirectory.get(directoryKey);
        if (!knownTypesPromise) {
          knownTypesPromise = resolveKnownTypesForBlueprint({
            workspaceRoot: ctx.root,
            blueprintAbsPath: screen.path,
          });
          knownTypesByDirectory.set(directoryKey, knownTypesPromise);
        }
        const resolved = await knownTypesPromise;
        memberSemanticErrors.push(
          ...validateBlueprintSemantics(screen.blueprint, { knownTypes: resolved.knownTypes })
        );
      } catch (err) {
        const registryError = err instanceof Error ? err.message : String(err);
        memberSemanticErrors.push(`registry: ${registryError}`);
      }
    }
    return {
      id: screen.ref?.id ?? '',
      valid: memberSchemaOk && memberSemanticErrors.length === 0,
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
