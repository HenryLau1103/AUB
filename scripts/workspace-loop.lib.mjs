import { randomUUID } from 'node:crypto';
import { access, link, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { defaultDesignSystem } from './migrate-blueprint.mjs';
import { scoreImplementationSafety } from './implementation-report.lib.mjs';
import { EXTENSION_NAME_PATTERN } from './registry.lib.mjs';

export const WORKSPACE_LOOP_VERSION = '0.1.0';
export const AUB_DIR = '.aub';
export const AUBIGNORE_PATH = '.aubignore';
export const SESSION_PATH = '.aub/session.json';
export const COMPONENT_CANDIDATES_PATH = '.aub/component-candidates.json';
export const SCAN_REPORT_PATH = '.aub/scan-report.json';
export const TEMPLATE_DIR = '.aub/templates';
export const TEMPLATE_FORMAT = 'aub-workspace-template';
export const TEMPLATE_FORMAT_VERSION = '0.1.0';

const IGNORE_DIRS = new Set([
  '.git',
  '.aub',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  'dist',
  'build',
  'node_modules',
  '.pnpm-store',
]);
const DEFAULT_IGNORE_PATTERNS = [
  '.git/',
  '.aub/',
  '.next/',
  '.nuxt/',
  '.output/',
  'coverage/',
  'dist/',
  'build/',
  'node_modules/',
  '.pnpm-store/',
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.cert',
  '*.crt',
  '*.sqlite',
  '*.db',
  '*.log',
];
const HIDDEN_DIR_ALLOWLIST = new Set(['.storybook']);

const SOURCE_EXTENSIONS = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.html']);
const SOURCE_TEXT_CACHE_TTL_MS = 5 * 60 * 1000;
const SOURCE_TEXT_CACHE_MAX_ENTRIES = 2000;
const MAX_SCAN_FILES = 2000;
const MAX_SOURCE_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 64 * 1024 * 1024;
const MAX_TEMPLATE_NAME_LENGTH = 120;
const MAX_TEMPLATE_ID_LENGTH = 120;
const MAX_ROUTE_LENGTH = 220;
const MAX_CATEGORY_LENGTH = 80;
const MAX_SOURCE_KIND_LENGTH = 32;
const MAX_FRAMEWORK_LENGTH = 32;
const CROSS_PROCESS_LOCK_TIMEOUT_MS = 5000;
const CROSS_PROCESS_LOCK_STALE_MS = 30000;
const CROSS_PROCESS_LOCK_RETRY_MS = 25;
const CORE_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;
const CORE_KIND_BY_NAME = [
  [/badge|status|pill/i, 'badge'],
  [/button|cta|action/i, 'button'],
  [/sidebar|nav/i, 'sidebar'],
  [/header|topbar|toolbar/i, 'top_bar'],
  [/table|grid/i, 'data_table'],
  [/form|fields?/i, 'form'],
  [/input|search/i, 'text_input'],
  [/card|tile|panel/i, 'card'],
  [/chart|sparkline|graph/i, 'chart_placeholder'],
  [/modal|dialog/i, 'modal'],
  [/drawer/i, 'drawer'],
  [/tabs?/i, 'tabs'],
  [/list|feed/i, 'list'],
];
const CONTAINER_TYPES = new Set([
  'app_shell', 'page', 'section', 'header', 'sidebar', 'top_bar', 'bottom_nav',
  'stack', 'grid', 'split_pane', 'scroll_area', 'card', 'list', 'detail_panel',
  'timeline', 'activity_feed', 'kanban_board', 'kanban_column', 'form',
  'field_group', 'rich_text_editor', 'button_group', 'menu', 'toolbar',
  'command_palette', 'modal', 'drawer', 'tabs', 'stepper',
]);
const TAG_TYPE_MAP = new Map([
  ['main', 'section'],
  ['section', 'section'],
  ['article', 'card'],
  ['header', 'header'],
  ['aside', 'sidebar'],
  ['nav', 'sidebar'],
  ['form', 'form'],
  ['table', 'data_table'],
  ['ul', 'list'],
  ['ol', 'list'],
  ['h1', 'heading'],
  ['h2', 'heading'],
  ['h3', 'heading'],
  ['h4', 'heading'],
  ['p', 'text'],
  ['span', 'text'],
  ['label', 'text'],
  ['button', 'button'],
  ['a', 'link'],
  ['input', 'text_input'],
  ['textarea', 'textarea'],
  ['select', 'select'],
  ['img', 'image'],
]);

export function resolveWorkspacePath(root, filePath) {
  const absRoot = resolve(root);
  const absPath = isAbsolute(filePath) ? resolve(filePath) : resolve(absRoot, filePath);
  const rel = relative(absRoot, absPath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path must stay inside the workspace root: ${filePath}`);
  }
  return absPath;
}

const writeLocks = new Map();

function isInsideRoot(absRoot, absPath) {
  const rel = relative(absRoot, absPath);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

async function prepareWorkspaceWritePath(root, filePath) {
  const lexicalRoot = resolve(root);
  const absRoot = await realpath(lexicalRoot);
  const absPath = resolveWorkspacePath(lexicalRoot, filePath);
  let current = dirname(absPath);
  while (!(await exists(current))) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const realExistingParent = await realpath(current);
  if (!isInsideRoot(absRoot, realExistingParent)) {
    throw new Error(`Path must stay inside the workspace root: ${filePath}`);
  }
  await mkdir(dirname(absPath), { recursive: true });
  const realParent = await realpath(dirname(absPath));
  if (!isInsideRoot(absRoot, realParent)) {
    throw new Error(`Path must stay inside the workspace root: ${filePath}`);
  }
  return absPath;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(path, fallback) {
  if (!(await exists(path))) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function withPathLock(path, fn) {
  const previous = writeLocks.get(path) ?? Promise.resolve();
  let release;
  const current = new Promise((resolveLock) => {
    release = resolveLock;
  });
  const chained = previous.then(() => current);
  writeLocks.set(path, chained);
  try {
    await previous;
    const releaseCrossProcessLock = await acquireCrossProcessLock(path);
    try {
      return await fn();
    } finally {
      await releaseCrossProcessLock();
    }
  } finally {
    release();
    if (writeLocks.get(path) === chained) writeLocks.delete(path);
  }
}

async function acquireCrossProcessLock(path) {
  const lockPath = `${path}.lock`;
  const startedAt = Date.now();
  for (;;) {
    const token = randomUUID();
    try {
      await mkdir(lockPath);
      const ownerPath = join(lockPath, 'owner.json');
      const writeOwner = () => writeFile(
        ownerPath,
        `${JSON.stringify({ token, pid: process.pid, updatedAt: new Date().toISOString(), target: path }, null, 2)}\n`,
        'utf8'
      );
      try {
        await writeOwner();
      } catch (ownerError) {
        await rm(lockPath, { recursive: true, force: true }).catch(() => {});
        throw ownerError;
      }
      const heartbeat = setInterval(() => {
        void writeOwner().catch(() => {});
      }, Math.max(1000, Math.floor(CROSS_PROCESS_LOCK_STALE_MS / 3)));
      return async () => {
        clearInterval(heartbeat);
        try {
          const owner = JSON.parse(await readFile(ownerPath, 'utf8'));
          if (owner?.token === token) {
            await rm(lockPath, { recursive: true, force: true });
          }
        } catch (releaseError) {
          if (releaseError?.code !== 'ENOENT') throw releaseError;
        }
      };
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > CROSS_PROCESS_LOCK_STALE_MS) {
          await rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError?.code !== 'ENOENT') throw statError;
        continue;
      }
      if (Date.now() - startedAt > CROSS_PROCESS_LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for workspace lock: ${lockPath}`);
      }
      await new Promise((resolveSleep) => setTimeout(resolveSleep, CROSS_PROCESS_LOCK_RETRY_MS));
    }
  }
}

async function writeJsonAtomicLocked(path, value, { overwrite = true } = {}) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
  if (!overwrite) {
    try {
      await link(tempPath, path);
    } catch (err) {
      if (err?.code === 'EEXIST') {
        throw new Error(`Refusing to overwrite existing file: ${path}`);
      }
      throw err;
    } finally {
      await rm(tempPath, { force: true });
    }
  } else {
    let renamed = false;
    try {
      await rename(tempPath, path);
      renamed = true;
    } finally {
      if (!renamed) await rm(tempPath, { force: true });
    }
  }
  return { bytes: new TextEncoder().encode(content).byteLength };
}

async function writeJsonAtomic(path, value, options = {}) {
  return withPathLock(path, () => writeJsonAtomicLocked(path, value, options));
}

async function writeWorkspaceJsonAtomic(root, filePath, value) {
  const path = await prepareWorkspaceWritePath(root, filePath);
  return writeJsonAtomic(path, value);
}

async function updateWorkspaceJson(root, filePath, fallback, mutate) {
  const path = await prepareWorkspaceWritePath(root, filePath);
  return withPathLock(path, async () => {
    const current = await readJsonIfExists(path, fallback);
    const next = await mutate(current);
    const write = await writeJsonAtomicLocked(path, next);
    return { path, value: next, bytes: write.bytes };
  });
}

function toWorkspacePath(root, absPath) {
  return relative(root, absPath).split(sep).join('/');
}

