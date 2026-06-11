import { access, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { defaultDesignSystem } from './migrate-blueprint.mjs';
import { EXTENSION_NAME_PATTERN } from './registry.lib.mjs';

export const WORKSPACE_LOOP_VERSION = '0.1.0';
export const AUB_DIR = '.aub';
export const SESSION_PATH = '.aub/session.json';
export const COMPONENT_CANDIDATES_PATH = '.aub/component-candidates.json';
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

const SOURCE_EXTENSIONS = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.html']);
const SOURCE_TEXT_CACHE_TTL_MS = 5 * 60 * 1000;
const SOURCE_TEXT_CACHE_MAX_ENTRIES = 2000;
const MAX_TEMPLATE_NAME_LENGTH = 120;
const MAX_TEMPLATE_ID_LENGTH = 120;
const MAX_ROUTE_LENGTH = 220;
const MAX_CATEGORY_LENGTH = 80;
const MAX_SOURCE_KIND_LENGTH = 32;
const MAX_FRAMEWORK_LENGTH = 32;
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
  const absPath = resolve(absRoot, filePath);
  const rel = relative(absRoot, absPath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel === '' || rel.startsWith('/')) {
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

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, path);
  return { bytes: Buffer.byteLength(content) };
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
    const cached = sourceTextCache.get(cacheKey(file));
    if (cached
      && cached.size === st.size
      && cached.mtimeMs === st.mtimeMs
      && Date.now() - cached.cachedAt <= SOURCE_TEXT_CACHE_TTL_MS
    ) {
      return cached.text;
    }
    const text = await readFile(file.absPath, 'utf8');
    sourceTextCache.set(cacheKey(file), { size: st.size, mtimeMs: st.mtimeMs, text, cachedAt: Date.now() });
    pruneSourceTextCache();
    return text;
  } catch {
    return '';
  }
}

async function readSourceTexts(files) {
  const sourceFiles = files.filter((file) => SOURCE_EXTENSIONS.has(extname(file.path).toLowerCase()));
  const contents = new Map();
  await Promise.all(
    sourceFiles.map(async (file) => {
      contents.set(file.absPath, await readSourceText(file));
    })
  );
  return contents;
}

function inferNamespace(root, packageJson) {
  const packageName = packageJson?.name;
  const base = packageName
    ? packageName.split('/').pop()
    : basename(root);
  return slugify(base, 'app').replace(/[^a-z0-9]/g, '') || 'app';
}

async function walk(root, dir, out, limit = 2000) {
  if (out.length >= limit) return;
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of dirents) {
    if (out.length >= limit) return;
    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (IGNORE_DIRS.has(dirent.name) || dirent.name.startsWith('.')) continue;
      await walk(root, full, out, limit);
    } else if (dirent.isFile()) {
      out.push({ path: toWorkspacePath(root, full), absPath: full, name: dirent.name });
    }
  }
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

async function detectRoutes(files) {
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

  const angularRoutes = await detectAngularRoutes(files);
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

async function detectAngularRoutes(files) {
  const routingFiles = files.filter((file) => /\.routing\.ts$/.test(file.path) || /app\.routing\.ts$/.test(file.path));
  if (routingFiles.length === 0) return [];
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const sourceTexts = await readSourceTexts(routingFiles.concat(files.filter((file) => /app-route-paths\.const\.ts$/.test(file.path))));
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
      const componentContent = componentFile ? await readSourceText(componentFile) : '';
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

async function detectComponents(root, files, namespace, frameworks) {
  const candidates = [];
  const sourceTexts = await readSourceTexts(files);
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
        confidence: selector ? 0.82 : 0.72,
        confidenceReason: selector
          ? 'Angular selector and component metadata were found.'
          : 'Static export/import scan found a reusable project component.',
        mappingReason: `Name suggests AUB core type "${suggestedCoreType}" until a user approves a project-specific mapping.`,
        reviewHistory: [],
        reason: 'Static scan found a reusable project component. Approve before adding it to aub.registry.json.',
      });
    }
  }
  const byId = new Map();
  for (const candidate of candidates) byId.set(candidate.id, candidate);
  return [...byId.values()].slice(0, 100);
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
  const current = await readAubSession(root);
  const next = {
    ...current,
    ...patch,
    preview: {
      ...(current.preview ?? {}),
      ...(patch.preview ?? {}),
    },
    updatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(join(root, SESSION_PATH), next);
  return { path: SESSION_PATH, session: next };
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
  await writeJsonAtomic(join(root, COMPONENT_CANDIDATES_PATH), doc);
  return doc;
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
  await walk(root, root, files, 1500);
  const packageJson = await readPackage(root);
  const frameworks = detectFrameworks(packageJson, files);
  const routes = await detectRoutes(files);
  const session = await readAubSession(root);
  const candidates = await readComponentCandidates(root);
  const templates = await listWorkspaceTemplates(root);
  const implementationReport = await readImplementationReportSummary(root, session);
  return {
    root,
    aubDir: AUB_DIR,
    packageName: packageJson?.name ?? null,
    frameworks,
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
    const acceptance = Array.isArray(report.acceptance_results) ? report.acceptance_results : [];
    return {
      path: toWorkspacePath(root, absPath),
      screenId: report.blueprint?.screen_id ?? null,
      route: report.implementation?.route ?? null,
      pass: acceptance.filter((item) => item.status === 'pass').length,
      fail: acceptance.filter((item) => item.status === 'fail').length,
      needsReview: acceptance.filter((item) => item.status === 'needs-review').length,
      evidence: acceptance.reduce((count, item) => count + (Array.isArray(item.evidence) ? item.evidence.length : 0), 0),
    };
  } catch {
    return {
      path: reportPath,
      error: 'Unable to read implementation report.',
    };
  }
}

