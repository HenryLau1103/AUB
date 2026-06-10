#!/usr/bin/env node
// Scaffold the spec sections (interactions, responsive, acceptance) of a Blueprint.
// Derivation is deterministic and non-destructive: existing entries are preserved
// and only missing items are appended.
//
// Usage:
//   node scripts/scaffold-blueprint.mjs <file.ui.json|yaml> [options]
// Options:
//   --sections a,b,c   Comma list of sections to scaffold (default: all).
//   --language <lang>  'en' (default) or 'zh-Hant' for generated statements.
//   --write            Write the result back to the input file.
//   --stdout           Print the scaffolded blueprint to stdout (default if not --write).

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { scaffoldBlueprint, SCAFFOLD_SECTIONS } from './scaffold-blueprint.lib.mjs';

function parseArgs(argv) {
  const args = { file: null, sections: null, language: 'en', write: false, stdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--write') args.write = true;
    else if (token === '--stdout') args.stdout = true;
    else if (token === '--sections') args.sections = splitSections(argv[++i]);
    else if (token.startsWith('--sections=')) args.sections = splitSections(token.slice('--sections='.length));
    else if (token === '--language') args.language = argv[++i];
    else if (token.startsWith('--language=')) args.language = token.slice('--language='.length);
    else if (!args.file) args.file = token;
  }
  return args;
}

function splitSections(value) {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isYaml(path) {
  const ext = extname(path).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/scaffold-blueprint.mjs <file.ui.json|yaml> [--sections a,b,c] [--language en|zh-Hant] [--write|--stdout]');
    process.exit(2);
  }

  const sections = args.sections ?? SCAFFOLD_SECTIONS;
  const unknown = sections.filter((section) => !SCAFFOLD_SECTIONS.includes(section));
  if (unknown.length > 0) {
    console.error(`Unknown section(s): ${unknown.join(', ')}. Valid: ${SCAFFOLD_SECTIONS.join(', ')}`);
    process.exit(2);
  }

  const filePath = resolve(args.file);
  const raw = await readFile(filePath, 'utf8');
  const document = isYaml(filePath) ? yaml.load(raw) : JSON.parse(raw);

  const { blueprint, summary } = scaffoldBlueprint(document, { sections, language: args.language });

  const serialized = isYaml(filePath)
    ? yaml.dump(blueprint, { noRefs: true, lineWidth: 120, sortKeys: false })
    : `${JSON.stringify(blueprint, null, 2)}\n`;

  if (args.write) {
    await writeFile(filePath, serialized, 'utf8');
    console.error(
      `✓ scaffolded ${args.file} (+${summary.interactions} interactions, +${summary.responsive} responsive, +${summary.acceptance} acceptance)`
    );
  } else {
    process.stdout.write(serialized);
    console.error(
      `✓ +${summary.interactions} interactions, +${summary.responsive} responsive, +${summary.acceptance} acceptance (use --write to save)`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