function slugify(value, fallback = 'item') {
  return String(value || fallback)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function snake(value, fallback = 'component') {
  return slugify(value, fallback).replace(/-/g, '_');
}

function title(value, fallback = 'Screen') {
  const cleaned = String(value || fallback)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return cleaned
    ? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;
}

function normalizeText(value, fallback, maxLength = 256) {
  const text = String(value ?? fallback)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = text || String(fallback);
  return safe.length > maxLength ? safe.slice(0, maxLength).trim() : safe;
}

function normalizeNamespace(value, fallback = 'app') {
  const normalized = normalizeText(value, fallback, MAX_TEMPLATE_ID_LENGTH)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return normalized || snake(fallback, 'app');
}

function sanitizeTemplateId(value, fallback) {
  const normalized = slugify(value, fallback).replace(/-/g, '_');
  return normalized.slice(0, MAX_TEMPLATE_ID_LENGTH) || fallback;
}

function normalizeRoute(value, fallback) {
  const route = normalizeText(value, fallback, MAX_ROUTE_LENGTH).replace(/[\s]/g, '-');
  const withSlash = route.startsWith('/') ? route : `/${route}`;
  const collapsed = withSlash.replace(/\/+/g, '/');
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/:-]*$/.test(collapsed)) {
    throw new Error(`Invalid route: ${route}`);
  }
  return collapsed;
}

function normalizeCategory(value, fallback = 'workspace') {
  return normalizeText(value, fallback, MAX_CATEGORY_LENGTH).replace(/[^A-Za-z0-9._-]/g, '-');
}

function normalizeFrameworkLabel(value, fallback = 'other') {
  const normalized = normalizeText(value, fallback, MAX_FRAMEWORK_LENGTH).toLowerCase().replace(/[^a-z]/g, '');
  if (!normalized || normalized === 'undefined') return fallback;
  return normalized;
}

function normalizeSourceKind(value, fallback = 'source-file') {
  const normalized = normalizeText(value, fallback, MAX_SOURCE_KIND_LENGTH);
  if (['route', 'component', 'source-file', 'angular-template'].includes(normalized)) return normalized;
  return fallback;
}

function normalizeCoreType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return CORE_TYPE_PATTERN.test(normalized) ? normalized : null;
}

function normalizeExtensionType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return EXTENSION_NAME_PATTERN.test(normalized) ? normalized : null;
}

function normalizeBlueprintName(value, fallback) {
  return normalizeText(value, fallback, MAX_TEMPLATE_NAME_LENGTH).replace(/[/\\]/g, '-');
}

let sourceTextCacheRoot = '';
const sourceTextCache = new Map();

function clearSourceTextCacheIfRootChanged(root) {
  const normalized = resolve(root);
  if (sourceTextCacheRoot && sourceTextCacheRoot !== normalized) {
    sourceTextCache.clear();
  }
  sourceTextCacheRoot = normalized;
}

function pruneSourceTextCache() {
  const now = Date.now();
  for (const [filePath, entry] of sourceTextCache) {
    if (now - entry.cachedAt > SOURCE_TEXT_CACHE_TTL_MS) {
      sourceTextCache.delete(filePath);
    }
  }
  if (sourceTextCache.size <= SOURCE_TEXT_CACHE_MAX_ENTRIES) return;
  const entries = [...sourceTextCache.entries()].sort((a, b) => {
    const aAt = Number(a[1]?.cachedAt);
    const bAt = Number(b[1]?.cachedAt);
    const aSafe = Number.isFinite(aAt) ? aAt : 0;
    const bSafe = Number.isFinite(bAt) ? bAt : 0;
    return aSafe - bSafe;
  });
  for (let index = 0; index < entries.length - SOURCE_TEXT_CACHE_MAX_ENTRIES; index += 1) {
    sourceTextCache.delete(entries[index][0]);
  }
}

function cacheKey(file) {
  return file.absPath;
}

async function readSourceText(file) {
  try {
    const st = await stat(file.absPath);
    if (st.size > MAX_SOURCE_FILE_BYTES) {
      return { text: '', skipped: true };
    }
    const cached = sourceTextCache.get(cacheKey(file));
    if (cached
      && cached.size === st.size
      && cached.mtimeMs === st.mtimeMs
      && Date.now() - cached.cachedAt <= SOURCE_TEXT_CACHE_TTL_MS
    ) {
      return { text: cached.text, skipped: false };
    }
    const text = await readFile(file.absPath, 'utf8');
    sourceTextCache.set(cacheKey(file), { size: st.size, mtimeMs: st.mtimeMs, text, cachedAt: Date.now() });
    pruneSourceTextCache();
    return { text, skipped: false };
  } catch {
    return { text: '', skipped: false };
  }
}

function createSourceReader() {
  const audit = {
    skippedLargeFiles: 0,
    skippedBudgetFiles: 0,
    totalSourceBytes: 0,
    sourceFilesRead: 0,
  };
  const accounted = new Map();
  return {
    audit,
    async read(file) {
      try {
        const st = await stat(file.absPath);
        if (accounted.has(file.absPath)) {
          const prior = accounted.get(file.absPath);
          if (prior === 'read') return readSourceText(file);
          return { text: '', skipped: true, skippedReason: prior };
        }
        if (st.size > MAX_SOURCE_FILE_BYTES) {
          audit.skippedLargeFiles += 1;
          accounted.set(file.absPath, 'size');
          return { text: '', skipped: true, skippedReason: 'size' };
        }
        if (audit.totalSourceBytes + st.size > MAX_TOTAL_SOURCE_BYTES) {
          audit.skippedBudgetFiles += 1;
          accounted.set(file.absPath, 'budget');
          return { text: '', skipped: true, skippedReason: 'budget' };
        }
        audit.totalSourceBytes += st.size;
        audit.sourceFilesRead += 1;
        accounted.set(file.absPath, 'read');
        const result = await readSourceText(file);
        if (result.skipped) {
          audit.skippedLargeFiles += 1;
          accounted.set(file.absPath, 'size');
          return { ...result, skippedReason: 'size' };
        }
        return result;
      } catch {
        return { text: '', skipped: false };
      }
    },
  };
}

async function readSourceTexts(files, reader = createSourceReader()) {
  const sourceFiles = files.filter((file) => SOURCE_EXTENSIONS.has(extname(file.path).toLowerCase()));
  const contents = new Map();
  const before = { ...reader.audit };
  for (const file of sourceFiles) {
    const result = await reader.read(file);
    contents.set(file.absPath, result.text);
  }
  return {
    contents,
    skippedLargeFiles: reader.audit.skippedLargeFiles - before.skippedLargeFiles,
    skippedBudgetFiles: reader.audit.skippedBudgetFiles - before.skippedBudgetFiles,
    totalSourceBytes: reader.audit.totalSourceBytes - before.totalSourceBytes,
  };
}

function normalizeScanLimit(limit) {
  if (limit === undefined) return MAX_SCAN_FILES;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('scan_project_ui limit must be a positive integer.');
  }
  return Math.min(limit, MAX_SCAN_FILES);
}

function inferNamespace(root, packageJson) {
  const packageName = packageJson?.name;
  const base = packageName
    ? packageName.split('/').pop()
    : basename(root);
  return slugify(base, 'app').replace(/[^a-z0-9]/g, '') || 'app';
}

async function walk(root, dir, out, limit = 2000) {
  return walkWithState(root, dir, out, limit, await createWalkState(root));
}

async function walkWithState(root, dir, out, limit = 2000, state) {
  if (out.length >= limit) return;
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of dirents) {
    if (out.length >= limit) {
      state.audit.limitReached = true;
      return;
    }
    const full = join(dir, dirent.name);
    const relPath = toWorkspacePath(root, full);
    if (shouldIgnoreWorkspaceEntry(relPath, dirent, state)) {
      if (dirent.isDirectory()) state.audit.directoriesSkipped += 1;
      else state.audit.filesSkipped += 1;
      continue;
    }
    if (dirent.isDirectory()) {
      await walkWithState(root, full, out, limit, state);
    } else if (dirent.isFile()) {
      out.push({ path: relPath, absPath: full, name: dirent.name });
      state.audit.filesScanned += 1;
    }
  }
}

async function createWalkState(root) {
  const customPatterns = await readAubIgnore(root);
  const ignoredPatterns = [...DEFAULT_IGNORE_PATTERNS, ...customPatterns];
  return {
    ignoredPatterns,
    matchers: ignoredPatterns.map(compileIgnorePattern).filter(Boolean),
    audit: {
      filesScanned: 0,
      filesSkipped: 0,
      directoriesSkipped: 0,
      ignoredPatterns,
      limitReached: false,
      sourceBytesRead: 0,
      sourceFilesRead: 0,
      sourceFilesSkippedBySize: 0,
      sourceFilesSkippedByBudget: 0,
      sourceByteLimitReached: false,
    },
  };
}

async function readAubIgnore(root) {
  try {
    const text = await readFile(join(root, AUBIGNORE_PATH), 'utf8');
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
  } catch {
    return [];
  }
}

function shouldIgnoreWorkspaceEntry(relPath, dirent, state) {
  if (dirent.isDirectory()) {
    if (IGNORE_DIRS.has(dirent.name)) return true;
    if (dirent.name.startsWith('.') && !HIDDEN_DIR_ALLOWLIST.has(dirent.name)) return true;
  }
  return state.matchers.some((matcher) => matcher(relPath, dirent));
}

