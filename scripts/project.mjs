#!/usr/bin/env node
// CLI for reference-based multi-screen AUB projects (*.aub.project.json).
// Usage:
//   node scripts/project.mjs validate <project.aub.project.json>
//   node scripts/project.mjs init <out.aub.project.json> <screen1.ui.json> [screen2.ui.json ...]
//   node scripts/project.mjs export-md <project.aub.project.json> [outDir]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  loadProject,
  validateProjectSemantics,
  readBlueprintFile,
  buildProject,
} from './project.lib.mjs';
import { validateBlueprintSemantics } from './validate-blueprint.lib.mjs';
import { buildKnownTypes } from './registry.lib.mjs';
import { exportMarkdown } from './export-md.lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function toForwardSlashes(p) {
  return p.split('\\').join('/');
}

function ajvErrorLines(errors, label) {
  const lines = [];
  for (const err of errors ?? []) {
    const path = err.instancePath || '(root)';
    let line = `  ${label}${path} ${err.message}`;
    if (err.params && Object.keys(err.params).length > 0) {
      line += ` (params: ${JSON.stringify(err.params)})`;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Shared project-validation routine used by both this CLI's `validate`
 * subcommand and by scripts/validate.mjs when it detects a project document.
 * Validates the project against the project schema + project semantics, and
 * each member screen against the blueprint schema + blueprint semantics.
 * Returns { ok, errors } where errors is a flat array of human-readable strings.
 */
export async function validateProjectFile(projectPathArg) {
  const errors = [];
  const projectPath = resolve(projectPathArg);

  let loaded;
  try {
    loaded = await loadProject(projectPath);
  } catch (err) {
    return { ok: false, errors: [`cannot load project: ${err.message}`] };
  }

  const { project, screens, screensById, errors: loadErrors } = loaded;

  // Member files that could not be read.
  for (const loadError of loadErrors) {
    errors.push(loadError);
  }

  // Project schema validation.
  const projectSchemaPath = join(ROOT, 'schema', 'ui-project.schema.json');
  const projectSchema = JSON.parse(await readFile(projectSchemaPath, 'utf8'));
  const ajvProject = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajvProject);
  const validateProject = ajvProject.compile(projectSchema);
  if (!validateProject(project)) {
    for (const line of ajvErrorLines(validateProject.errors, 'project schema: ')) {
      errors.push(line.trim());
    }
  }

  // Project semantic validation.
  for (const semanticError of validateProjectSemantics(project, { screensById })) {
    errors.push(`project semantic: ${semanticError}`);
  }

  // Member screen validation (schema + semantics).
  const blueprintSchemaPath = join(ROOT, 'schema', 'ui-blueprint.schema.json');
  const blueprintSchema = JSON.parse(await readFile(blueprintSchemaPath, 'utf8'));
  const ajvBlueprint = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajvBlueprint);
  const validateBlueprint = ajvBlueprint.compile(blueprintSchema);

  const perScreen = [];
  for (const { ref, path: memberPath, blueprint } of screens) {
    const screenErrors = [];
    if (!blueprint) {
      // Already reported via loadErrors; mark as failing.
      perScreen.push({ id: ref.id, ok: false, errors: [] });
      continue;
    }
    const schemaOk = validateBlueprint(blueprint);
    if (!schemaOk) {
      for (const line of ajvErrorLines(validateBlueprint.errors, 'schema: ')) {
        screenErrors.push(line.trim());
      }
    }
    let knownTypes;
    try {
      const resolved = await buildKnownTypes({ startDir: dirname(memberPath) });
      knownTypes = resolved.knownTypes;
    } catch (err) {
      screenErrors.push(`registry: ${err.message}`);
    }
    if (schemaOk && knownTypes) {
      for (const semanticError of validateBlueprintSemantics(blueprint, { knownTypes })) {
        screenErrors.push(`semantic: ${semanticError}`);
      }
    }
    perScreen.push({ id: ref.id, ok: screenErrors.length === 0, errors: screenErrors });
    for (const screenError of screenErrors) {
      errors.push(`screen "${ref.id}": ${screenError}`);
    }
  }

  return { ok: errors.length === 0, errors, perScreen };
}

async function cmdValidate(arg) {
  if (!arg) {
    console.error('Usage: node scripts/project.mjs validate <project.aub.project.json>');
    process.exit(2);
  }
  const projectPath = resolve(arg);
  const result = await validateProjectFile(projectPath);

  if (result.perScreen) {
    for (const screen of result.perScreen) {
      if (screen.ok) {
        console.log(`  ✓ screen ${screen.id}`);
      } else {
        console.error(`  ✗ screen ${screen.id}`);
      }
    }
  }

  if (result.ok) {
    console.log(`✓ valid project: ${arg}`);
    process.exit(0);
  }

  console.error(`✗ invalid project: ${arg}`);
  for (const error of result.errors) {
    console.error(`  ${error}`);
  }
  process.exit(1);
}

function kebabCase(value) {
  const kebab = String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab || 'project';
}

function humanize(value) {
  const words = String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(' ') || 'Project';
}

function projectBaseName(outPath) {
  let base = basename(outPath);
  if (base.endsWith('.aub.project.json')) {
    base = base.slice(0, -'.aub.project.json'.length);
  } else if (base.endsWith('.json')) {
    base = base.slice(0, -'.json'.length);
  }
  return base;
}

async function cmdInit(outArg, screenArgs) {
  if (!outArg || screenArgs.length === 0) {
    console.error(
      'Usage: node scripts/project.mjs init <out.aub.project.json> <screen1.ui.json> [screen2.ui.json ...]'
    );
    process.exit(2);
  }
  const outPath = resolve(outArg);
  const outDir = dirname(outPath);

  const screens = [];
  for (const screenArg of screenArgs) {
    const screenAbs = resolve(screenArg);
    const blueprint = await readBlueprintFile(screenAbs);
    const relPath = toForwardSlashes(relative(outDir, screenAbs));
    screens.push({ blueprint, path: relPath });
  }

  const base = projectBaseName(outPath);
  const project = buildProject({
    id: kebabCase(base),
    name: humanize(base),
    screens,
  });

  await writeFile(outPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  console.log(`✓ wrote ${outArg} with ${screens.length} screens`);
  process.exit(0);
}

function navEdgeLine(edge) {
  const trigger = edge.trigger ? ` [${edge.trigger}]` : '';
  const label = edge.label ? ` — ${edge.label}` : '';
  return `- ${edge.from} → ${edge.to}${trigger}${label}`;
}

function buildOverviewMarkdown(project, screens) {
  const lines = [];
  lines.push(`# ${project.name}`);
  lines.push('');
  if (project.description) {
    lines.push(project.description);
    lines.push('');
  }
  lines.push(`- **Project id:** ${project.id}`);
  lines.push(`- **Version:** ${project.version}`);
  lines.push(`- **Entry screen:** ${project.entry_screen}`);
  lines.push('');
  lines.push('## Screens');
  lines.push('');
  for (const { ref } of screens) {
    const name = ref.name ? ` — ${ref.name}` : '';
    lines.push(`- \`${ref.id}\`${name} (\`${ref.path}\`)`);
  }
  lines.push('');
  lines.push('## Navigation');
  lines.push('');
  const edges = Array.isArray(project.navigation) ? project.navigation : [];
  if (edges.length === 0) {
    lines.push('_No navigation edges declared._');
  } else {
    for (const edge of edges) {
      lines.push(navEdgeLine(edge));
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function cmdExportMd(arg, outDirArg) {
  if (!arg) {
    console.error('Usage: node scripts/project.mjs export-md <project.aub.project.json> [outDir]');
    process.exit(2);
  }
  const projectPath = resolve(arg);
  const loaded = await loadProject(projectPath);
  const { project, screens, errors } = loaded;

  if (errors.length > 0) {
    console.error(`✗ cannot export markdown: ${arg}`);
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }

  const outDir = outDirArg ? resolve(outDirArg) : dirname(projectPath);
  await mkdir(outDir, { recursive: true });

  const written = [];

  const overviewPath = join(outDir, `${project.id}.project.md`);
  await writeFile(overviewPath, `${buildOverviewMarkdown(project, screens)}`, 'utf8');
  written.push(overviewPath);

  for (const { ref, blueprint } of screens) {
    const md = exportMarkdown(blueprint);
    const screenPath = join(outDir, `${ref.id}.ui.md`);
    await writeFile(screenPath, md.endsWith('\n') ? md : `${md}\n`, 'utf8');
    written.push(screenPath);
  }

  console.log(`✓ wrote ${written.length} markdown files to ${outDir}`);
  for (const path of written) {
    console.log(`  - ${path}`);
  }
  process.exit(0);
}

function usage() {
  console.error('Usage:');
  console.error('  node scripts/project.mjs validate <project.aub.project.json>');
  console.error(
    '  node scripts/project.mjs init <out.aub.project.json> <screen1.ui.json> [screen2.ui.json ...]'
  );
  console.error('  node scripts/project.mjs export-md <project.aub.project.json> [outDir]');
}

async function main() {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];
  const rest = argv.slice(1);

  switch (subcommand) {
    case 'validate':
      await cmdValidate(rest[0]);
      break;
    case 'init':
      await cmdInit(rest[0], rest.slice(1));
      break;
    case 'export-md':
      await cmdExportMd(rest[0], rest[1]);
      break;
    default:
      usage();
      process.exit(2);
  }
}

// Only run the CLI when invoked directly (not when imported by validate.mjs).
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
