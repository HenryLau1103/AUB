import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { ImplementationReport } from '../aub.js';
import { resolveBlueprint } from '../workspace.js';
import { formatAjvErrors } from '../schema.js';
import { verifyImplementationReport } from '../aub.js';

export const name = 'submit_report';

const inputSchema = {
  ref: z.string().describe('Blueprint file path or screen id the report targets.'),
  report: z.record(z.any()).describe('Implementation report object to verify against the Blueprint.'),
  persist: z
    .boolean()
    .optional()
    .describe('Persist an accepted report under <root>/.aub/reports/. Defaults to true.'),
};

export const config = {
  title: 'Submit Implementation Report',
  description:
    'Validate an implementation report against the report schema and the Blueprint (node mappings + acceptance evidence). Accepted reports are persisted under the workspace.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: { ref: string; report: Record<string, unknown>; persist?: boolean }
) {
  const { blueprint, entry } = await resolveBlueprint(ctx.root, args.ref);
  const report = args.report as ImplementationReport;

  const schemaOk = ctx.validators.validateReport(report) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateReport);

  const verification = schemaOk
    ? verifyImplementationReport(blueprint, report)
    : { ready: false, errors: ['Report failed schema validation; skipped semantic verification.'], summary: undefined };

  const accepted = schemaOk && verification.ready;

  let savedPath: string | undefined;
  if (accepted && args.persist !== false) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenId = entry.screenId || 'blueprint';
    const dir = join(ctx.root, '.aub', 'reports');
    await mkdir(dir, { recursive: true });
    const absPath = join(dir, `${screenId}-${timestamp}.json`);
    await writeFile(absPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    savedPath = relative(ctx.root, absPath).split(sep).join('/');
  }

  return {
    accepted,
    screenId: entry.screenId,
    schemaErrors,
    errors: verification.errors,
    summary: verification.summary,
    savedPath,
  };
}