function compileIgnorePattern(pattern) {
  const original = String(pattern ?? '').trim().replaceAll('\\', '/');
  if (!original) return null;
  const directoryOnly = original.endsWith('/');
  const normalized = original.replace(/^\/+/, '').replace(/\/+$/, '');
  const hasSlash = normalized.includes('/');
  const hasGlob = /[*?]/.test(normalized);
  if (!hasGlob) {
    return (relPath, dirent) => {
      if (directoryOnly && !dirent.isDirectory()) return false;
      if (relPath === normalized || relPath.startsWith(`${normalized}/`)) return true;
      return !hasSlash && dirent.name === normalized;
    };
  }
  const regex = new RegExp(`^${globToRegex(normalized)}${directoryOnly ? '(?:/.*)?' : '$'}`);
  const nameRegex = hasSlash ? null : new RegExp(`^${globToRegex(normalized)}$`);
  return (relPath, dirent) => {
    if (directoryOnly && !dirent.isDirectory()) return false;
    return regex.test(relPath) || Boolean(nameRegex?.test(dirent.name));
  };
}

function globToRegex(pattern) {
  return pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '.*');
}

async function readPackage(root) {
  const path = join(root, 'package.json');
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function detectFrameworks(packageJson, files) {
  const deps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };
  const names = new Set(Object.keys(deps));
  const frameworks = [];
  if (names.has('next') || files.some((file) => /^app\/.+\/page\.[tj]sx?$|^pages\/.+\.[tj]sx?$/.test(file.path))) {
    frameworks.push('next');
  }
  if (names.has('react') && !frameworks.includes('next')) frameworks.push('react');
  if (names.has('nuxt') || files.some((file) => /^pages\/.+\.vue$|^app\.vue$/.test(file.path))) frameworks.push('nuxt');
  if (names.has('vue') && !frameworks.includes('nuxt')) frameworks.push('vue');
  if (names.has('@angular/core') || files.some((file) => /\.component\.(ts|html)$/.test(file.name))) frameworks.push('angular');
  return frameworks.length ? frameworks : ['unknown'];
}

function routeFromPath(path) {
  let route = path
    .replace(/^src\//, '')
    .replace(/^app\//, '/')
    .replace(/^pages\//, '/')
    .replace(/\/page\.[tj]sx?$/, '')
    .replace(/\/index\.[tj]sx?$/, '')
    .replace(/\.vue$/, '')
    .replace(/\.[tj]sx?$/, '')
    .replace(/\.component\.html$/, '');
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\[(.+?)\]/g, ':$1').replace(/\/+/g, '/');
  return route === '/index' || route === '/app' ? '/' : route;
}

async function detectRoutes(files, reader = createSourceReader()) {
  const webRoutes = files
    .filter((file) => {
      const path = file.path;
      return /^app\/(?:.+\/)?page\.[tj]sx?$/.test(path)
        || /^pages\/.+\.(tsx|jsx|ts|js|vue)$/.test(path)
        || /^src\/pages\/.+\.(tsx|jsx|ts|js|vue)$/.test(path);
    })
    .map((file) => ({
      id: slugify(routeFromPath(file.path), 'route'),
      path: file.path,
      route: routeFromPath(file.path),
      kind: /\.vue$/.test(file.path) ? 'vue-route' : 'route',
    }));

  const angularRoutes = await detectAngularRoutes(files, reader);
  const fallbackAngularTemplates = angularRoutes.length > 0
    ? []
    : files
        .filter((file) => /\.component\.html$/.test(file.path))
        .map((file) => ({
          id: slugify(routeFromPath(file.path), 'route'),
          path: file.path,
          route: routeFromPath(file.path),
          kind: 'angular-template',
        }));

  const byKey = new Map();
  for (const route of [...webRoutes, ...angularRoutes, ...fallbackAngularTemplates]) {
    byKey.set(`${route.route}:${route.path}`, route);
  }
  return [...byKey.values()];
}

async function detectAngularRoutes(files, reader = createSourceReader()) {
  const routingFiles = files.filter((file) => /\.routing\.ts$/.test(file.path) || /app\.routing\.ts$/.test(file.path));
  if (routingFiles.length === 0) return [];
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const { contents: sourceTexts } = await readSourceTexts(
    routingFiles.concat(files.filter((file) => /app-route-paths\.const\.ts$/.test(file.path))),
    reader
  );
  const constants = extractAngularRouteConstants(sourceTexts);
  const routes = [];

  for (const file of routingFiles) {
    const content = sourceTexts.get(file.absPath) ?? '';
    const imports = extractAngularImports(file.path, content);
    const routePattern = /\{[^{}]*path\s*:\s*([^,\n}]+)[^{}]*component\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)[^{}]*}/g;
    for (const match of content.matchAll(routePattern)) {
      const route = resolveAngularRouteExpression(match[1], constants);
      const componentName = match[2];
      if (!route || componentName === 'undefined') continue;
      const componentPath = imports.get(componentName);
      const componentFile = componentPath ? fileByPath.get(componentPath) : null;
      const componentContent = componentFile ? (await reader.read(componentFile)).text : '';
      const htmlPath = componentPath
        ? resolveAngularTemplatePath(componentPath, componentContent, fileByPath)
        : null;
      const routePath = htmlPath && fileByPath.has(htmlPath)
        ? htmlPath
        : componentPath && fileByPath.has(componentPath)
          ? componentPath
          : file.path;
      routes.push({
        id: slugify(`${route}-${componentName}`, 'route'),
        path: routePath,
        route,
        kind: 'angular-route',
      });
    }
  }

  const byRoute = new Map();
  for (const route of routes) byRoute.set(`${route.route}:${route.path}`, route);
  return [...byRoute.values()];
}

function resolveAngularTemplatePath(componentPath, content, fileByPath) {
  const templateUrl = content.match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  if (templateUrl) {
    const normalized = join(dirname(componentPath), templateUrl).split(sep).join('/');
    if (fileByPath.has(normalized)) return normalized;
  }
  const inferred = componentPath.replace(/\.component\.ts$/, '.component.html');
  return fileByPath.has(inferred) ? inferred : null;
}

