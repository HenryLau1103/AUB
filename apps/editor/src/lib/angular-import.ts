import type { Blueprint, UINode } from '../types';

export interface SourceBundleFile {
  path: string;
  content: string;
}

export interface ImportDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  file: string;
  line?: number;
  node_id?: string;
  confidence: number;
  detail?: string;
}

export interface AngularComponentCandidate {
  selector: string | null;
  className: string | null;
  tsPath: string | null;
  templatePath: string | null;
  stylePaths: string[];
  label: string;
}

export interface AngularImportResult {
  blueprint: Blueprint;
  diagnostics: ImportDiagnostic[];
  sourceMap: Record<string, NonNullable<UINode['source']>>;
  components: AngularComponentCandidate[];
  entry: {
    selector: string | null;
    label: string;
    templatePath: string;
  };
  confidenceSummary: {
    score: number;
    nodeCount: number;
    diagnosticCount: number;
    high: number;
    medium: number;
    low: number;
  };
  unresolvedComponents: string[];
}

export interface ImportSuggestion {
  id: string;
  node_id: string;
  patch: Partial<Pick<UINode, 'type' | 'name' | 'role' | 'content' | 'bindings' | 'validation'>>;
  reason: string;
  confidence: number;
}

export async function readAngularSourceFiles(files: FileList | File[]): Promise<SourceBundleFile[]> {
  const result: SourceBundleFile[] = [];
  for (const file of Array.from(files)) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || !/\.(html|scss|css|ts)$/i.test(path) || /\.spec\.ts$/i.test(path)) continue;
        result.push({ path: sanitizePath(path), content: await entry.async('string') });
      }
      continue;
    }
    if (!/\.(html|scss|css|ts)$/i.test(file.name) || /\.spec\.ts$/i.test(file.name)) continue;
    result.push({
      path: sanitizePath(file.webkitRelativePath || file.name),
      content: await file.text(),
    });
  }
  return result;
}

export async function discoverAngularEntries(files: SourceBundleFile[]): Promise<AngularComponentCandidate[]> {
  const importer = await import('../../../../scripts/angular-importer.lib.mjs');
  return importer.discoverAngularComponents(files) as AngularComponentCandidate[];
}

export async function runAngularImport(
  files: SourceBundleFile[],
  entry?: string
): Promise<AngularImportResult> {
  const importer = await import('../../../../scripts/angular-importer.lib.mjs');
  return importer.importAngularComponent(files, { entry }) as Promise<AngularImportResult>;
}

export async function requestImportSuggestions(
  result: AngularImportResult,
  files: SourceBundleFile[],
  config: { baseUrl: string; model: string }
): Promise<ImportSuggestion[]> {
  const candidates = result.diagnostics
    .filter((diagnostic) => diagnostic.confidence < 0.7 && diagnostic.node_id)
    .slice(0, 20);
  if (candidates.length === 0) return [];
  const relevantFiles = new Set(candidates.map((diagnostic) => diagnostic.file));
  const snippets = files
    .filter((file) => relevantFiles.has(file.path))
    .map((file) => ({ path: file.path, content: file.content.slice(0, 12000) }));
  const prompt = [
    'You are reviewing a deterministic Angular-to-AUB import.',
    'Return JSON only with shape {"suggestions":[{"node_id":"...","patch":{},"reason":"...","confidence":0.0}]}.',
    'Allowed patch keys: type, name, role, content, bindings, validation.',
    'Do not invent business behavior. Only suggest changes supported by the source snippets.',
    `Diagnostics: ${JSON.stringify(candidates)}`,
    `Nodes: ${JSON.stringify(result.blueprint.nodes.filter((node) => candidates.some((item) => item.node_id === node.id)))}`,
    `Sources: ${JSON.stringify(snippets)}`,
  ].join('\n\n');
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      think: false,
      format: 'json',
      options: { temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  const body = await response.json() as { response?: string };
  const parsed = JSON.parse(body.response ?? '{}') as { suggestions?: unknown[] };
  return (parsed.suggestions ?? []).flatMap((value, index) => {
    if (!isSuggestion(value, result.blueprint)) return [];
    return [{
      ...value,
      id: `ai_suggestion_${index + 1}`,
      confidence: Math.max(0, Math.min(1, value.confidence)),
    }];
  });
}

function isSuggestion(value: unknown, blueprint: Blueprint): value is Omit<ImportSuggestion, 'id'> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.node_id !== 'string' || !blueprint.nodes.some((node) => node.id === candidate.node_id)) return false;
  if (!candidate.patch || typeof candidate.patch !== 'object' || Array.isArray(candidate.patch)) return false;
  if (typeof candidate.reason !== 'string' || typeof candidate.confidence !== 'number') return false;
  const allowed = new Set(['type', 'name', 'role', 'content', 'bindings', 'validation']);
  return Object.keys(candidate.patch).every((key) => allowed.has(key));
}

function sanitizePath(path: string) {
  return path.replace(/\\/g, '/').split('/').filter((part) => part && part !== '.' && part !== '..').join('/');
}