export async function scanProjectUi(root, options = {}) {
  clearSourceTextCacheIfRootChanged(root);
  const files = [];
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 2000;
  await walk(root, root, files, limit);
  const packageJson = await readPackage(root);
  const namespace = normalizeNamespace(options.namespace ?? inferNamespace(root, packageJson), 'app');
  const frameworks = detectFrameworks(packageJson, files);
  const routes = await detectRoutes(files);
  const candidates = await detectComponents(root, files, namespace, frameworks);
  const doc = await writeComponentCandidates(root, candidates);
  return {
    root,
    packageName: packageJson?.name ?? null,
    namespace,
    frameworks,
    routes,
    components: candidates,
    componentCandidatesPath: COMPONENT_CANDIDATES_PATH,
    componentCandidates: doc,
  };
}

async function makeBlueprint({ id, name, framework, source, route, root, files, candidates = [] }) {
  const sourceFile = files.find((file) => file.path === source.path);
  const sourceText = sourceFile ? await readSourceText(sourceFile) : '';
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
    confidence: calculateTemplateConfidence(extracted, Boolean(route)),
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
  await walk(root, root, files, 2000);
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
    confidence: built.confidence,
    status: args.status === 'approved' ? 'approved' : 'candidate',
    createdAt: new Date().toISOString(),
  };
  const normalizedOutput = typeof args.output === 'string' && args.output.length > 0
    ? args.output
    : `${TEMPLATE_DIR}/${slugify(template.id)}.aub.template.json`;
  const outputPath = resolveWorkspacePath(root, normalizedOutput.endsWith('.aub.template.json')
    ? normalizedOutput
    : `${normalizedOutput.replace(/\.aub\.template\.json$/i, '').replace(/[/\\]+$/g, '')}.aub.template.json`);
  await writeJsonAtomic(outputPath, template);
  return {
    savedPath: toWorkspacePath(root, outputPath),
    template,
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
  const doc = await readComponentCandidates(root);
  const candidate = doc.candidates.find((item) => item.id === args.id);
  if (!candidate) throw new Error(`Component candidate not found: ${args.id}`);

  if (args.action === 'ignore') {
    candidate.status = 'ignored';
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewHistory = [...(candidate.reviewHistory ?? []), { action: 'ignore', reviewedAt: candidate.reviewedAt }];
    await writeComponentCandidates(root, doc.candidates);
    return { candidate, registryPath: null };
  }

  if (args.action === 'map_core') {
    const normalizedCoreType = normalizeCoreType(args.coreType ?? candidate.suggestedCoreType);
    if (!normalizedCoreType) {
      throw new Error(`Invalid core type: ${args.coreType ?? candidate.suggestedCoreType}`);
    }
    candidate.status = 'approved';
    candidate.approvedAs = normalizedCoreType;
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewHistory = [...(candidate.reviewHistory ?? []), { action: 'map_core', approvedAs: normalizedCoreType, reviewedAt: candidate.reviewedAt }];
    await writeComponentCandidates(root, doc.candidates);
    return { candidate, registryPath: null };
  }

  if (args.action !== 'create_extension') {
    throw new Error('action must be one of create_extension, map_core, ignore.');
  }

  const inputNamespacedType = args.namespacedType ?? candidate.suggestedType;
  const namespacedType = normalizeExtensionType(inputNamespacedType);
  if (!namespacedType) {
    throw new Error(`Invalid namespaced type: ${inputNamespacedType}`);
  }
  const registryPath = join(root, 'aub.registry.json');
  const registry = await readJsonIfExists(registryPath, {
    $schema: 'https://henrylau1103.github.io/AUB/schema/aub.registry.schema.json',
    version: '0.1.0',
    description: 'AUB workspace custom components.',
    components: [],
  });
  if (!Array.isArray(registry.components)) registry.components = [];
  const existing = registry.components.find((item) => item.name === namespacedType);
  const componentEntry = {
    name: namespacedType,
    isContainer: Boolean(args.isContainer ?? candidate.isContainer),
    description: normalizeText(args.description, `${candidate.componentName} scanned from ${candidate.sourcePath}.`, 240),
    implementations: [{
      id: candidate.framework || 'app',
      framework: normalizeFramework(candidate.framework),
      module: normalizeText(args.module, candidate.sourcePath, 200),
      export: normalizeText(args.export, candidate.componentName, 120),
      importStyle: args.importStyle ?? 'named',
      sourcePath: candidate.sourcePath,
      props: Object.fromEntries((candidate.props ?? []).map((prop) => [prop, { from: `content.${prop}`, required: false }])),
      notes: 'Approved from AUB component candidate review. Preserve production behavior.',
    }],
  };
  if (existing) Object.assign(existing, componentEntry);
  else registry.components.push(componentEntry);
  await writeJsonAtomic(registryPath, registry);

  candidate.status = 'approved';
  candidate.approvedAs = namespacedType;
  candidate.reviewedAt = new Date().toISOString();
  candidate.reviewHistory = [...(candidate.reviewHistory ?? []), { action: 'create_extension', approvedAs: namespacedType, reviewedAt: candidate.reviewedAt }];
  await writeComponentCandidates(root, doc.candidates);
  return {
    candidate,
    registryPath: 'aub.registry.json',
    registryComponent: componentEntry,
  };
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