function extractAngularRouteConstants(sourceTexts) {
  const constants = new Map();
  for (const text of sourceTexts.values()) {
    for (const match of text.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*['"`]([^'"`]*)['"`]/g)) {
      constants.set(`appRoutePaths.${match[1]}`, match[2]);
    }
  }
  return constants;
}

function extractAngularImports(routingPath, content) {
  const imports = new Map();
  for (const match of content.matchAll(/import\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/g)) {
    const spec = match[2];
    const importedPath = resolveAngularImportPath(dirname(routingPath), spec);
    if (!importedPath) continue;
    for (const name of match[1].split(',').map((part) => part.trim()).filter(Boolean)) {
      imports.set(name, importedPath);
    }
  }
  return imports;
}

function resolveAngularImportPath(fromDir, spec) {
  if (spec.startsWith('.')) {
    const normalized = join(fromDir, spec).split(sep).join('/');
    return normalized.endsWith('.ts') ? normalized : `${normalized}.ts`;
  }
  if (spec.startsWith('app/')) {
    const normalized = `src/${spec}`;
    return normalized.endsWith('.ts') ? normalized : `${normalized}.ts`;
  }
  return null;
}

function resolveAngularRouteExpression(expression, constants) {
  const parts = String(expression)
    .trim()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  let route = '';
  for (const part of parts) {
    const quoted = part.match(/^['"`]([^'"`]*)['"`]$/)?.[1];
    if (quoted !== undefined) {
      route += quoted;
      continue;
    }
    if (constants.has(part)) {
      route += constants.get(part);
    }
  }
  if (!route && !parts.some((part) => constants.has(part))) return null;
  return normalizeRoute(route || '/', '/');
}

function extractReactExports(content) {
  const names = new Set();
  for (const match of content.matchAll(/export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1]);
  for (const match of content.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)) names.add(match[1]);
  for (const match of content.matchAll(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)) names.add(match[1]);
  return [...names];
}

function extractVueName(content, path) {
  const define = content.match(/name:\s*['"`]([^'"`]+)['"`]/)?.[1];
  return define ?? title(basename(path), 'VueComponent').replace(/\s+/g, '');
}

function extractAngularSelector(content) {
  return content.match(/selector:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
}

function extractProps(content) {
  const props = new Set();
  const iface = content.match(/interface\s+\w*Props\s*{([\s\S]*?)}/)?.[1];
  if (iface) {
    for (const match of iface.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/g)) props.add(match[1]);
  }
  for (const match of content.matchAll(/@Input\(\)?\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) props.add(match[1]);
  const defineProps = content.match(/defineProps\s*<\s*{([\s\S]*?)}\s*>/)?.[1];
  if (defineProps) {
    for (const match of defineProps.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/g)) props.add(match[1]);
  }
  return [...props].slice(0, 20);
}

function inferCoreType(name) {
  return CORE_KIND_BY_NAME.find(([regex]) => regex.test(name))?.[1] ?? 'card';
}

async function detectStorybook(files, reader = createSourceReader()) {
  const config = files.find((file) => /^\.storybook\/main\.(js|cjs|mjs|ts)$/.test(file.path));
  const storyFiles = files.filter((file) => /\.stories\.(jsx?|tsx?|mdx|vue)$/.test(file.path));
  const stories = [];
  for (const file of storyFiles.slice(0, 100)) {
    const content = (await reader.read(file)).text;
    stories.push({
      path: file.path,
      title: content.match(/title:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null,
      component: content.match(/component:\s*([A-Za-z_$][A-Za-z0-9_$]*)/)?.[1] ?? null,
    });
  }
  return {
    detected: Boolean(config || storyFiles.length > 0),
    configPath: config?.path ?? null,
    storyCount: storyFiles.length,
    stories,
  };
}

async function detectComponents(root, files, namespace, frameworks, storybook = null, reader = createSourceReader()) {
  const candidates = [];
  const before = { ...reader.audit };
  const { contents: sourceTexts } = await readSourceTexts(files, reader);
  for (const file of files) {
    const ext = extname(file.path).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (!/(component|components|ui|widgets|shared|src)/i.test(file.path)) continue;
    const content = sourceTexts.get(file.absPath) ?? '';
    const names = ext === '.vue'
      ? [extractVueName(content, file.path)]
      : ext === '.ts' && /\.component\.ts$/.test(file.path)
        ? [title(basename(file.path).replace(/\.component\.ts$/, ''), 'AngularComponent').replace(/\s+/g, '')]
        : frameworks.includes('angular') && ext === '.ts'
          ? []
          : extractReactExports(content);
    const selector = extractAngularSelector(content);
    for (const componentName of names.filter(Boolean)) {
      const baseName = selector ?? componentName;
      const suggestedComponent = snake(baseName.replace(/^[a-z]+-/, ''), 'component');
      if (!suggestedComponent || ['page', 'index', 'app'].includes(suggestedComponent)) continue;
      const sourceUsage = findUsageLocations(baseName, sourceTexts);
      const suggestedCoreType = inferCoreType(componentName);
      const storybookStories = findStorybookStoriesForComponent(componentName, selector, storybook);
      const confidence = Math.min(0.92, (selector ? 0.82 : 0.72) + (storybookStories.length > 0 ? 0.05 : 0));
      candidates.push({
        id: `${slugify(file.path)}-${suggestedComponent}`,
        status: 'candidate',
        sourcePath: file.path,
        framework: frameworks.includes('angular') && selector ? 'angular' : frameworks[0],
        componentName,
        selector,
        suggestedType: `${namespace}:${suggestedComponent}`,
        suggestedCoreType,
        isContainer: /card|panel|layout|section|list|table|form|shell|modal|drawer/i.test(componentName),
        props: extractProps(content),
        usageCount: Math.max(1, sourceUsage.length),
        sourceUsage,
        storybookStories,
        confidence,
        confidenceReason: selector
          ? `Angular selector and component metadata were found${storybookStories.length ? ', plus Storybook usage.' : '.'}`
          : `Static export/import scan found a reusable project component${storybookStories.length ? ' with Storybook usage.' : '.'}`,
        mappingReason: `Name suggests AUB core type "${suggestedCoreType}" until a user approves a project-specific mapping.`,
        reviewHistory: [],
        reason: 'Static scan found a reusable project component. Approve before adding it to aub.registry.json.',
      });
    }
  }
  const byId = new Map();
  for (const candidate of candidates) byId.set(candidate.id, candidate);
  return {
    candidates: [...byId.values()].slice(0, 100),
    skippedLargeFiles: reader.audit.skippedLargeFiles - before.skippedLargeFiles,
    skippedBudgetFiles: reader.audit.skippedBudgetFiles - before.skippedBudgetFiles,
    totalSourceBytes: reader.audit.totalSourceBytes - before.totalSourceBytes,
  };
}

function findStorybookStoriesForComponent(componentName, selector, storybook) {
  const stories = Array.isArray(storybook?.stories) ? storybook.stories : [];
  return stories
    .filter((story) => {
      const haystack = [story.component, story.title, story.path].filter(Boolean).join(' ');
      return haystack.includes(componentName) || (selector && haystack.includes(selector));
    })
    .map((story) => ({
      path: story.path,
      title: story.title,
    }))
    .slice(0, 10);
}


function countUsage(name, sourceTexts) {
  return Math.max(1, findUsageLocations(name, sourceTexts).length);
}

function findUsageLocations(name, sourceTexts) {
  const tag = String(name).replace(/^[a-z]+-/, '');
  const usages = [];
  for (const [absPath, text] of sourceTexts.entries()) {
    if (text.includes(`<${name}`) || text.includes(`<${tag}`) || text.includes(name)) {
      usages.push({
        file: toWorkspacePath(sourceTextCacheRoot, absPath),
        line: lineNumberAt(text, text.indexOf(name) >= 0 ? text.indexOf(name) : 0),
      });
    }
  }
  return usages.slice(0, 20);
}

function lineNumberAt(text, index) {
  return text.slice(0, Math.max(0, index)).split('\n').length;
}

export async function readAubSession(root) {
  return readJsonIfExists(join(root, SESSION_PATH), {
    version: WORKSPACE_LOOP_VERSION,
    activeBlueprint: null,
    activeProject: null,
    targetRoute: null,
    preview: {
      devServerUrl: null,
      route: null,
      lastImplementationReport: null,
    },
    updatedAt: null,
  });
}

export async function updateAubSession(root, patch = {}) {
  const result = await updateWorkspaceJson(root, SESSION_PATH, {
    version: WORKSPACE_LOOP_VERSION,
    activeBlueprint: null,
    activeProject: null,
    targetRoute: null,
    preview: {
      devServerUrl: null,
      route: null,
      lastImplementationReport: null,
    },
    updatedAt: null,
  }, (current) => ({
    ...current,
    ...patch,
    preview: {
      ...(current.preview ?? {}),
      ...(patch.preview ?? {}),
    },
    updatedAt: new Date().toISOString(),
  }));
  return { path: SESSION_PATH, session: result.value };
}

export async function readComponentCandidates(root) {
  const doc = await readJsonIfExists(join(root, COMPONENT_CANDIDATES_PATH), null);
  if (!doc) {
    return { format: 'aub-component-candidates', format_version: WORKSPACE_LOOP_VERSION, candidates: [] };
  }
  return {
    format: doc.format ?? 'aub-component-candidates',
    format_version: doc.format_version ?? WORKSPACE_LOOP_VERSION,
    candidates: Array.isArray(doc.candidates) ? doc.candidates : [],
  };
}

async function writeComponentCandidates(root, candidates) {
  const doc = {
    format: 'aub-component-candidates',
    format_version: WORKSPACE_LOOP_VERSION,
    updatedAt: new Date().toISOString(),
    candidates,
  };
  await writeWorkspaceJsonAtomic(root, COMPONENT_CANDIDATES_PATH, doc);
  return doc;
}

function mergeScannedCandidatesPreservingReviews(previousCandidates = [], nextCandidates = []) {
  const previousById = new Map(previousCandidates.map((candidate) => [candidate.id, candidate]));
  const nextIds = new Set(nextCandidates.map((candidate) => candidate.id));
  const merged = nextCandidates.map((candidate) => {
    const previous = previousById.get(candidate.id);
    if (!previous) return candidate;
    if (previous.status === 'candidate' && !previous.reviewedAt && !previous.approvedAs) {
      return { ...previous, ...candidate, reviewHistory: previous.reviewHistory ?? candidate.reviewHistory ?? [] };
    }
    return {
      ...candidate,
      status: previous.status,
      approvedAs: previous.approvedAs,
      reviewedAt: previous.reviewedAt,
      reviewHistory: previous.reviewHistory ?? [],
    };
  });

  for (const previous of previousCandidates) {
    if (nextIds.has(previous.id)) continue;
    if (previous.status && previous.status !== 'candidate') {
      merged.push({
        ...previous,
        stale: true,
      });
    }
  }
  return merged;
}

export async function readScanReport(root) {
  return readJsonIfExists(join(root, SCAN_REPORT_PATH), null);
}

function buildScanReport({ packageJson, namespace, frameworks, routes, candidates, storybook, scanAudit }) {
  const warnings = [];
  if (frameworks.includes('unknown')) warnings.push('No supported UI framework was detected.');
  if (routes.length === 0) warnings.push('No route entry files were detected.');
  if (candidates.length === 0) warnings.push('No reusable project components were detected.');
  if (scanAudit.limitReached) warnings.push('Scan file limit was reached; results may be incomplete.');
  if (scanAudit.sourceByteLimitReached) warnings.push('Source byte limit was reached; some source files were skipped.');

  const confidenceInputs = {
    frameworkDetected: !frameworks.includes('unknown'),
    routeCount: routes.length,
    componentCandidateCount: candidates.length,
    storybookDetected: Boolean(storybook?.detected),
    scanLimitReached: Boolean(scanAudit.limitReached),
    sourceByteLimitReached: Boolean(scanAudit.sourceByteLimitReached),
  };
  const trustScore = clampScanScore(
    30
    + (confidenceInputs.frameworkDetected ? 20 : 0)
    + Math.min(20, routes.length * 4)
    + Math.min(20, candidates.length * 2)
    + (confidenceInputs.storybookDetected ? 10 : 0)
    - (confidenceInputs.scanLimitReached ? 20 : 0)
    - (confidenceInputs.sourceByteLimitReached ? 10 : 0)
  );

  return {
    format: 'aub-scan-report',
    format_version: WORKSPACE_LOOP_VERSION,
    updatedAt: new Date().toISOString(),
    packageName: packageJson?.name ?? null,
    namespace,
    frameworks,
    summary: {
      routes: routes.length,
      componentCandidates: candidates.length,
      unresolvedCandidates: candidates.filter((candidate) => candidate.status === 'candidate').length,
      filesScanned: scanAudit.filesScanned,
      filesSkipped: scanAudit.filesSkipped,
      directoriesSkipped: scanAudit.directoriesSkipped,
      limitReached: scanAudit.limitReached,
      sourceBytesRead: scanAudit.sourceBytesRead ?? 0,
      sourceFilesRead: scanAudit.sourceFilesRead ?? 0,
      sourceFilesSkippedBySize: scanAudit.sourceFilesSkippedBySize ?? 0,
      sourceFilesSkippedByBudget: scanAudit.sourceFilesSkippedByBudget ?? 0,
      sourceByteLimitReached: Boolean(scanAudit.sourceByteLimitReached),
      trustScore,
    },
    trust: {
      score: trustScore,
      grade: trustScore >= 80 ? 'high' : trustScore >= 60 ? 'medium' : 'low',
      breakdown: {
        frameworkDetected: confidenceInputs.frameworkDetected,
        routeResolved: routes.length > 0,
        routeCount: routes.length,
        componentCandidateCount: candidates.length,
        storybookDetected: Boolean(storybook?.detected),
        filesScanned: scanAudit.filesScanned,
        filesSkipped: scanAudit.filesSkipped,
        directoriesSkipped: scanAudit.directoriesSkipped,
        scanLimitReached: Boolean(scanAudit.limitReached),
        sourceBytesRead: scanAudit.sourceBytesRead ?? 0,
        sourceFilesRead: scanAudit.sourceFilesRead ?? 0,
        sourceFilesSkippedBySize: scanAudit.sourceFilesSkippedBySize ?? 0,
        sourceFilesSkippedByBudget: scanAudit.sourceFilesSkippedByBudget ?? 0,
        sourceByteLimitReached: Boolean(scanAudit.sourceByteLimitReached),
      },
      reasons: [
        confidenceInputs.frameworkDetected ? 'Supported framework detected.' : 'Framework fallback only.',
        routes.length > 0 ? 'Route entries were found.' : 'No route entries were found.',
        candidates.length > 0 ? 'Reusable project components were extracted as candidates.' : 'No component candidates were extracted.',
        storybook?.detected ? 'Storybook stories can help component review.' : 'No Storybook metadata was detected.',
      ],
      warnings,
      confidenceInputs,
    },
    storybook: {
      detected: Boolean(storybook?.detected),
      configPath: storybook?.configPath ?? null,
      storyCount: storybook?.storyCount ?? 0,
    },
    routes: routes.map((route) => ({
      id: route.id,
      route: route.route,
      path: route.path,
      kind: route.kind,
    })),
    componentCandidates: candidates.map((candidate) => ({
      id: candidate.id,
      componentName: candidate.componentName,
      sourcePath: candidate.sourcePath,
      suggestedType: candidate.suggestedType,
      suggestedCoreType: candidate.suggestedCoreType,
      status: candidate.status,
      confidence: candidate.confidence,
      usageCount: candidate.usageCount,
    })),
    scanAudit: {
      filesScanned: scanAudit.filesScanned,
      filesSkipped: scanAudit.filesSkipped,
      directoriesSkipped: scanAudit.directoriesSkipped,
      ignoredPatterns: scanAudit.ignoredPatterns,
      limitReached: scanAudit.limitReached,
      sourceBytesRead: scanAudit.sourceBytesRead ?? 0,
      sourceFilesSkippedBySize: scanAudit.sourceFilesSkippedBySize ?? 0,
      sourceFilesSkippedByBudget: scanAudit.sourceFilesSkippedByBudget ?? 0,
      sourceByteLimitReached: Boolean(scanAudit.sourceByteLimitReached),
    },
  };
}

function clampScanScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function writeScanReport(root, report) {
  await writeWorkspaceJsonAtomic(root, SCAN_REPORT_PATH, report);
  return report;
}

export async function listWorkspaceTemplates(root) {
  const dir = join(root, TEMPLATE_DIR);
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const templates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.aub.template.json')) continue;
    const absPath = join(dir, entry.name);
    try {
      const template = JSON.parse(await readFile(absPath, 'utf8'));
      templates.push({
        path: toWorkspacePath(root, absPath),
        ...template,
      });
    } catch {
      // Invalid templates are ignored by status and surfaced when opened directly.
    }
  }
  return templates.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function getWorkspaceStatus(root) {
  clearSourceTextCacheIfRootChanged(root);
  const files = [];
  const walkState = await createWalkState(root);
  await walkWithState(root, root, files, 1500, walkState);
  const sourceReader = createSourceReader();
  const packageJson = await readPackage(root);
  const frameworks = detectFrameworks(packageJson, files);
  const routes = await detectRoutes(files, sourceReader);
  const storybook = await detectStorybook(files, sourceReader);
  const session = await readAubSession(root);
  const candidates = await readComponentCandidates(root);
  const templates = await listWorkspaceTemplates(root);
  const scanReport = await readScanReport(root);
  walkState.audit.sourceBytesRead = Math.max(
    sourceReader.audit.totalSourceBytes,
    scanReport?.summary?.sourceBytesRead ?? 0
  );
  walkState.audit.sourceFilesRead = Math.max(
    sourceReader.audit.sourceFilesRead,
    scanReport?.summary?.sourceFilesRead ?? 0
  );
  walkState.audit.sourceFilesSkippedBySize = Math.max(
    sourceReader.audit.skippedLargeFiles,
    scanReport?.summary?.sourceFilesSkippedBySize ?? 0
  );
  walkState.audit.sourceFilesSkippedByBudget = Math.max(
    sourceReader.audit.skippedBudgetFiles,
    scanReport?.summary?.sourceFilesSkippedByBudget ?? 0
  );
  walkState.audit.sourceByteLimitReached = sourceReader.audit.skippedBudgetFiles > 0
    || Boolean(scanReport?.summary?.sourceByteLimitReached);
  const implementationReport = await readImplementationReportSummary(root, session);
  return {
    root,
    aubDir: AUB_DIR,
    packageName: packageJson?.name ?? null,
    frameworks,
    storybook,
    scanAudit: walkState.audit,
    scanReport: scanReport ? { path: SCAN_REPORT_PATH, ...scanReport } : null,
    routeCount: routes.length,
    componentCandidateCount: candidates.candidates.length,
    templateCount: templates.length,
    session,
    implementationReport,
    routes,
    componentCandidates: candidates.candidates,
    templates,
  };
}

async function readImplementationReportSummary(root, session) {
  const reportPath = session?.preview?.lastImplementationReport;
  if (!reportPath) return null;
  try {
    const absPath = resolveWorkspacePath(root, reportPath);
    const report = JSON.parse(await readFile(absPath, 'utf8'));
    const safetyScore = report.safety_score ?? await readSafetyScoreForSession(root, session, report);
    const acceptance = Array.isArray(report.acceptance_results) ? report.acceptance_results : [];
    return {
      path: toWorkspacePath(root, absPath),
      screenId: report.blueprint?.screen_id ?? null,
      route: report.implementation?.route ?? null,
      pass: acceptance.filter((item) => item.status === 'pass').length,
      fail: acceptance.filter((item) => item.status === 'fail').length,
      needsReview: acceptance.filter((item) => item.status === 'needs-review').length,
      evidence: acceptance.reduce((count, item) => count + (Array.isArray(item.evidence) ? item.evidence.length : 0), 0),
      safetyScore,
    };
  } catch {
    return {
      path: reportPath,
      error: 'Unable to read implementation report.',
    };
  }
}

async function readSafetyScoreForSession(root, session, report) {
  const blueprintPath = session?.activeBlueprint;
  if (!blueprintPath) return null;
  try {
    const blueprint = JSON.parse(await readFile(resolveWorkspacePath(root, blueprintPath), 'utf8'));
    return scoreImplementationSafety(blueprint, report);
  } catch {
    return null;
  }
}

export async function scanProjectUi(root, options = {}) {
  clearSourceTextCacheIfRootChanged(root);
  const files = [];
  const limit = normalizeScanLimit(options.limit);
  const walkState = await createWalkState(root);
  await walkWithState(root, root, files, limit, walkState);
  const sourceReader = createSourceReader();
  const packageJson = await readPackage(root);
  const namespace = normalizeNamespace(options.namespace ?? inferNamespace(root, packageJson), 'app');
  const frameworks = detectFrameworks(packageJson, files);
  const routes = await detectRoutes(files, sourceReader);
  const storybook = await detectStorybook(files, sourceReader);
  const { candidates: scannedCandidates } = await detectComponents(root, files, namespace, frameworks, storybook, sourceReader);
  walkState.audit.sourceBytesRead = sourceReader.audit.totalSourceBytes;
  walkState.audit.sourceFilesRead = sourceReader.audit.sourceFilesRead;
  walkState.audit.sourceFilesSkippedBySize = sourceReader.audit.skippedLargeFiles;
  walkState.audit.sourceFilesSkippedByBudget = sourceReader.audit.skippedBudgetFiles;
  walkState.audit.sourceByteLimitReached = sourceReader.audit.skippedBudgetFiles > 0;
  await mkdir(join(root, AUB_DIR), { recursive: true });
  const doc = await withPathLock(join(root, AUB_DIR, 'component-candidates.review'), async () => {
    const previous = await readComponentCandidates(root);
    const mergedCandidates = mergeScannedCandidatesPreservingReviews(previous.candidates, scannedCandidates);
    return writeComponentCandidates(root, mergedCandidates);
  });
  const candidates = doc.candidates;
  const scanReport = await writeScanReport(root, buildScanReport({
    packageJson,
    namespace,
    frameworks,
    routes,
    candidates,
    storybook,
    scanAudit: walkState.audit,
  }));
  return {
    root,
    packageName: packageJson?.name ?? null,
    namespace,
    frameworks,
    storybook,
    scanAudit: walkState.audit,
    scanReportPath: SCAN_REPORT_PATH,
    scanReport,
    routes,
    components: candidates,
    skippedSourceFiles: sourceReader.audit.skippedLargeFiles,
    componentCandidatesPath: COMPONENT_CANDIDATES_PATH,
    componentCandidates: doc,
  };
}

async function makeBlueprint({ id, name, framework, source, route, root, files, candidates = [], reader = createSourceReader() }) {
  const sourceFile = files.find((file) => file.path === source.path);
  const sourceText = sourceFile ? (await reader.read(sourceFile)).text : '';
  const extracted = extractBlueprintStructure({
    sourcePath: source.path,
    sourceText,
    framework,
    candidates,
  });
  const screenId = `workspace.${slugify(id, 'screen').replace(/-/g, '.')}`;
  const rootChildren = extracted.nodes.filter((node) => node.parent_id === 'root').map((node) => node.id);
  const nodes = [{
    id: 'root',
    type: 'page',
    name,
    role: `Workspace-derived screen from ${source.path}.`,
    parent_id: null,
    children: rootChildren,
    layout: { mode: 'freeform' },
  }, ...extracted.nodes];
  if (extracted.nodes.length === 0) {
    nodes[0].children = ['source_summary'];
    nodes.push({
      id: 'source_summary',
      type: 'section',
      name: 'Source summary',
      role: 'Fallback node because no semantic source structure could be extracted.',
      parent_id: 'root',
      children: ['source_summary_text'],
      layout: { mode: 'auto', display: 'flex', direction: 'column', gap: { x: 12, y: 12 }, padding: { top: 24, right: 24, bottom: 24, left: 24 } },
      placements: placementForRootChild(0),
      source: { file: source.path },
    }, {
      id: 'source_summary_text',
      type: 'text',
      name: 'Source summary text',
      role: 'Records where this low-confidence candidate came from.',
      parent_id: 'source_summary',
      children: [],
      content: { text: `Generated from ${framework} source ${source.path}${route ? ` (${route})` : ''}. Review before approving.` },
      source: { file: source.path },
    });
  }
  return {
    blueprint: {
      version: '0.3.0',
      screen: {
        id: screenId,
        name,
        type: inferScreenType(route, extracted.nodes),
        platform: 'web',
        primary_user_goal: `Review and implement the ${name} screen using the existing project source as context.`,
        notes: 'Generated by AUB workspace scanner. Candidate custom components require approval before registry writes.',
      },
      viewports: [
        { id: 'desktop', width: 1440, height: 900 },
        { id: 'tablet', width: 1024, height: 768 },
        { id: 'mobile', width: 390, height: 844 },
      ],
      design_system: defaultDesignSystem(),
      provenance: {
        source_kind: 'other',
        framework,
        importer_version: `workspace-loop-${WORKSPACE_LOOP_VERSION}`,
        entry_file: source.path,
        source_files: [...new Set([source.path, ...extracted.sourceFiles])],
      },
      nodes,
      interactions: extracted.interactions,
      responsive: extracted.responsive,
      acceptance: [
        { id: 'acc_workspace_source_structure', type: 'layout', statement: 'The implementation preserves the reviewed Blueprint hierarchy and source route intent.', target: 'root', priority: 'must', verification_method: 'manual_ia_review' },
        { id: 'acc_workspace_component_reuse', type: 'content', statement: 'Approved custom components are reused through aub.registry.json mappings instead of recreated as lookalikes.', target: '*', priority: 'must', verification_method: 'code_diff' },
        { id: 'acc_workspace_responsive', type: 'responsive', statement: 'Desktop, tablet, and mobile layouts remain readable with no horizontal overflow.', target: 'desktop,tablet,mobile', priority: 'must', verification_method: 'screenshot_diff' },
        { id: 'acc_workspace_interactions', type: 'interaction', statement: 'Visible controls keep their original route/component behavior.', target: '*', priority: 'must', verification_method: 'manual_ia_review' },
        { id: 'acc_workspace_a11y', type: 'a11y', statement: 'Interactive elements expose accessible labels and focus states.', target: '*', priority: 'should', verification_method: 'axe_audit' },
      ],
    },
    missingMappings: extracted.missingMappings,
    sourceReferences: extracted.sourceReferences,
    trustBreakdown: buildTemplateTrustBreakdown(extracted, Boolean(route)),
    confidence: calculateTemplateConfidence(extracted, Boolean(route)),
  };
}

function buildTemplateTrustBreakdown(extracted, hasRoute) {
  const nodeCount = extracted.nodes.length;
  const sourceBackedNodes = extracted.sourceReferences.length;
  const sourceReferenceCoverage = nodeCount === 0
    ? 0
    : Math.round((sourceBackedNodes / nodeCount) * 100);
  const reasons = [];
  if (hasRoute) reasons.push('Source route was resolved.');
  else reasons.push('No route was resolved; template is source-file only.');
  if (nodeCount >= 4) reasons.push('Scanner extracted a non-placeholder node tree.');
  else reasons.push('Scanner extracted only a shallow node tree.');
  if (sourceReferenceCoverage >= 90) reasons.push('Most nodes have source references.');
  else reasons.push('Some nodes lack source references.');
  if (extracted.missingMappings.length > 0) reasons.push('Custom component mappings need user review.');
  else reasons.push('No unresolved custom component mappings were detected.');

  return {
    routeResolved: hasRoute,
    nodeCount,
    sourceBackedNodes,
    sourceReferenceCoverage,
    semanticTagsMapped: extracted.metrics.semanticNodes,
    interactionCount: extracted.metrics.interactions,
    missingMappings: extracted.metrics.missingMappings,
    unresolvedCustomComponents: extracted.missingMappings.length,
    reasons,
  };
}

function extractBlueprintStructure({ sourcePath, sourceText, framework, candidates }) {
  const candidateByTag = buildCandidateLookup(candidates);
  const nodes = [];
  const interactions = [];
  const missingMappings = [];
  const sourceReferences = [];
  const sourceFiles = [];
  const stack = [{ tag: 'root', nodeId: 'root', isContainer: true }];
  const seenMappings = new Set();
  const idCounts = new Map();
  const sourceFileSet = new Set();
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9_.:-]*)([^<>]*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(sourceText)) !== null) {
    const [raw, tag, rawAttrs = '', selfClosing = ''] = match;
    const closing = raw.startsWith('</');
    if (closing) {
      while (stack.length > 1) {
        const current = stack.pop();
        if (current.tag === tag) break;
      }
      continue;
    }
    const attrs = parseAttributes(rawAttrs);
    const info = nodeInfoForTag({ tag, attrs, sourceText, index: match.index, sourcePath, candidateByTag });
    if (!info) continue;
    const parent = nearestContainer(stack);
    const id = uniqueNodeId(`${info.type}_${slugify(info.name, info.type)}`, idCounts);
    const isContainer = CONTAINER_TYPES.has(info.type);
    const node = {
      id,
      type: info.type,
      name: normalizeBlueprintName(info.name, title(tag, info.type)),
      role: info.role,
      parent_id: parent.nodeId,
      children: isContainer ? [] : [],
      source: {
        file: info.sourceFile,
        line: lineNumberAt(sourceText, match.index),
        selector: info.selector,
      },
    };
    if (parent.nodeId === 'root') node.placements = placementForRootChild(nodes.filter((item) => item.parent_id === 'root').length);
    if (isContainer) node.layout = layoutForType(info.type);
    if (info.content) node.content = info.content;
    nodes.push(node);
    const parentNode = nodes.find((item) => item.id === parent.nodeId);
    if (parentNode && Array.isArray(parentNode.children)) parentNode.children.push(id);
    sourceReferences.push({ nodeId: id, file: node.source.file, line: node.source.line, selector: node.source.selector });
    sourceFileSet.add(info.sourceFile);
    if (info.customCandidate?.sourcePath) sourceFileSet.add(info.customCandidate.sourcePath);
    if (info.customCandidate) {
      const key = info.customCandidate.suggestedType ?? info.customCandidate.id;
      if (!seenMappings.has(key)) {
        seenMappings.add(key);
        missingMappings.push({
          candidateId: info.customCandidate.id,
          componentName: info.customCandidate.componentName,
          suggestedType: info.customCandidate.suggestedType,
          suggestedCoreType: info.customCandidate.suggestedCoreType,
          sourcePath: info.customCandidate.sourcePath,
          confidence: info.customCandidate.confidence,
          reason: info.customCandidate.mappingReason ?? info.customCandidate.reason,
        });
      }
    }
    if (info.interaction) {
      interactions.push({
        id: uniqueNodeId(`ix_${id}`, idCounts),
        trigger: info.interaction.trigger,
        source_node_id: id,
        action: info.interaction.action,
        result_state: info.interaction.result_state,
      });
    }
    if (isContainer && !selfClosing && !isVoidTag(tag)) stack.push({ tag, nodeId: id, isContainer });
  }
  for (const file of sourceFileSet) sourceFiles.push(file);
  return {
    nodes: pruneEmptyChildren(nodes),
    interactions: interactions.slice(0, 20),
    responsive: [
      { viewport: 'mobile', rule: 'stack', target_node_id: 'root', changes: { source: 'workspace-scan' } },
    ],
    missingMappings,
    sourceReferences,
    sourceFiles,
    metrics: {
      nodes: nodes.length,
      semanticNodes: nodes.filter((node) => node.source?.selector).length,
      missingMappings: missingMappings.length,
      interactions: interactions.length,
      framework,
    },
  };
}

function buildCandidateLookup(candidates) {
  const lookup = new Map();
  for (const candidate of candidates) {
    if (candidate.componentName) lookup.set(candidate.componentName, candidate);
    if (candidate.selector) lookup.set(candidate.selector, candidate);
    if (candidate.suggestedType) lookup.set(candidate.suggestedType, candidate);
  }
  return lookup;
}

function nodeInfoForTag({ tag, attrs, sourceText, index, sourcePath, candidateByTag }) {
  if (shouldSkipTag(tag)) return null;
  const candidate = candidateByTag.get(tag);
  const lower = tag.toLowerCase();
  const className = attrs.className ?? attrs.class ?? '';
  const candidateType = candidate?.suggestedCoreType && CORE_TYPE_PATTERN.test(candidate.suggestedCoreType)
    ? candidate.suggestedCoreType
    : null;
  const type = candidateType
    ?? TAG_TYPE_MAP.get(lower)
    ?? typeFromClassName(className)
    ?? (isCustomTag(tag) ? 'card' : null);
  if (!type) return null;
  const text = extractInlineText(sourceText, index);
  const selector = className ? `${tag}.${String(className).split(/\s+/).filter(Boolean).join('.')}` : tag;
  const name = candidate?.componentName
    ?? readableName(attrs['aria-label'] ?? attrs.title ?? attrs.name ?? text ?? className ?? tag, tag);
  return {
    type,
    name,
    selector,
    sourceFile: sourcePath,
    customCandidate: candidate ?? (isCustomTag(tag) ? { componentName: tag, suggestedCoreType: type, sourcePath, confidence: 0.45, reason: 'Capitalized or namespaced tag needs review.' } : null),
    role: roleForNode({ tag, type, candidate, className }),
    content: contentForNode({ type, tag, attrs, text, className }),
    interaction: interactionForNode({ type, tag, attrs, text }),
  };
}

function shouldSkipTag(tag) {
  return ['Fragment', 'React.Fragment', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'option', 'svg', 'path', 'g', 'ng-container', 'ng-template'].includes(tag);
}

function isVoidTag(tag) {
  return ['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tag.toLowerCase());
}

function isCustomTag(tag) {
  return /^[A-Z]/.test(tag) || tag.includes('-');
}

function typeFromClassName(className) {
  if (!className) return null;
  return inferCoreType(className);
}

function parseAttributes(rawAttrs) {
  const attrs = {};
  const attrPattern = /([:@*()[\]A-Za-z_$][:@*()[\]A-Za-z0-9_$.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|{([^}]*)})/g;
  for (const match of rawAttrs.matchAll(attrPattern)) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function readableName(value, fallback) {
  return title(String(value || fallback).replace(/[{}()[\].:'"`]/g, ' '), title(fallback, 'Node'));
}

function roleForNode({ tag, type, candidate, className }) {
  if (candidate) {
    return `Project component ${candidate.componentName} scanned from ${candidate.sourcePath}; review mapping before implementation reuse.`;
  }
  if (className) return `${type} inferred from <${tag}> with class "${className}".`;
  return `${type} inferred from <${tag}> in the source route.`;
}

function contentForNode({ type, tag, attrs, text, className }) {
  if (type === 'heading' || type === 'text') return { text: text || readableName(className || tag, tag) };
  if (type === 'button' || type === 'link') return { text: text || attrs['aria-label'] || readableName(className || tag, tag), action: attrs.href ? `navigate:${attrs.href}` : 'trigger:source-action' };
  if (type === 'text_input' || type === 'textarea' || type === 'select') return { label: attrs['aria-label'] || attrs.name || readableName(className || tag, tag), placeholder: attrs.placeholder ?? '' };
  if (type === 'image') return { src: attrs.src ?? 'source-image', alt: attrs.alt ?? readableName(className || tag, tag) };
  if (type === 'data_table') return { columns: [{ id: 'primary', header: 'Primary' }, { id: 'status', header: 'Status' }] };
  if (type === 'badge' || type === 'tag') return { label: text || readableName(className || tag, tag) };
  return undefined;
}

function interactionForNode({ type, attrs, text }) {
  if (attrs['(click)'] || attrs.onClick || type === 'button') {
    return {
      trigger: 'click',
      action: attrs['(click)'] ? `invoke:${attrs['(click)']}` : 'invoke:source-action',
      result_state: `Source control${text ? ` "${text}"` : ''} keeps its existing behavior.`,
    };
  }
  if (type === 'form') {
    return {
      trigger: 'submit',
      action: 'submit:source-form',
      result_state: 'Form submission keeps its existing behavior.',
    };
  }
  return null;
}

function extractInlineText(sourceText, index) {
  const after = sourceText.slice(index).replace(/^<[^>]+>/, '');
  const raw = after.match(/^([^<{]{1,80})/)?.[1]?.trim();
  return raw ? raw.replace(/\s+/g, ' ') : '';
}

function nearestContainer(stack) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].isContainer) return stack[index];
  }
  return stack[0];
}

