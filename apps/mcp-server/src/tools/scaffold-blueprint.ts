import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { Blueprint } from '../aub.js';
import { resolveBlueprint } from '../workspace.js';
import { scaffoldBlueprint, SCAFFOLD_SECTIONS } from '../aub.js';

type ScaffoldSection = 'interactions' | 'responsive' | 'acceptance';

export const name = 'scaffold_blueprint';

const inputSchema = {
  ref: z
    .string()
    .optional()
    .describe('Blueprint file path or screen id to load and scaffold.'),
  blueprint: z
    .record(z.any())
    .optional()
    .describe('Inline Blueprint object to scaffold instead of loading from disk.'),
  sections: z
    .array(z.enum(['interactions', 'responsive', 'acceptance']))
    .optional()
    .describe('Which spec sections to scaffold. Defaults to all three.'),
  language: z
    .enum(['en', 'zh-Hant'])
    .optional()
    .describe('Language for generated statements. Defaults to en.'),
};

export const config = {
  title: 'Scaffold Blueprint',
  description:
    'Deterministically derive missing interactions, responsive rules, and acceptance criteria from the existing node tree and viewports. Non-destructive: existing entries are preserved and only missing items are appended. Returns the scaffolded blueprint and a summary of what was added.',
  inputSchema,
};

export async function run(
  ctx: ServerContext,
  args: {
    ref?: string;
    blueprint?: Record<string, unknown>;
    sections?: string[];
    language?: 'en' | 'zh-Hant';
  }
) {
  let blueprint: Blueprint;
  let source: string;

  if (args.blueprint) {
    blueprint = args.blueprint as Blueprint;
    source = 'inline';
  } else if (args.ref) {
    const resolved = await resolveBlueprint(ctx.root, args.ref);
    blueprint = resolved.blueprint;
    source = resolved.entry.path;
  } else {
    throw new Error('Provide either "ref" or "blueprint".');
  }

  const sections = (args.sections ?? SCAFFOLD_SECTIONS) as ScaffoldSection[];
  const { blueprint: scaffolded, summary } = scaffoldBlueprint(blueprint, {
    sections,
    language: args.language ?? 'en',
  });

  return {
    source,
    summary,
    blueprint: scaffolded,
  };
}
