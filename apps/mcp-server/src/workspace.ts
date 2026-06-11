import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import yaml from 'js-yaml';
import type { Blueprint } from './aub.js';
import { parseProjectText } from './aub.js';

export interface BlueprintEntry {
  path: string;
  absPath: string;
  screenId: string;
  screenName: string;
  version: string;
}

export interface ResolvedBlueprint {
  blueprint: Blueprint;
  entry: BlueprintEntry;
}

export interface ProjectEntry {
  path: string;
  absPath: string;
  id: string;
  name: string;
  screenCount: number;
}

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.aub', '.pnpm-store']);
const BLUEPRINT_PATTERN = /\.ui\.(json|ya?ml)$/i;
export const PROJECT_PATTERN = /\.aub\.project\.(json|ya?ml)$/i;

function isYaml(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

export function parseBlueprintText(text: string, filePath: string): Blueprint {
  const document = isYaml(filePath) ? yaml.load(text) : JSON.parse(text);
  if (!document || typeof document !== 'object') {
    throw new Error(`File does not contain a Blueprint object: ${filePath}`);
  }
  return document as Blueprint;
}

export async function readBlueprintFile(absPath: string): Promise<Blueprint> {
  const text = await readFile(absPath, 'utf8');
  return parseBlueprintText(text, absPath);
}

function toEntry(root: string, absPath: string, blueprint: Blueprint): BlueprintEntry {
  return {
    path: relative(root, absPath).split(sep).join('/'),
    absPath,
    screenId: blueprint?.screen?.id ?? '',
    screenName: blueprint?.screen?.name ?? '',
    version: blueprint?.version ?? '',
  };
}

async function walk(dir: string, out: string[], pattern: RegExp): Promise<void> {
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of dirents) {
    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (IGNORED_DIRS.has(dirent.name) || dirent.name.startsWith('.')) continue;
      await walk(full, out, pattern);
    } else if (dirent.isFile() && pattern.test(dirent.name)) {
      out.push(full);
    }
  }
}

export async function listBlueprints(root: string): Promise<BlueprintEntry[]> {
  const files: string[] = [];
  await walk(root, files, BLUEPRINT_PATTERN);
  const entries: BlueprintEntry[] = [];
  for (const absPath of files.sort()) {
    try {
      const blueprint = await readBlueprintFile(absPath);
      entries.push(toEntry(root, absPath, blueprint));
    } catch {
      // Skip files that fail to parse; validate_blueprint surfaces details on demand.
    }
  }
  return entries;
}

// Resolve a ref that is either a file path (absolute or relative to root) or a screen id.
export async function resolveBlueprint(root: string, ref: string): Promise<ResolvedBlueprint> {
  const trimmed = ref.trim();
  if (!trimmed) throw new Error('A blueprint ref (file path or screen id) is required.');

  const candidate = isAbsolute(trimmed) ? trimmed : resolve(root, trimmed);
  if (BLUEPRINT_PATTERN.test(trimmed) || existsSync(candidate)) {
    if (!existsSync(candidate)) {
      throw new Error(`Blueprint file not found: ${trimmed}`);
    }
    const blueprint = await readBlueprintFile(candidate);
    return { blueprint, entry: toEntry(root, candidate, blueprint) };
  }

  const entries = await listBlueprints(root);
  const match = entries.find((entry) => entry.screenId === trimmed);
  if (!match) {
    throw new Error(`No blueprint found for ref "${ref}" (not a file path and no matching screen id).`);
  }
  const blueprint = await readBlueprintFile(match.absPath);
  return { blueprint, entry: match };
}

export async function listProjects(root: string): Promise<ProjectEntry[]> {
  const files: string[] = [];
  await walk(root, files, PROJECT_PATTERN);
  const entries: ProjectEntry[] = [];
  for (const absPath of files.sort()) {
    try {
      const text = await readFile(absPath, 'utf8');
      const project = parseProjectText(text, absPath) as Record<string, any>;
      entries.push({
        path: relative(root, absPath).split(sep).join('/'),
        absPath,
        id: project?.id ?? '',
        name: project?.name ?? '',
        screenCount: Array.isArray(project?.screens) ? project.screens.length : 0,
      });
    } catch {
      // Skip files that fail to parse; validate_project surfaces details on demand.
    }
  }
  return entries;
}

// Resolve a ref that is either a project file path (absolute or relative to root) or a project id.
export async function resolveProjectRef(root: string, ref: string): Promise<{ projectPath: string }> {
  const trimmed = ref.trim();
  if (!trimmed) throw new Error('A project ref (file path or project id) is required.');

  const candidate = isAbsolute(trimmed) ? trimmed : resolve(root, trimmed);
  if (PROJECT_PATTERN.test(trimmed) || existsSync(candidate)) {
    if (!existsSync(candidate)) {
      throw new Error(`Project file not found: ${trimmed}`);
    }
    return { projectPath: candidate };
  }

  const entries = await listProjects(root);
  const match = entries.find((entry) => entry.id === trimmed);
  if (!match) {
    throw new Error(`No project found for ref "${ref}" (not a file path and no matching project id).`);
  }
  return { projectPath: match.absPath };
}