function uniqueNodeId(base, counts) {
  const normalized = slugify(base, 'node').replace(/-/g, '_').slice(0, 96);
  const count = (counts.get(normalized) ?? 0) + 1;
  counts.set(normalized, count);
  return count === 1 ? normalized : `${normalized}_${count}`;
}

function pruneEmptyChildren(nodes) {
  return nodes.map((node) => {
    if (!CONTAINER_TYPES.has(node.type)) return { ...node, children: [] };
    return node;
  });
}

function layoutForType(type) {
  if (type === 'grid') return { mode: 'auto', display: 'grid', grid: { columns: 2 }, gap: { x: 16, y: 16 }, padding: { top: 16, right: 16, bottom: 16, left: 16 } };
  if (type === 'header' || type === 'top_bar') return { mode: 'auto', display: 'flex', direction: 'row', justify: 'space-between', align: 'center', gap: { x: 16, y: 16 }, padding: { top: 16, right: 16, bottom: 16, left: 16 } };
  return { mode: 'auto', display: 'flex', direction: 'column', gap: { x: 12, y: 12 }, padding: { top: 16, right: 16, bottom: 16, left: 16 } };
}

function placementForRootChild(index) {
  const row = Math.floor(index / 2);
  const column = index % 2;
  return {
    desktop: { x: 64 + column * 460, y: 64 + row * 240, width: column === 0 ? 420 : 560, height: 200, z_index: 1 },
    tablet: { x: 48, y: 56 + index * 220, width: 640, height: 200, z_index: 1 },
    mobile: { x: 16, y: 48 + index * 180, width: 358, height: 160, z_index: 1 },
  };
}

