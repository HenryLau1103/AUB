import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import {
  buildKnownTypes,
  createHandoffArchive,
  createImplementationReportTemplate,
  exportAgentPrompt,
  exportMarkdown,
  validateBlueprintSemantics,
} from '../aub.js';
import { findRepoRoot } from '../repo.js';
import { formatAjvErrors } from '../schema.js';
import { resolveBlueprint, resolveWorkspacePath } from '../workspace.js';

export const name = 'export_handoff';

const inputSchema = {
  ref: z.string().describe('Blueprint file path or screen id.'),
  output: z
    .string()
    .optional()
    .describe('Destination .aub.zip path inside the workspace. Defaults to .aub/handoffs/<screen-id>.aub.zip.'),
  registry: z.string().optional().describe('Optional aub.registry.json path to include and validate.'),
  overwrite: z.boolean().optional().describe('Replace an existing package. Defaults to false.'),
  viewportImages: z
    .record(z.string())
    .optional()
    .describe('Optional map of viewport id to PNG data URL for screenshot evidence.'),
};

export const config = {
  title: 'Export Handoff Package',
  description:
    'Validate a Blueprint and write a complete .aub.zip agent handoff package inside the workspace, including prompts, report contract, optional component registry, and optional viewport screenshots.',
  inputSchema,
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function run(
  ctx: ServerContext,
  args: {
    ref?: string;
    output?: string;
    registry?: string;
    overwrite?: boolean;
    viewportImages?: Record<string, string>;
  }
) {
  if (!args.ref) throw new Error('Provide a Blueprint "ref".');
  const { blueprint, entry } = await resolveBlueprint(ctx.root, args.ref);
  const schemaOk = ctx.validators.validateBlueprint(blueprint) as boolean;
  const schemaErrors = schemaOk ? [] : formatAjvErrors(ctx.validators.validateBlueprint);
  const knownTypes = await buildKnownTypes({
    extensionPath: args.registry ? resolveWorkspacePath(ctx.root, args.registry) : null,
    startDir: dirname(entry.absPath),
  });
  const semanticErrors = schemaOk
    ? validateBlueprintSemantics(blueprint, { knownTypes: knownTypes.knownTypes })
    : [];
  if (!schemaOk || semanticErrors.length > 0) {
    throw new Error(
      `Blueprint validation failed:\n${[...schemaErrors, ...semanticErrors].map((item) => `- ${item}`).join('\n')}`
    );
  }

  const outputRef = args.output ?? `.aub/handoffs/${blueprint.screen.id}.aub.zip`;
  if (!outputRef.endsWith('.aub.zip')) throw new Error('Handoff output must end in .aub.zip.');
  const outputPath = resolveWorkspacePath(ctx.root, outputRef);
  if (!args.overwrite && (await exists(outputPath))) {
    throw new Error(`Refusing to overwrite existing file: ${outputRef}`);
  }

  const repoRoot = findRepoRoot();
  const [agentGuide, agentGuideZhHant, extensionRegistry] = await Promise.all([
    readFile(resolve(repoRoot, 'docs/agent-handoff.md'), 'utf8'),
    readFile(resolve(repoRoot, 'docs/agent-handoff.zh-Hant.md'), 'utf8'),
    knownTypes.extensionPath ? readFile(knownTypes.extensionPath, 'utf8') : Promise.resolve(undefined),
  ]);
  const { bytes, manifest } = await createHandoffArchive({
    blueprint,
    markdown: exportMarkdown(blueprint),
    genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
    codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
    agentGuide,
    agentGuideZhHant,
    reportTemplate: createImplementationReportTemplate(blueprint),
    reportSchema: ctx.validators.reportSchema,
    viewportImages: args.viewportImages ?? {},
    extensionRegistry,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);

  return {
    savedPath: relative(ctx.root, outputPath).split(sep).join('/'),
    screenId: blueprint.screen.id,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    manifest,
  };
}
