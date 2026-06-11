import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import { findRepoRoot } from './repo.js';

// ajv and ajv-formats ship as CJS; normalize the default export across loaders.
const Ajv2020 = ((AjvModule as any).default ?? AjvModule) as typeof AjvModule.default;
const addFormats = ((addFormatsModule as any).default ?? addFormatsModule) as typeof addFormatsModule.default;

export interface Validators {
  validateBlueprint: ValidateFunction;
  validateReport: ValidateFunction;
  validateProject: ValidateFunction;
  validateDesignBridge: ValidateFunction;
  reportSchema: Record<string, unknown>;
}

let cached: Validators | null = null;

export async function loadValidators(): Promise<Validators> {
  if (cached) return cached;
  const root = findRepoRoot();
  const [blueprintRaw, reportRaw, projectRaw, designBridgeRaw] = await Promise.all([
    readFile(join(root, 'schema', 'ui-blueprint.schema.json'), 'utf8'),
    readFile(join(root, 'schema', 'implementation-report.schema.json'), 'utf8'),
    readFile(join(root, 'schema', 'ui-project.schema.json'), 'utf8'),
    readFile(join(root, 'schema', 'design-bridge.schema.json'), 'utf8'),
  ]);
  const blueprintSchema = JSON.parse(blueprintRaw);
  const reportSchema = JSON.parse(reportRaw);
  const projectSchema = JSON.parse(projectRaw);
  const designBridgeSchema = JSON.parse(designBridgeRaw);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const validateBlueprint = ajv.compile(blueprintSchema);
  cached = {
    validateBlueprint,
    validateReport: ajv.compile(reportSchema),
    validateProject: ajv.compile(projectSchema),
    validateDesignBridge: ajv.compile(designBridgeSchema),
    reportSchema,
  };
  return cached;
}

export function formatAjvErrors(validate: ValidateFunction): string[] {
  return (validate.errors ?? []).map((err) => {
    const path = err.instancePath || '(root)';
    const params = err.params ? ` ${JSON.stringify(err.params)}` : '';
    return `${path} ${err.message ?? 'invalid'}${params}`.trim();
  });
}