function inferScreenType(route, nodes) {
  if (route === '/') return 'landing';
  if (nodes.some((node) => node.type === 'data_table')) return 'admin_table';
  if (nodes.some((node) => node.type === 'form')) return 'form';
  return 'workspace';
}

function calculateTemplateConfidence(extracted, hasRoute) {
  let score = 0.35;
  if (hasRoute) score += 0.12;
  if (extracted.nodes.length >= 4) score += 0.18;
  if (extracted.sourceReferences.length >= extracted.nodes.length && extracted.nodes.length > 0) score += 0.12;
  if (extracted.interactions.length > 0) score += 0.08;
  if (extracted.missingMappings.length > 0) score += 0.08;
  if (extracted.missingMappings.length > 4) score -= 0.08;
  return Math.max(0.2, Math.min(0.92, Number(score.toFixed(2))));
}

export async function generateTemplateFromSource(root, args = {}) {
  if (!args.sourcePath) throw new Error('Provide sourcePath.');
  if (typeof args.sourcePath !== 'string') throw new Error('sourcePath must be a string.');
  clearSourceTextCacheIfRootChanged(root);
  const sourcePath = resolveWorkspacePath(root, args.sourcePath);
  const relPath = toWorkspacePath(root, sourcePath);
  const files = [];
  const walkState = await createWalkState(root);
  await walkWithState(root, root, files, 2000, walkState);
  const sourceReader = createSourceReader();
  const candidates = (await readComponentCandidates(root)).candidates;
  const framework = normalizeFrameworkLabel(
    typeof args.framework === 'string' ? args.framework : inferFrameworkFromPath(relPath),
    'web'
  );
  const name = normalizeBlueprintName(
    typeof args.name === 'string' ? args.name : title(basename(relPath), 'Workspace screen'),
    title(basename(relPath), 'Workspace screen')
  );
  const templateId = sanitizeTemplateId(args.id, `${framework}-${name}`);
  const route = normalizeRoute(typeof args.route === 'string' ? args.route : routeFromPath(relPath), routeFromPath(relPath));
  const built = await makeBlueprint({
    id: templateId,
    name,
    framework,
    route,
    root,
    files,
    source: { path: relPath },
    candidates,
    reader: sourceReader,
  });
  const template = {
    format: TEMPLATE_FORMAT,
    format_version: TEMPLATE_FORMAT_VERSION,
    id: templateId,
    name,
    category: normalizeCategory(args.category, 'workspace'),
    framework,
    source: {
      kind: normalizeSourceKind(args.sourceKind, 'source-file'),
      path: relPath,
      route,
    },
    blueprint: built.blueprint,
    registryRefs: built.missingMappings
      .map((candidate) => candidate.suggestedType ?? candidate.suggestedCoreType)
      .filter((value) => typeof value === 'string' && value.length > 0),
    missingMappings: built.missingMappings,
    sourceReferences: built.sourceReferences,
    trustBreakdown: built.trustBreakdown,
    confidence: built.confidence,
    status: args.status === 'approved' ? 'approved' : 'candidate',
    createdAt: new Date().toISOString(),
  };
  const normalizedOutput = typeof args.output === 'string' && args.output.length > 0
    ? args.output
    : `${TEMPLATE_DIR}/${slugify(template.id)}.aub.template.json`;
  const outputRef = normalizedOutput.endsWith('.aub.template.json')
    ? normalizedOutput
    : `${normalizedOutput.replace(/\.aub\.template\.json$/i, '').replace(/[/\\]+$/g, '')}.aub.template.json`;
  const outputPath = await prepareWorkspaceWritePath(root, outputRef);
  await writeJsonAtomic(outputPath, template);
  return {
    savedPath: toWorkspacePath(root, outputPath),
    template,
    scanAudit: walkState.audit,
  };
}

