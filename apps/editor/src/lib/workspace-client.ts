import type { Blueprint } from '../types';

export interface WorkspaceTemplate {
  path: string;
  format: 'aub-workspace-template';
  format_version: string;
  id: string;
  name: string;
  category: string;
  framework: string;
  source: { kind?: string; path?: string; route?: string };
  blueprint: Blueprint;
  registryRefs?: string[];
  missingMappings?: Array<{
    candidateId?: string;
    componentName?: string;
    suggestedType?: string;
    suggestedCoreType?: string;
    sourcePath?: string;
    confidence?: number;
    reason?: string;
  }>;
  sourceReferences?: Array<{
    nodeId?: string;
    file: string;
    line?: number;
    selector?: string;
  }>;
  confidence?: number;
  status: 'candidate' | 'approved';
  createdAt?: string;
}

export interface ComponentCandidate {
  id: string;
  status: 'candidate' | 'approved' | 'ignored';
  sourcePath: string;
  framework?: string;
  componentName: string;
  selector?: string | null;
  suggestedType: string;
  suggestedCoreType?: string;
  isContainer?: boolean;
  props?: string[];
  usageCount?: number;
  sourceUsage?: Array<{ file: string; line?: number }>;
  storybookStories?: Array<{ path: string; title?: string | null }>;
  confidence?: number;
  confidenceReason?: string;
  mappingReason?: string;
  reason?: string;
  approvedAs?: string;
  reviewedAt?: string;
  reviewHistory?: Array<{ action: string; approvedAs?: string; reviewedAt?: string }>;
}

export interface AubSession {
  version: string;
  activeBlueprint: string | null;
  activeProject: string | null;
  targetRoute: string | null;
  preview?: {
    devServerUrl?: string | null;
    route?: string | null;
    lastImplementationReport?: string | null;
  };
  updatedAt: string | null;
}

export interface WorkspaceStatus {
  root: string;
  packageName: string | null;
  frameworks: string[];
  storybook?: {
    detected: boolean;
    configPath?: string | null;
    storyCount: number;
    stories?: Array<{ path: string; title?: string | null; component?: string | null }>;
  };
  scanAudit?: {
    filesScanned: number;
    filesSkipped: number;
    directoriesSkipped: number;
    ignoredPatterns: string[];
    limitReached: boolean;
  };
  scanReport?: {
    path: string;
    format: 'aub-scan-report';
    format_version: string;
    updatedAt: string;
    packageName: string | null;
    namespace: string;
    frameworks: string[];
    summary: {
      routes: number;
      componentCandidates: number;
      unresolvedCandidates: number;
      filesScanned: number;
      filesSkipped: number;
      directoriesSkipped: number;
      limitReached: boolean;
      trustScore: number;
    };
    trust: {
      score: number;
      grade: 'high' | 'medium' | 'low';
      reasons: string[];
      warnings: string[];
      confidenceInputs: {
        frameworkDetected: boolean;
        routeCount: number;
        componentCandidateCount: number;
        storybookDetected: boolean;
        scanLimitReached: boolean;
      };
    };
    storybook: {
      detected: boolean;
      configPath?: string | null;
      storyCount: number;
    };
    routes: Array<{ id: string; route: string; path: string; kind: string }>;
    componentCandidates: Array<{
      id: string;
      componentName: string;
      sourcePath: string;
      suggestedType: string;
      suggestedCoreType?: string;
      status: string;
      confidence?: number;
      usageCount?: number;
    }>;
    scanAudit: {
      filesScanned: number;
      filesSkipped: number;
      directoriesSkipped: number;
      ignoredPatterns: string[];
      limitReached: boolean;
    };
  } | null;
  routeCount: number;
  componentCandidateCount: number;
  templateCount: number;
  session: AubSession;
  implementationReport?: {
    path: string;
    screenId?: string | null;
    route?: string | null;
    pass?: number;
    fail?: number;
    needsReview?: number;
    evidence?: number;
    safetyScore?: {
      overall: number;
      grade: 'pass' | 'review' | 'risk' | 'fail';
      sourceCoverageScore: number;
      acceptanceEvidenceScore: number;
      viewportEvidenceScore: number;
      overflowSafety: number;
      componentReuseScore: number;
      unresolvedMappingCount: number;
      lookalikePreventionCount: number;
      evidenceItems: number;
      expectedViewports: string[];
    } | null;
    error?: string;
  } | null;
  blueprints?: Array<{ path: string; screenId: string; screenName: string; version: string }>;
  projects?: Array<{ path: string; id: string; name: string; screenCount: number }>;
  routes: Array<{ id: string; path: string; route: string; kind: string }>;
  componentCandidates: ComponentCandidate[];
  templates: WorkspaceTemplate[];
}

export interface WorkspaceConnection {
  endpoint: string;
  rpcUrl: string;
  healthUrl: string;
  rpcToken?: string;
}

export function normalizeWorkspaceEndpoint(value: string): WorkspaceConnection {
  const endpoint = value.trim() || 'http://127.0.0.1:3100/mcp';
  const url = new URL(endpoint);
  const rpcToken = url.searchParams.get('token') || url.searchParams.get('rpc-token') || undefined;
  if (url.searchParams.has('token')) url.searchParams.delete('token');
  if (url.searchParams.has('rpc-token')) url.searchParams.delete('rpc-token');
  const normalized = `${url.origin}${url.pathname}${url.search ? url.search : ''}`;
  const base = normalized.endsWith('/mcp') ? normalized.slice(0, -4) : normalized.replace(/\/$/, '');
  return {
    endpoint: normalized,
    rpcUrl: `${base}/rpc`,
    healthUrl: `${url.origin}/health`,
    ...(rpcToken ? { rpcToken } : {}),
  };
}

export async function workspaceRpc<T = unknown>(
  connection: WorkspaceConnection,
  tool: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (connection.rpcToken) {
    headers.authorization = `Bearer ${connection.rpcToken}`;
  }
  const response = await fetch(connection.rpcUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool, args }),
  });
  const rawBody = await response.text();
  let payload: { ok?: boolean; result?: T; error?: string | { message?: string } };
  try {
    payload = rawBody ? (JSON.parse(rawBody) as typeof payload) : {};
  } catch (error) {
    throw new Error(
      `AUB workspace RPC returned non-JSON (${response.status} ${response.statusText}): ${rawBody.slice(0, 300)}`
    );
  }
  const errorMessage =
    typeof payload.error === 'string'
      ? payload.error
      : payload.error && typeof payload.error === 'object' && 'message' in payload.error
        ? String(payload.error.message)
        : null;
  if (
    !response.ok ||
    payload?.ok === false ||
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error(errorMessage ?? `AUB workspace RPC failed: ${response.status}`);
  }
  return payload.result as T;
}

export async function connectWorkspace(endpoint: string): Promise<{ connection: WorkspaceConnection; status: WorkspaceStatus }> {
  const connection = normalizeWorkspaceEndpoint(endpoint);
  const health = await fetch(connection.healthUrl);
  if (!health.ok) throw new Error(`AUB workspace server is not healthy: ${health.status}`);
  const status = await workspaceRpc<WorkspaceStatus>(connection, 'get_workspace_status');
  return { connection, status };
}

export function previewUrl(session: AubSession | null): string {
  const devServerUrl = session?.preview?.devServerUrl?.replace(/\/$/, '');
  const route = session?.preview?.route ?? session?.targetRoute ?? '';
  if (!devServerUrl) return '';
  if (!route) return devServerUrl;
  return `${devServerUrl}${route.startsWith('/') ? route : `/${route}`}`;
}