function inferFrameworkFromPath(path) {
  if (path.endsWith('.vue')) return 'vue';
  if (/\.component\.(ts|html)$/.test(path)) return 'angular';
  if (/^app\//.test(path) || /^pages\//.test(path)) return 'next';
  return 'react';
}

export async function approveComponentCandidate(root, args = {}) {
  if (!args.id) throw new Error('Provide candidate id.');
  await mkdir(join(root, AUB_DIR), { recursive: true });
  return withPathLock(join(root, AUB_DIR, 'component-candidates.review'), () =>
    approveComponentCandidateLocked(root, args)
  );
}

async function approveComponentCandidateLocked(root, args = {}) {
  if (args.action === 'ignore') {
    const result = await updateWorkspaceJson(root, COMPONENT_CANDIDATES_PATH, {
      format: 'aub-component-candidates',
      format_version: WORKSPACE_LOOP_VERSION,
      candidates: [],
    }, (doc) => {
      const candidate = (doc.candidates ?? []).find((item) => item.id === args.id);
      if (!candidate) throw new Error(`Component candidate not found: ${args.id}`);
      assertCandidateCanBeReviewed(candidate, args.id);
      candidate.status = 'ignored';
      candidate.reviewedAt = new Date().toISOString();
      candidate.reviewHistory = [...(candidate.reviewHistory ?? []), { action: 'ignore', reviewedAt: candidate.reviewedAt }];
      return { ...doc, updatedAt: new Date().toISOString(), candidates: doc.candidates ?? [] };
    });
    return { candidate: result.value.candidates.find((item) => item.id === args.id), registryPath: null };
  }

  if (args.action === 'map_core') {
    const result = await updateWorkspaceJson(root, COMPONENT_CANDIDATES_PATH, {
      format: 'aub-component-candidates',
      format_version: WORKSPACE_LOOP_VERSION,
      candidates: [],
    }, (doc) => {
      const candidate = (doc.candidates ?? []).find((item) => item.id === args.id);
      if (!candidate) throw new Error(`Component candidate not found: ${args.id}`);
      assertCandidateCanBeReviewed(candidate, args.id);
      const normalizedCoreType = normalizeCoreType(args.coreType ?? candidate.suggestedCoreType);
      if (!normalizedCoreType) {
        throw new Error(`Invalid core type: ${args.coreType ?? candidate.suggestedCoreType}`);
      }
      candidate.status = 'approved';
      candidate.approvedAs = normalizedCoreType;
      candidate.reviewedAt = new Date().toISOString();
      candidate.reviewHistory = [...(candidate.reviewHistory ?? []), { action: 'map_core', approvedAs: normalizedCoreType, reviewedAt: candidate.reviewedAt }];
      return { ...doc, updatedAt: new Date().toISOString(), candidates: doc.candidates ?? [] };
    });
    return { candidate: result.value.candidates.find((item) => item.id === args.id), registryPath: null };
  }

  if (args.action !== 'create_extension') {
    throw new Error('action must be one of create_extension, map_core, ignore.');
  }

  const doc = await readComponentCandidates(root);
  const candidate = doc.candidates.find((item) => item.id === args.id);
  if (!candidate) throw new Error(`Component candidate not found: ${args.id}`);

  const inputNamespacedType = args.namespacedType ?? candidate.suggestedType;
  const namespacedType = normalizeExtensionType(inputNamespacedType);
  if (!namespacedType) {
    throw new Error(`Invalid namespaced type: ${inputNamespacedType}`);
  }
  const pendingResult = await updateWorkspaceJson(root, COMPONENT_CANDIDATES_PATH, {
    format: 'aub-component-candidates',
    format_version: WORKSPACE_LOOP_VERSION,
    candidates: [],
  }, (currentDoc) => {
    const currentCandidate = (currentDoc.candidates ?? []).find((item) => item.id === args.id);
    if (!currentCandidate) throw new Error(`Component candidate not found: ${args.id}`);
    if (currentCandidate.status === 'review_pending' && currentCandidate.approvedAs === namespacedType) {
      return { ...currentDoc, updatedAt: new Date().toISOString(), candidates: currentDoc.candidates ?? [] };
    }
    assertCandidateCanBeReviewed(currentCandidate, args.id);
    currentCandidate.status = 'review_pending';
    currentCandidate.approvedAs = namespacedType;
    currentCandidate.reviewedAt = new Date().toISOString();
    currentCandidate.reviewHistory = [
      ...(currentCandidate.reviewHistory ?? []),
      { action: 'create_extension_pending', approvedAs: namespacedType, reviewedAt: currentCandidate.reviewedAt },
    ];
    return { ...currentDoc, updatedAt: new Date().toISOString(), candidates: currentDoc.candidates ?? [] };
  });
  const pendingCandidate = pendingResult.value.candidates.find((item) => item.id === args.id);
  let componentEntry;
  await updateWorkspaceJson(root, 'aub.registry.json', {
    $schema: 'https://henrylau1103.github.io/AUB/schema/aub.registry.schema.json',
    version: '0.1.0',
    description: 'AUB workspace custom components.',
    components: [],
  }, (registry) => {
    if (!Array.isArray(registry.components)) registry.components = [];
    const existing = registry.components.find((item) => item.name === namespacedType);
    componentEntry = {
      name: namespacedType,
      isContainer: Boolean(args.isContainer ?? pendingCandidate.isContainer),
      description: normalizeText(args.description, `${pendingCandidate.componentName} scanned from ${pendingCandidate.sourcePath}.`, 240),
      implementations: [{
        id: pendingCandidate.framework || 'app',
        framework: normalizeFramework(pendingCandidate.framework),
        module: normalizeText(args.module, pendingCandidate.sourcePath, 200),
        export: normalizeText(args.export, pendingCandidate.componentName, 120),
        importStyle: args.importStyle ?? 'named',
        sourcePath: pendingCandidate.sourcePath,
        props: Object.fromEntries((pendingCandidate.props ?? []).map((prop) => [prop, { from: `content.${prop}`, required: false }])),
        notes: 'Approved from AUB component candidate review. Preserve production behavior.',
      }],
    };
    if (existing) Object.assign(existing, componentEntry);
    else registry.components.push(componentEntry);
    return registry;
  });

  const candidateResult = await updateWorkspaceJson(root, COMPONENT_CANDIDATES_PATH, {
    format: 'aub-component-candidates',
    format_version: WORKSPACE_LOOP_VERSION,
    candidates: [],
  }, (currentDoc) => {
    const currentCandidate = (currentDoc.candidates ?? []).find((item) => item.id === args.id);
    if (!currentCandidate) throw new Error(`Component candidate not found: ${args.id}`);
    if (currentCandidate.status !== 'review_pending' || currentCandidate.approvedAs !== namespacedType) {
      throw new Error(`Component candidate review state changed before finalization: ${args.id}`);
    }
    currentCandidate.status = 'approved';
    currentCandidate.approvedAs = namespacedType;
    currentCandidate.reviewedAt = new Date().toISOString();
    currentCandidate.reviewHistory = [...(currentCandidate.reviewHistory ?? []), { action: 'create_extension', approvedAs: namespacedType, reviewedAt: currentCandidate.reviewedAt }];
    return { ...currentDoc, updatedAt: new Date().toISOString(), candidates: currentDoc.candidates ?? [] };
  });
  return {
    candidate: candidateResult.value.candidates.find((item) => item.id === args.id),
    registryPath: 'aub.registry.json',
    registryComponent: componentEntry,
  };
}

function assertCandidateCanBeReviewed(candidate, id) {
  if ((candidate.status ?? 'candidate') !== 'candidate') {
    throw new Error(`Component candidate is already reviewed: ${id}`);
  }
}

function normalizeFramework(framework) {
  if (['react', 'vue', 'angular', 'svelte', 'web-component', 'html'].includes(framework)) return framework;
  if (framework === 'next') return 'react';
  if (framework === 'nuxt') return 'vue';
  return 'other';
}

export function templateAuthoringPrompt() {
  return [
    '# AUB Workspace Template Authoring Contract',
    '',
    'You are scanning an existing application to create AUB workspace templates.',
    '',
    'Rules:',
    '- Return only valid AUB workspace template documents or component candidates.',
    '- Do not invent core component types. Use AUB core types or create a candidate namespaced type.',
    '- Custom project components must be written to `.aub/component-candidates.json` first, never directly to `aub.registry.json`.',
    '- A user must approve each candidate before it can become a registry extension.',
    '- Every template must include source references and a confidence score.',
    '- Low confidence mappings must remain `status: "candidate"`.',
    '',
    'Template shape:',
    '```json',
    JSON.stringify({
      format: TEMPLATE_FORMAT,
      format_version: TEMPLATE_FORMAT_VERSION,
      id: 'workspace-settings',
      name: 'Settings',
      category: 'workspace',
      framework: 'react',
      source: { kind: 'route', path: 'src/pages/settings.tsx', route: '/settings' },
      blueprint: { version: '0.3.0' },
      registryRefs: ['app:settings_panel'],
      confidence: 0.72,
      status: 'candidate',
    }, null, 2),
    '```',
  ].join('\n');
}
