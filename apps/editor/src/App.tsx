import Ajv2020 from 'ajv/dist/2020.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Palette } from './components/Palette';
import { Canvas, type CanvasHandle } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { BlueprintPanel } from './components/BlueprintPanel';
import { WorkflowBar, type WorkflowStage } from './components/WorkflowBar';
import { ProjectBar } from './components/ProjectBar';
import { AngularImportDialog } from './components/AngularImportDialog';
import { WorkspacePanel } from './components/WorkspacePanel';
import {
  downloadAuthoringKit,
  downloadBlob,
  downloadHandoffPackage,
  downloadPersonalTemplatePackage,
  downloadProjectArchive,
  readFileAsText,
} from './lib/io';
import { componentLabel, t, type Language } from './lib/i18n';
import { loadDraft, saveDraft } from './lib/draft-storage';
import { isContainerType, setExtensionRegistry as setExtensionRegistryForEditor } from './lib/registry';
import {
  addNode,
  createNode,
  defaultLayoutForType,
  defaultPlacementForType,
  deleteNode,
  duplicateNodes,
  reparentNode,
  setNodeZIndex,
  setViewportSize,
  updateManyPlacements,
  updateNode,
  updateNodePlacement,
  wrapRootInAppShell,
} from './lib/store';
import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type BlueprintHistory,
} from './lib/history';
import { createTemplateBlueprint, templateLabel, type TemplateId } from './lib/templates';
import {
  discoverAngularEntries,
  readAngularSourceFiles,
  runAngularImport,
  type AngularComponentCandidate,
  type ImportDiagnostic,
  type AngularImportResult,
  type SourceBundleFile,
} from './lib/angular-import';
import {
  createPersonalTemplate,
  deletePersonalTemplate,
  loadPersonalTemplates,
  readPersonalTemplateFile,
  savePersonalTemplate,
  type PersonalTemplate,
} from './lib/personal-templates';
import type { ViewportQualityReport } from './lib/viewport-quality';
import {
  attachWorkspaceTokenIfMissing,
  connectWorkspace,
  workspaceRpc,
  type ComponentCandidate,
  type WorkspaceConnection,
  type WorkspaceStatus,
  type WorkspaceTemplate,
} from './lib/workspace-client';
import {
  buildEditorProject,
  createProjectFromBlueprint,
  parseProjectDocument,
  toProjectDocument,
  type EditorProject,
  type NavigationEdge,
} from './lib/project';
import type { Blueprint, ComponentType, Placement, UINode, ViewportId, ResolvedComponentType } from './types';
import schemaJson from '../../../schema/ui-blueprint.schema.json';
import { defaultDesignSystem, migrateBlueprint } from '../../../scripts/migrate-blueprint.mjs';
import { validateBlueprintSemantics } from '../../../scripts/validate-blueprint.lib.mjs';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schemaJson as object);
const WORKSPACE_RPC_TOKEN_STORAGE_KEY = 'aub.rpcToken';

interface AddNodeOptions {
  makeParentFreeform?: boolean;
  existingPlacements?: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }>;
}

async function exportMarkdown(blueprint: Blueprint): Promise<string> {
  const mod = await import('../../../scripts/export-md.lib.mjs');
  return mod.exportMarkdown(blueprint);
}

async function exportCodexPrompt(blueprint: Blueprint): Promise<string> {
  const mod = await import('../../../scripts/export-agent-prompt.lib.mjs');
  return mod.exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' });
}

async function exportGenericPrompt(blueprint: Blueprint): Promise<string> {
  const mod = await import('../../../scripts/export-agent-prompt.lib.mjs');
  return mod.exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' });
}

async function createReportTemplate(blueprint: Blueprint): Promise<Record<string, unknown>> {
  const mod = await import('../../../scripts/implementation-report.lib.mjs');
  return mod.createImplementationReportTemplate(blueprint);
}

function createStarterBlueprint(language: Language, kind: 'page' | 'app' = 'page'): Blueprint {
  const isApp = kind === 'app';
  const rootId = isApp ? 'app_shell' : 'root';
  const nodes: UINode[] = isApp
    ? [
        {
          id: 'app_shell',
          type: 'app_shell',
          name: t(language, 'starterAppShellName'),
          role: t(language, 'starterAppShellRole'),
          parent_id: null,
          children: ['starter_sidebar', 'starter_top_bar', 'starter_main_page'],
          layout: { mode: 'freeform' },
        },
        starterNode('starter_sidebar', 'sidebar', 'app_shell', language, {
          desktop: { x: 0, y: 0, width: 240, height: 900, z_index: 2 },
          tablet: { x: 0, y: 0, width: 220, height: 768, z_index: 2 },
          mobile: { x: 0, y: 780, width: 390, height: 64, z_index: 5 },
        }),
        starterNode('starter_top_bar', 'top_bar', 'app_shell', language, {
          desktop: { x: 240, y: 0, width: 1200, height: 64, z_index: 3 },
          tablet: { x: 220, y: 0, width: 804, height: 64, z_index: 3 },
          mobile: { x: 0, y: 0, width: 390, height: 60, z_index: 3 },
        }),
        starterNode('starter_main_page', 'page', 'app_shell', language, {
          desktop: { x: 240, y: 64, width: 1200, height: 836, z_index: 1 },
          tablet: { x: 220, y: 64, width: 804, height: 704, z_index: 1 },
          mobile: { x: 0, y: 60, width: 390, height: 720, z_index: 1 },
        }, { mode: 'freeform' }),
      ]
    : [
        {
          id: 'root',
          type: 'page',
          name: t(language, 'starterRootName'),
          role: t(language, 'starterRootRole'),
          parent_id: null,
          children: [],
          layout: { mode: 'freeform' },
        },
      ];

  return {
    version: '0.3.0',
    screen: {
      id: isApp ? 'starter.app' : 'demo.screen',
      name: t(language, isApp ? 'starterAppScreenName' : 'starterScreenName'),
      type: isApp ? 'dashboard' : 'landing',
      platform: 'web',
      primary_user_goal: t(language, isApp ? 'starterAppGoal' : 'starterPrimaryGoal'),
    },
    viewports: [
      { id: 'desktop', width: 1440, height: 900 },
      { id: 'tablet', width: 1024, height: 768 },
      { id: 'mobile', width: 390, height: 844 },
    ],
    design_system: defaultDesignSystem(),
    nodes,
    interactions: [],
    responsive: [],
    acceptance: starterAcceptance(language, rootId),
  };
}

function starterNode(
  id: string,
  type: ComponentType,
  parentId: string,
  language: Language,
  placements: UINode['placements'],
  layout = defaultLayoutForType(type)
): UINode {
  const key = type === 'sidebar'
    ? ['starterSidebarName', 'starterSidebarRole']
    : type === 'top_bar'
      ? ['starterTopBarName', 'starterTopBarRole']
      : ['starterMainPageName', 'starterMainPageRole'];
  return {
    id,
    type,
    name: t(language, key[0] as Parameters<typeof t>[1]),
    role: t(language, key[1] as Parameters<typeof t>[1]),
    parent_id: parentId,
    children: [],
    layout,
    placements,
  };
}

function starterAcceptance(language: Language, rootId: string): Blueprint['acceptance'] {
  const zh = language === 'zh-Hant';
  return [
    { id: 'acc_starter_layout', type: 'layout', statement: zh ? '元件位置與尺寸符合畫板。' : 'Component geometry matches the artboard.', target: rootId, priority: 'must', verification_method: 'screenshot_diff' },
    { id: 'acc_starter_interaction', type: 'interaction', statement: zh ? '每個互動元件具有明確 action。' : 'Every interactive node declares an action.', target: '*', priority: 'must', verification_method: 'manual_ia_review' },
    { id: 'acc_starter_responsive', type: 'responsive', statement: zh ? '桌面、平板與手機皆有可讀配置。' : 'Desktop, tablet, and mobile have readable layouts.', target: 'desktop,tablet,mobile', priority: 'must', verification_method: 'screenshot_diff' },
    { id: 'acc_starter_a11y', type: 'a11y', statement: zh ? '互動元件具有文字標籤。' : 'Interactive nodes have text labels.', target: '*', priority: 'must', verification_method: 'axe_audit' },
    { id: 'acc_starter_content', type: 'content', statement: zh ? '所有可見元件皆有明確名稱。' : 'Every visible node has a clear name.', target: '*', priority: 'should', verification_method: 'manual_ia_review' },
  ];
}

export function App() {
  const [initialDraft] = useState(loadDraft);
  const [initialHasWorkspaceEndpoint] = useState(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mcp')
  ));
  const [initialWorkspaceEndpoint] = useState(() => {
    if (typeof window === 'undefined') return 'http://127.0.0.1:3100/mcp';
    return new URLSearchParams(window.location.search).get('mcp') ?? 'http://127.0.0.1:3100/mcp';
  });
  const [history, setHistory] = useState<BlueprintHistory>(() => createHistory(initialDraft?.blueprint ?? null));
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const root = initialDraft?.blueprint.nodes.find((node) => node.parent_id === null);
    return root ? [root.id] : [];
  });
  const [language, setLanguage] = useState<Language>(initialDraft?.language ?? 'zh-Hant');
  const [notice, setNotice] = useState<string | null>(() => (
    initialDraft
      ? initialDraft.language === 'zh-Hant' ? '已恢復上次的本機草稿。' : 'Restored the last local draft.'
      : null
  ));
  const [draggingType, setDraggingType] = useState<ResolvedComponentType | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(() => window.innerWidth > 980);
  const [canvasResetKey, setCanvasResetKey] = useState(0);
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('layout');
  const [viewportQuality, setViewportQuality] = useState<ViewportQualityReport | null>(null);
  const [personalTemplates, setPersonalTemplates] = useState<PersonalTemplate[]>(loadPersonalTemplates);
  const [lastImportSummary, setLastImportSummary] = useState<PersonalTemplate['importSummary']>();
  const [importDiagnostics, setImportDiagnostics] = useState<ImportDiagnostic[]>([]);
  const [angularImport, setAngularImport] = useState<{
    open: boolean;
    files: SourceBundleFile[];
    entries: AngularComponentCandidate[];
    selectedEntry: string;
    result: AngularImportResult | null;
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    files: [],
    entries: [],
    selectedEntry: '',
    result: null,
    loading: false,
    error: null,
  });
  const [savedAt, setSavedAt] = useState<string | null>(initialDraft?.savedAt ?? null);
  const [project, setProject] = useState<EditorProject | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [extensionRegistry, setExtensionRegistry] = useState<string | null>(null);
  const [workspaceEndpoint, setWorkspaceEndpoint] = useState(initialWorkspaceEndpoint);
  const [workspaceRpcToken, setWorkspaceRpcToken] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return window.sessionStorage.getItem(WORKSPACE_RPC_TOKEN_STORAGE_KEY) ?? undefined;
  });
  const [workspaceConnection, setWorkspaceConnection] = useState<WorkspaceConnection | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceSavePath, setWorkspaceSavePath] = useState('');
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(initialHasWorkspaceEndpoint);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const autoConnectWorkspaceRef = useRef(false);
  const blueprint = history.present;
  const selectedId = selectedIds[0] ?? null;

  useEffect(() => {
    if (typeof window === 'undefined' || !initialHasWorkspaceEndpoint) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('mcp');
    const sanitized = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, document.title, sanitized);
  }, [initialHasWorkspaceEndpoint]);

  useEffect(() => {
    try {
      setExtensionRegistryForEditor(extensionRegistry);
    } catch (error) {
      setNotice(t(language, 'registryInvalid', { message: (error as Error).message }));
      setExtensionRegistry(null);
    }
  }, [extensionRegistry, language]);

  const errors = useMemo(() => {
    if (!blueprint) return [];
    const ok = validateSchema(blueprint);
    const schemaErrors = ok
      ? []
      : (validateSchema.errors ?? []).map((error) => `${error.instancePath || '(root)'} ${error.message}`);
    return [...schemaErrors, ...validateBlueprintSemantics(blueprint)];
  }, [blueprint]);

  const commit = useCallback((next: Blueprint | null | ((current: Blueprint | null) => Blueprint | null)) => {
    setHistory((current) => {
      const value = typeof next === 'function' ? next(current.present) : next;
      return commitHistory(current, value);
    });
  }, []);

  function handleImport(input: Blueprint) {
    const migrated = migrateBlueprint(input) as Blueprint;
    commit(migrated);
    setCanvasResetKey((value) => value + 1);
    setSelectedIds([migrated.nodes.find((node) => node.parent_id === null)?.id].filter(Boolean) as string[]);
    setNotice(input.version !== '0.3.0' ? t(language, 'importMigrated') : t(language, 'imported'));
  }

  async function handleRegistryFile(file: File) {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as { components?: unknown[] };
      if (!Array.isArray(parsed.components)) {
        throw new Error('missing required "components" array');
      }
      setExtensionRegistryForEditor(`${JSON.stringify(parsed, null, 2)}\n`);
      setExtensionRegistry(`${JSON.stringify(parsed, null, 2)}\n`);
      setNotice(t(language, 'registryImported', { count: parsed.components.length }));
    } catch (error) {
      setNotice(t(language, 'registryInvalid', { message: (error as Error).message }));
      setExtensionRegistry(null);
    }
  }

  async function handleAngularFiles(input: FileList) {
    try {
      const files = await readAngularSourceFiles(input);
      const entries = await discoverAngularEntries(files);
      if (!files.length || !entries.length) throw new Error(language === 'zh-Hant' ? '找不到可匯入的 Angular 元件檔案。' : 'No importable Angular component files were found.');
      const firstEntry = entries[0];
      if (!firstEntry) throw new Error('Angular entry component is missing.');
      const selectedEntry = firstEntry.selector ?? firstEntry.templatePath ?? '';
      setAngularImport({ open: true, files, entries, selectedEntry, result: null, loading: true, error: null });
      await runAngularEntry(files, entries, selectedEntry);
    } catch (error) {
      setNotice((error as Error).message);
      setExtensionRegistry(null);
    }
  }

  async function runAngularEntry(
    files: SourceBundleFile[],
    entries: AngularComponentCandidate[],
    selectedEntry: string
  ) {
    setAngularImport((current) => ({ ...current, open: true, files, entries, selectedEntry, loading: true, error: null }));
    try {
      const result = await runAngularImport(files, selectedEntry);
      setAngularImport((current) => ({ ...current, result, loading: false, error: null }));
    } catch (error) {
      setAngularImport((current) => ({ ...current, result: null, loading: false, error: (error as Error).message }));
    }
  }

  function loadAngularResult(result: AngularImportResult) {
    handleImport(result.blueprint);
    setImportDiagnostics(result.diagnostics);
    setLastImportSummary({
      score: result.confidenceSummary.score,
      warnings: result.diagnostics.filter((item) => item.severity === 'warning').length,
      sourceKind: result.blueprint.provenance?.source_kind,
    });
    setAngularImport((current) => ({ ...current, open: false }));
    setNotice(language === 'zh-Hant'
      ? `已載入 Angular 畫面：${result.blueprint.nodes.length} 個節點，${result.diagnostics.length} 個診斷。`
      : `Loaded Angular screen: ${result.blueprint.nodes.length} nodes and ${result.diagnostics.length} diagnostics.`);
  }

  async function handleSavePersonalTemplate(name: string) {
    if (!blueprint) return;
    const images = await canvasRef.current?.captureViewports();
    const template = createPersonalTemplate(name, blueprint, images?.desktop, lastImportSummary);
    setPersonalTemplates(savePersonalTemplate(template));
    setNotice(language === 'zh-Hant' ? `已儲存個人範本「${template.name}」。` : `Saved personal template "${template.name}".`);
  }

  function handleLoadPersonalTemplate(template: PersonalTemplate) {
    handleImport(template.blueprint);
    setNotice(language === 'zh-Hant' ? `已載入個人範本「${template.name}」。` : `Loaded personal template "${template.name}".`);
  }

  async function handlePersonalTemplateFile(file: File) {
    try {
      const template = await readPersonalTemplateFile(file);
      setPersonalTemplates(savePersonalTemplate(template));
      handleLoadPersonalTemplate(template);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  function handleDeletePersonalTemplate(template: PersonalTemplate) {
    const confirmed = window.confirm(language === 'zh-Hant'
      ? `刪除個人範本「${template.name}」？`
      : `Delete personal template "${template.name}"?`);
    if (!confirmed) return;
    setPersonalTemplates(deletePersonalTemplate(template.id));
  }

  function handleTemplateSelect(templateId: TemplateId) {
    const nextBlueprint = migrateBlueprint(createTemplateBlueprint(templateId, language)) as Blueprint;
    commit(nextBlueprint);
    setCanvasResetKey((value) => value + 1);
    setSelectedIds([nextBlueprint.nodes.find((node) => node.parent_id === null)?.id].filter(Boolean) as string[]);
    setNotice(t(language, 'templateLoaded', { template: templateLabel(language, templateId) }));
  }

  async function loadWorkspaceStatus(connection: WorkspaceConnection): Promise<WorkspaceStatus> {
    const [status, blueprints, projects] = await Promise.all([
      workspaceRpc<WorkspaceStatus>(connection, 'get_workspace_status'),
      workspaceRpc<{ blueprints: WorkspaceStatus['blueprints'] }>(connection, 'list_blueprints'),
      workspaceRpc<{ projects: WorkspaceStatus['projects'] }>(connection, 'list_projects'),
    ]);
    return {
      ...status,
      blueprints: blueprints.blueprints ?? [],
      projects: projects.projects ?? [],
    };
  }

  async function handleConnectWorkspace() {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const endpoint = attachWorkspaceTokenIfMissing(workspaceEndpoint, workspaceRpcToken);
      const { connection } = await connectWorkspace(endpoint);
      const status = await loadWorkspaceStatus(connection);
      const nextRpcToken = connection.rpcToken ?? workspaceRpcToken;
      setWorkspaceConnection(connection);
      setWorkspaceRpcToken(nextRpcToken);
      if (nextRpcToken && typeof window !== 'undefined') {
        window.sessionStorage.setItem(WORKSPACE_RPC_TOKEN_STORAGE_KEY, nextRpcToken);
      }
      setWorkspaceStatus(status);
      setWorkspaceEndpoint(connection.endpoint);
      setWorkspaceSavePath(status.session.activeBlueprint ?? (blueprint ? `${blueprint.screen.id}.ui.json` : ''));
      setNotice(language === 'zh-Hant' ? '已連到 AUB workspace。' : 'Connected to AUB workspace.');
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    if (autoConnectWorkspaceRef.current) return;
    if (!initialWorkspaceEndpoint || workspaceConnection || workspaceLoading) return;
    if (!initialHasWorkspaceEndpoint) return;
    autoConnectWorkspaceRef.current = true;
    void handleConnectWorkspace();
  }, [initialHasWorkspaceEndpoint, initialWorkspaceEndpoint, workspaceConnection, workspaceLoading]);

  async function handleRefreshWorkspace() {
    if (!workspaceConnection) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleScanWorkspaceUi() {
    if (!workspaceConnection) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      await workspaceRpc(workspaceConnection, 'scan_project_ui');
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
      setNotice(language === 'zh-Hant'
        ? '已掃描 workspace UI，並更新 routes 與自訂元件候選。'
        : 'Scanned workspace UI and updated routes and component candidates.');
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleGenerateWorkspaceTemplate(sourcePath: string) {
    if (!workspaceConnection || !sourcePath) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      await workspaceRpc(workspaceConnection, 'generate_template_from_source', { sourcePath });
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
      setNotice(language === 'zh-Hant'
        ? `已從 ${sourcePath} 產生 workspace 範本。`
        : `Generated workspace template from ${sourcePath}.`);
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleLoadWorkspaceBlueprint(path: string) {
    if (!workspaceConnection) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const result = await workspaceRpc<{ blueprint: Blueprint }>(workspaceConnection, 'get_blueprint', { ref: path });
      handleImport(result.blueprint);
      setWorkspaceSavePath(path);
      await workspaceRpc(workspaceConnection, 'update_aub_session', {
        patch: { activeBlueprint: path },
      });
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
      setNotice(language === 'zh-Hant' ? `已載入 workspace Blueprint：${path}` : `Loaded workspace Blueprint: ${path}`);
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleSaveWorkspaceBlueprint() {
    if (!workspaceConnection || !blueprint) return;
    const path = workspaceSavePath.trim() || `${blueprint.screen.id}.ui.json`;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      await workspaceRpc(workspaceConnection, 'write_blueprint', {
        path,
        blueprint,
        overwrite: true,
      });
      await workspaceRpc(workspaceConnection, 'update_aub_session', {
        patch: {
          activeBlueprint: path,
          activeProject: project ? `${project.id}.aub.project.json` : null,
          targetRoute: workspaceStatus?.session?.preview?.route ?? null,
        },
      });
      setWorkspaceSavePath(path);
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
      setNotice(language === 'zh-Hant' ? `已存回 workspace：${path}` : `Saved to workspace: ${path}`);
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  function handleLoadWorkspaceTemplate(template: WorkspaceTemplate) {
    handleImport(template.blueprint);
    setWorkspaceSavePath(`${template.blueprint.screen.id}.ui.json`);
    setNotice(language === 'zh-Hant'
      ? `已載入 Workspace 範本「${template.name}」。`
      : `Loaded workspace template "${template.name}".`);
  }

  async function handleWorkspacePreviewChange(patch: { devServerUrl?: string; route?: string }) {
    if (!workspaceConnection) return;
    const currentPreview = workspaceStatus?.session.preview ?? {};
    const nextPreview = { ...currentPreview, ...patch };
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      await workspaceRpc(workspaceConnection, 'update_aub_session', {
        patch: {
          preview: nextPreview,
          targetRoute: nextPreview.route ?? workspaceStatus?.session.targetRoute ?? null,
        },
      });
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleReviewComponentCandidate(
    candidate: ComponentCandidate,
    action: 'create_extension' | 'map_core' | 'ignore',
    coreType?: string
  ) {
    if (!workspaceConnection) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      await workspaceRpc(workspaceConnection, 'approve_component_candidate', {
        id: candidate.id,
        action,
        ...(coreType ? { coreType } : {}),
      });
      setWorkspaceStatus(await loadWorkspaceStatus(workspaceConnection));
      setNotice(language === 'zh-Hant'
        ? `已審核元件候選：${candidate.componentName}`
        : `Reviewed component candidate: ${candidate.componentName}`);
    } catch (error) {
      setWorkspaceError((error as Error).message);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  function handleCreateStarter(kind: 'page' | 'app') {
    const nextBlueprint = createStarterBlueprint(language, kind);
    commit(nextBlueprint);
    setCanvasResetKey((value) => value + 1);
    setSelectedIds([kind === 'app' ? 'starter_main_page' : 'root']);
    setWorkflowStage('brief');
    setNotice(t(language, kind === 'app' ? 'starterAppCreated' : 'starterPageCreated'));
  }

  function syncActiveScreen(current: EditorProject): EditorProject {
    if (!activeScreenId || !blueprint) return current;
    return {
      ...current,
      screens: current.screens.map((screen) =>
        screen.id === activeScreenId ? { ...screen, blueprint } : screen
      ),
    };
  }

  function loadScreenBlueprint(target: { id: string; blueprint: Blueprint }) {
    setHistory(createHistory(target.blueprint));
    setActiveScreenId(target.id);
    setCanvasResetKey((value) => value + 1);
    setSelectedIds([target.blueprint.nodes.find((node) => node.parent_id === null)?.id].filter(Boolean) as string[]);
  }

  function handleSwitchScreen(id: string) {
    if (!project) return;
    const synced = syncActiveScreen(project);
    const target = synced.screens.find((screen) => screen.id === id);
    if (!target) return;
    setProject(synced);
    loadScreenBlueprint(target);
  }

  async function handleOpenProjectFiles(files: FileList) {
    try {
      const entries = await Promise.all(
        Array.from(files).map(async (file) => ({ file, text: await readFileAsText(file) }))
      );
      const projectEntry = entries.find((entry) => /\.aub\.project\.json$/i.test(entry.file.name));
      const registryEntry = entries.find((entry) => /^aub\.registry\.json$/i.test(entry.file.name));
      if (!projectEntry) {
        setNotice(t(language, 'projectNoDocument'));
        return;
      }
      const doc = parseProjectDocument(projectEntry.text);
      const blueprintsByFilename = new Map<string, Blueprint>();
      for (const entry of entries) {
        if (entry === projectEntry) continue;
        if (!/\.ui\.json$/i.test(entry.file.name) && !/\.json$/i.test(entry.file.name)) continue;
        try {
          const parsed = migrateBlueprint(JSON.parse(entry.text)) as Blueprint;
          if (parsed?.screen?.id) blueprintsByFilename.set(entry.file.name, parsed);
        } catch {
          // Skip files that are not valid Blueprints.
        }
      }
      const { project: editorProject, missing } = buildEditorProject(doc, blueprintsByFilename);
      if (editorProject.screens.length === 0) {
        setNotice(t(language, 'projectNoDocument'));
        return;
      }
      setProject(editorProject);
      if (registryEntry) {
        const parsedRegistry = JSON.parse(registryEntry.text) as { components?: unknown[] };
        if (!Array.isArray(parsedRegistry.components)) {
          throw new Error('aub.registry.json is missing the required "components" array');
        }
        setExtensionRegistryForEditor(`${JSON.stringify(parsedRegistry, null, 2)}\n`);
        setExtensionRegistry(`${JSON.stringify(parsedRegistry, null, 2)}\n`);
      } else {
        setExtensionRegistry(null);
      }
      const entryScreen = editorProject.screens.find((screen) => screen.id === editorProject.entryScreenId)
        ?? editorProject.screens[0];
      if (entryScreen) loadScreenBlueprint(entryScreen);
      setWorkflowStage('layout');
      if (missing.length > 0) {
        setNotice(t(language, 'projectMissingScreens', { paths: missing.join(', ') }));
      } else {
        setNotice(t(language, 'projectOpened', { name: editorProject.name }));
      }
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  function handleNewProject() {
    if (!blueprint) return;
    const editorProject = createProjectFromBlueprint(blueprint);
    setProject(editorProject);
    setActiveScreenId(editorProject.screens[0]?.id ?? null);
    setNotice(t(language, 'projectCreated', { name: editorProject.name }));
  }

  async function handleSaveProject() {
    if (!project) return;
    const synced = syncActiveScreen(project);
    setProject(synced);
    const doc = toProjectDocument(synced);
    const files: Record<string, string> = {
      [`${synced.id}.aub.project.json`]: `${JSON.stringify(doc, null, 2)}\n`,
    };
    for (const screen of synced.screens) {
      files[screen.path] = `${JSON.stringify(screen.blueprint, null, 2)}\n`;
    }
    if (extensionRegistry) files['aub.registry.json'] = extensionRegistry;
    await downloadProjectArchive(`${synced.id}.aub.project.zip`, files);
    setNotice(t(language, 'projectSaved'));
  }

  function handleCloseProject() {
    if (project) setProject(syncActiveScreen(project));
    setProject(null);
    setActiveScreenId(null);
    setExtensionRegistry(null);
    setNotice(t(language, 'projectClosed'));
  }

  function uniqueScreenId(base: string, taken: Set<string>): string {
    let candidate = base;
    let counter = 2;
    while (taken.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  }

  function handleAddScreen() {
    if (!project) return;
    const synced = syncActiveScreen(project);
    const taken = new Set(synced.screens.map((screen) => screen.id));
    const newBlueprint = createStarterBlueprint(language, 'page');
    const screenId = uniqueScreenId(`${synced.id}.screen`, taken);
    const placedBlueprint: Blueprint = {
      ...newBlueprint,
      screen: { ...newBlueprint.screen, id: screenId },
    };
    const name = placedBlueprint.screen.name;
    const newScreen = {
      id: screenId,
      name,
      path: `${screenId.replace(/[^a-z0-9._-]+/gi, '-')}.ui.json`,
      blueprint: placedBlueprint,
    };
    const next: EditorProject = { ...synced, screens: [...synced.screens, newScreen] };
    setProject(next);
    loadScreenBlueprint(newScreen);
    setNotice(t(language, 'screenAdded', { name }));
  }

  function handleRemoveScreen(id: string) {
    if (!project) return;
    if (project.screens.length <= 1) {
      setNotice(t(language, 'cannotRemoveLastScreen'));
      return;
    }
    const synced = syncActiveScreen(project);
    const removed = synced.screens.find((screen) => screen.id === id);
    const remaining = synced.screens.filter((screen) => screen.id !== id);
    const fallback = remaining[0];
    if (!fallback) {
      setNotice(t(language, 'cannotRemoveLastScreen'));
      return;
    }
    const nextEntry = synced.entryScreenId === id ? fallback.id : synced.entryScreenId;
    const next: EditorProject = {
      ...synced,
      screens: remaining,
      entryScreenId: nextEntry,
      navigation: synced.navigation.filter((edge) => edge.from !== id && edge.to !== id),
    };
    setProject(next);
    if (activeScreenId === id) {
      loadScreenBlueprint(fallback);
    }
    setNotice(t(language, 'screenRemoved', { name: removed?.name ?? id }));
  }

  function handleRenameScreen(id: string, name: string) {
    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        screens: current.screens.map((screen) =>
          screen.id === id
            ? { ...screen, name, blueprint: { ...screen.blueprint, screen: { ...screen.blueprint.screen, name } } }
            : screen
        ),
      };
    });
  }

  function handleSetEntryScreen(id: string) {
    setProject((current) => (current ? { ...current, entryScreenId: id } : current));
  }

  function handleUpdateNavigation(edges: NavigationEdge[]) {
    setProject((current) => (current ? { ...current, navigation: edges } : current));
  }

  function handleUpdateProjectMeta(patch: { name?: string; description?: string }) {
    setProject((current) => (current ? { ...current, ...patch } : current));
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!blueprint) return;
    const timer = window.setTimeout(() => {
      setSavedAt(saveDraft(blueprint, language));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [blueprint, language]);

  useEffect(() => {
    if (draggingType) setPropertiesOpen(false);
  }, [draggingType]);

  useEffect(() => {
    if (!blueprint || !['responsive', 'handoff'].includes(workflowStage)) return;
    let cancelled = false;
    setViewportQuality(null);
    const timer = window.setTimeout(() => {
      void canvasRef.current?.auditViewports().then((report) => {
        if (!cancelled) setViewportQuality(report);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [blueprint, workflowStage]);

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 980px)');
    const handleChange = () => {
      if (narrow.matches) setPropertiesOpen(false);
    };
    handleChange();
    narrow.addEventListener('change', handleChange);
    return () => narrow.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (isTextEditingTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        setHistory((current) => event.shiftKey ? redoHistory(current) : undoHistory(current));
      } else if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        setHistory((current) => redoHistory(current));
      }
    }
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  function handleAdd(
    type: ResolvedComponentType,
    parentId: string | null = null,
    position?: { x: number; y: number },
    viewportId: ViewportId = 'desktop',
    options: AddNodeOptions = {}
  ) {
    const localizedType = componentLabel(language, type);
    const createdNode = createNode(type, t(language, 'addedByEditor', { type: localizedType }), localizedType);
    const node: UINode = {
      ...createdNode,
      content: localizeDefaultContent(language, type, localizedType, createdNode.content),
    };
    const currentRoot = blueprint?.nodes.find((candidate) => candidate.parent_id === null);
    const currentSelected = selectedId
      ? blueprint?.nodes.find((candidate) => candidate.id === selectedId)
      : null;
    const destinationName = parentId
      ? blueprint?.nodes.find((candidate) => candidate.id === parentId)?.name
      : currentSelected && isContainerType(currentSelected.type)
        ? currentSelected.name
        : currentSelected?.parent_id
          ? blueprint?.nodes.find((candidate) => candidate.id === currentSelected.parent_id)?.name
          : currentRoot?.name;
    commit((current) => {
      let base = current ?? createStarterBlueprint(language);
      const root = base.nodes.find((candidate) => candidate.parent_id === null);
      const selectedNode = selectedId ? base.nodes.find((candidate) => candidate.id === selectedId) : null;
      const isShellSlot = type === 'top_bar' || type === 'header' || type === 'bottom_nav';
      const targetParent = parentId
        ?? (selectedNode && isContainerType(selectedNode.type) ? selectedNode.id : selectedNode?.parent_id)
        ?? root?.id
        ?? null;
      const target = targetParent ? base.nodes.find((candidate) => candidate.id === targetParent) : null;
      const routesToShell = isShellSlot && root?.type === 'app_shell';
      const wrapsInShell = isShellSlot && root?.type !== 'app_shell';
      let placedNode = node;

      if (options.existingPlacements?.length) {
        base = updateManyPlacements(base, options.existingPlacements);
      }
      if (options.makeParentFreeform && targetParent) {
        const currentTarget = base.nodes.find((candidate) => candidate.id === targetParent);
        if (currentTarget) {
          base = updateNode(base, targetParent, {
            layout: { ...currentTarget.layout, mode: 'freeform' },
          });
        }
      }

      if (options.makeParentFreeform || target?.layout?.mode === 'freeform' || root?.layout?.mode === 'freeform') {
        placedNode = {
          ...placedNode,
          placements: placementsForNewNode(base, placedNode.type, position, viewportId),
        };
      }
      if (type === 'sidebar') {
        placedNode = {
          ...placedNode,
          layout: { ...placedNode.layout, width: { value: 240, unit: 'px' } },
        };
      }
      if (routesToShell && root) return addNode(base, placedNode, root.id);
      if (wrapsInShell && root) {
        const shell = createNode('app_shell', t(language, 'starterAppShellRole'), t(language, 'starterAppShellName'));
        shell.layout = { mode: 'freeform' };
        return wrapRootInAppShell(base, shell, {
          ...placedNode,
          placements: placementsForNewNode(base, placedNode.type, position, viewportId),
        });
      }
      return addNode(base, placedNode, targetParent);
    });
    setSelectedIds([node.id]);
    setNotice(t(language, options.makeParentFreeform ? 'placedFreely' : 'addedToContainer', {
      component: localizedType,
      container: destinationName ?? t(language, 'starterRootName'),
    }));
  }

  function handleUpdate(id: string, patch: Partial<UINode>) {
    commit((current) => current ? updateNode(current, id, patch) : current);
  }

  function handleUpdatePlacements(
    updates: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }>
  ) {
    commit((current) => current ? updateManyPlacements(current, updates) : current);
  }

  function handleDelete(ids: string[]) {
    commit((current) => {
      if (!current) return current;
      return ids.reduce((next, id) => {
        const node = next.nodes.find((candidate) => candidate.id === id);
        return node?.parent_id ? deleteNode(next, id) : next;
      }, current);
    });
    setSelectedIds([]);
  }

  function handleDuplicate(ids: string[]) {
    if (!blueprint) return;
    const result = duplicateNodes(
      blueprint,
      ids,
      (name) => t(language, 'duplicateName', { name })
    );
    commit(result.blueprint);
    setSelectedIds(result.ids);
  }

  function handleReparent(id: string, parentId: string) {
    commit((current) => current ? reparentNode(current, id, parentId) : current);
  }

  function handleMoveNode(
    id: string,
    parentId: string,
    position: { x: number; y: number } | undefined,
    viewportId: ViewportId
  ) {
    const node = blueprint?.nodes.find((candidate) => candidate.id === id);
    const parent = blueprint?.nodes.find((candidate) => candidate.id === parentId);
    commit((current) => {
      if (!current) return current;
      const currentNode = current.nodes.find((candidate) => candidate.id === id);
      const currentParent = current.nodes.find((candidate) => candidate.id === parentId);
      if (!currentNode || !currentParent) return current;
      let next = currentNode.parent_id === parentId ? current : reparentNode(current, id, parentId);
      if (currentParent.layout?.mode === 'freeform' && position) {
        next = updateNodePlacement(next, id, viewportId, position);
      }
      return next;
    });
    setSelectedIds([id]);
    if (node && parent) {
      setNotice(t(language, 'movedToContainer', {
        component: node.name,
        container: parent.name,
      }));
    }
  }

  function handleZIndex(ids: string[], viewportId: ViewportId, direction: 'front' | 'back') {
    commit((current) => current ? setNodeZIndex(current, ids, viewportId, direction) : current);
  }

  function handleSetViewportSize(viewportId: ViewportId, size: { width?: number; height?: number }) {
    commit((current) => current ? setViewportSize(current, viewportId, size) : current);
  }

  async function handleExportMarkdown() {
    if (!blueprint) return;
    downloadBlob(`${blueprint.screen.id}.ui.md`, await exportMarkdown(blueprint), 'text/markdown');
  }

  function handleExportJson() {
    if (!blueprint) return;
    downloadBlob(`${blueprint.screen.id}.ui.json`, `${JSON.stringify(blueprint, null, 2)}\n`, 'application/json');
  }

  async function handleExportAgentPrompt() {
    if (!blueprint) return;
    downloadBlob(
      `${blueprint.screen.id}.codex.md`,
      await exportCodexPrompt(blueprint),
      'text/markdown'
    );
  }

  async function handleExportPackage() {
    if (!blueprint || !canvasRef.current) return;
    const quality = await canvasRef.current.auditViewports();
    setViewportQuality(quality);
    if (quality.issues.length > 0) {
      setNotice(t(language, 'viewportQualityBlocked', { count: quality.issues.length }));
      return;
    }
    setNotice(t(language, 'preparingPackage'));
    const images = await canvasRef.current.captureViewports();
    const markdown = await exportMarkdown(blueprint);
    const [genericPrompt, codexPrompt] = await Promise.all([
      exportGenericPrompt(blueprint),
      exportCodexPrompt(blueprint),
    ]);
    const reportTemplate = await createReportTemplate(blueprint);
    await downloadHandoffPackage(
      blueprint,
      markdown,
      genericPrompt,
      codexPrompt,
      reportTemplate,
      images,
      extensionRegistry
    );
    setNotice(t(language, 'packageReady'));
  }

  const selectedNode = selectedIds.length === 1
    ? blueprint?.nodes.find((node) => node.id === selectedId) ?? null
    : null;
  const modeLabel = workspaceConnection
    ? language === 'zh-Hant' ? 'Workspace mode' : 'Workspace mode'
    : language === 'zh-Hant' ? 'Demo mode' : 'Demo mode';
  const workspaceLabel = workspaceConnection
    ? language === 'zh-Hant' ? 'Workspace 已連線' : 'Workspace connected'
    : language === 'zh-Hant' ? '連接 Workspace' : 'Connect workspace';

  return (
    <div className="app">
      <TopBar
        blueprint={blueprint}
        onImport={handleImport}
        onAngularFiles={handleAngularFiles}
        onPersonalTemplateFile={handlePersonalTemplateFile}
        onRegistryFile={(file) => void handleRegistryFile(file)}
        onDownloadAuthoringKit={() => void downloadAuthoringKit()}
        onOpenProject={(files) => void handleOpenProjectFiles(files)}
        onNewProject={handleNewProject}
        onSaveProject={() => void handleSaveProject()}
        onCloseProject={handleCloseProject}
        projectActive={project !== null}
        onExportJson={handleExportJson}
        onExportMarkdown={handleExportMarkdown}
        onExportPackage={handleExportPackage}
        packageBlocked={Boolean(viewportQuality?.issues.length)}
        errorCount={errors.length}
        fileInputRef={fileInputRef}
        language={language}
        onLanguageChange={setLanguage}
        onTemplateSelect={handleTemplateSelect}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={() => setHistory((current) => undoHistory(current))}
        onRedo={() => setHistory((current) => redoHistory(current))}
        modeLabel={modeLabel}
        workspaceLabel={workspaceLabel}
        workspaceConnected={workspaceConnection !== null}
        onOpenWorkspace={() => setWorkspacePanelOpen(true)}
      />
      <WorkflowBar
        blueprint={blueprint}
        language={language}
        stage={workflowStage}
        savedAt={savedAt}
        errorCount={errors.length}
        viewportQuality={viewportQuality}
        onChange={setWorkflowStage}
      />
      {workspacePanelOpen && (
        <div className="workspace-drawer-shell" role="dialog" aria-modal="true" aria-label={language === 'zh-Hant' ? 'Workspace 設定' : 'Workspace settings'}>
          <button
            type="button"
            className="workspace-drawer-backdrop"
            aria-label={language === 'zh-Hant' ? '關閉 Workspace 設定' : 'Close workspace settings'}
            onClick={() => setWorkspacePanelOpen(false)}
          />
          <aside className="workspace-drawer">
            <div className="workspace-drawer-header">
              <div>
                <strong>{language === 'zh-Hant' ? 'Workspace 設定' : 'Workspace settings'}</strong>
                <span>{language === 'zh-Hant' ? '連線到本機 MCP 時才需要開啟。' : 'Use this only when connecting to a local MCP workspace.'}</span>
              </div>
              <button type="button" onClick={() => setWorkspacePanelOpen(false)}>
                {language === 'zh-Hant' ? '關閉' : 'Close'}
              </button>
            </div>
            <WorkspacePanel
              language={language}
              endpoint={workspaceEndpoint}
              connected={workspaceConnection !== null}
              loading={workspaceLoading}
              error={workspaceError}
              status={workspaceStatus}
              blueprint={blueprint}
              savePath={workspaceSavePath}
              onEndpointChange={setWorkspaceEndpoint}
              onConnect={() => void handleConnectWorkspace()}
              onDisconnect={() => {
                setWorkspaceConnection(null);
                setWorkspaceRpcToken(undefined);
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem(WORKSPACE_RPC_TOKEN_STORAGE_KEY);
                }
                setWorkspaceStatus(null);
                setWorkspaceError(null);
              }}
              onRefresh={() => void handleRefreshWorkspace()}
              onScanWorkspace={() => void handleScanWorkspaceUi()}
              onGenerateTemplate={(sourcePath) => void handleGenerateWorkspaceTemplate(sourcePath)}
              onLoadBlueprint={(path) => void handleLoadWorkspaceBlueprint(path)}
              onSaveBlueprint={() => void handleSaveWorkspaceBlueprint()}
              onSavePathChange={setWorkspaceSavePath}
              onPreviewChange={(patch) => void handleWorkspacePreviewChange(patch)}
              onReviewCandidate={(candidate, action, coreType) => void handleReviewComponentCandidate(candidate, action, coreType)}
            />
          </aside>
        </div>
      )}
      {project && (
        <ProjectBar
          project={project}
          activeScreenId={activeScreenId}
          language={language}
          onSwitchScreen={handleSwitchScreen}
          onAddScreen={handleAddScreen}
          onRemoveScreen={handleRemoveScreen}
          onRenameScreen={handleRenameScreen}
          onSetEntryScreen={handleSetEntryScreen}
          onUpdateNavigation={handleUpdateNavigation}
          onUpdateMeta={handleUpdateProjectMeta}
        />
      )}
      <div className={[
        'body',
        propertiesOpen ? '' : 'properties-collapsed',
        workflowStage === 'layout' ? '' : 'workflow-spec',
      ].filter(Boolean).join(' ')}>
        {workflowStage === 'layout' && (
          <Palette
            blueprint={blueprint}
            selectedIds={selectedIds}
            language={language}
            onAdd={(type) => {
              if (!canvasRef.current?.addComponent(type)) handleAdd(type);
            }}
            onSelect={setSelectedIds}
            onReparent={handleReparent}
            draggingType={draggingType}
            onDraggingTypeChange={setDraggingType}
            onTemplateSelect={handleTemplateSelect}
            personalTemplates={personalTemplates}
            workspaceTemplates={workspaceStatus?.templates ?? []}
            onSavePersonalTemplate={(name) => void handleSavePersonalTemplate(name)}
            onLoadPersonalTemplate={handleLoadPersonalTemplate}
            onLoadWorkspaceTemplate={handleLoadWorkspaceTemplate}
            onExportPersonalTemplate={(template) => void downloadPersonalTemplatePackage(template)}
            onDeletePersonalTemplate={handleDeletePersonalTemplate}
          />
        )}
        <Canvas
          ref={canvasRef}
          blueprint={blueprint}
          selectedIds={selectedIds}
          language={language}
          onSelectionChange={setSelectedIds}
          onAddNode={handleAdd}
          onDeleteNodes={handleDelete}
          onUpdateNode={handleUpdate}
          onUpdatePlacements={handleUpdatePlacements}
          onMoveNode={handleMoveNode}
          onDuplicateNodes={handleDuplicate}
          onSetZIndex={handleZIndex}
          onSetViewportSize={handleSetViewportSize}
          onCreateStarter={handleCreateStarter}
          onTemplateSelect={handleTemplateSelect}
          draggingType={draggingType}
          onDragComplete={() => setDraggingType(null)}
          resetKey={canvasResetKey}
          propertiesOpen={workflowStage !== 'layout' || propertiesOpen}
          onPropertiesOpen={() => setPropertiesOpen(true)}
        />
        {workflowStage === 'layout' && propertiesOpen && (
          <PropertiesPanel
            blueprint={blueprint}
            node={selectedNode}
            selectedCount={selectedIds.length}
            language={language}
            onUpdate={(patch) => selectedId && handleUpdate(selectedId, patch)}
            onUpdatePlacement={(viewportId, patch) => selectedId && commit((current) => (
              current ? updateNodePlacement(current, selectedId, viewportId, patch) : current
            ))}
            onDelete={() => handleDelete(selectedIds)}
            onSelectParent={() => selectedNode?.parent_id && setSelectedIds([selectedNode.parent_id])}
            onReparent={(parentId) => selectedId && handleReparent(selectedId, parentId)}
            onCollapse={() => setPropertiesOpen(false)}
          />
        )}
        {blueprint && workflowStage !== 'layout' && (
          <BlueprintPanel
            blueprint={blueprint}
            language={language}
            stage={workflowStage}
            errorCount={errors.length}
            viewportQuality={viewportQuality}
            onChange={(patch) => commit((current) => current ? { ...current, ...patch } : current)}
            onExportJson={handleExportJson}
            onExportMarkdown={handleExportMarkdown}
            onExportAgentPrompt={handleExportAgentPrompt}
            onExportPackage={handleExportPackage}
          />
        )}
      </div>
      {notice && <div className="toast-notice" role="status" aria-live="polite">{notice}</div>}
      {workflowStage === 'layout' && importDiagnostics.length > 0 && (
        <aside className="import-review-panel" aria-label={language === 'zh-Hant' ? '匯入診斷' : 'Import diagnostics'}>
          <header>
            <div>
              <strong>{language === 'zh-Hant' ? '匯入診斷' : 'Import diagnostics'}</strong>
              <span>{importDiagnostics.length}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={language === 'zh-Hant' ? '關閉匯入診斷' : 'Close import diagnostics'}
              title={language === 'zh-Hant' ? '關閉匯入診斷' : 'Close import diagnostics'}
              onClick={() => setImportDiagnostics([])}
            >
              ×
            </button>
          </header>
          <div className="import-review-list">
            {importDiagnostics.map((diagnostic, index) => (
              <button
                type="button"
                key={`${diagnostic.code}-${diagnostic.node_id ?? index}`}
                className={`import-review-item ${diagnostic.severity}`}
                disabled={!diagnostic.node_id}
                onClick={() => {
                  if (!diagnostic.node_id) return;
                  setSelectedIds([diagnostic.node_id]);
                  setPropertiesOpen(true);
                  requestAnimationFrame(() => canvasRef.current?.focusNode(diagnostic.node_id!));
                }}
              >
                <span>{diagnostic.message}</span>
                <small>
                  {diagnostic.file}{diagnostic.line ? `:${diagnostic.line}` : ''}
                  {diagnostic.node_id ? ` · ${language === 'zh-Hant' ? '定位元件' : 'Focus node'}` : ''}
                </small>
              </button>
            ))}
          </div>
        </aside>
      )}
      <AngularImportDialog
        open={angularImport.open}
        language={language}
        files={angularImport.files}
        entries={angularImport.entries}
        selectedEntry={angularImport.selectedEntry}
        result={angularImport.result}
        loading={angularImport.loading}
        error={angularImport.error}
        onEntryChange={(entry) => void runAngularEntry(angularImport.files, angularImport.entries, entry)}
        onClose={() => setAngularImport((current) => ({ ...current, open: false }))}
        onLoad={loadAngularResult}
        onResultChange={(result) => setAngularImport((current) => ({ ...current, result }))}
      />
      <footer className="statusbar">
        {blueprint ? (
          <>
            <span>{blueprint.nodes.length} {t(language, 'nodes')} · {selectedIds.length} {t(language, 'selected')} · {blueprint.acceptance.length} {t(language, 'acceptance')}</span>
            <span className={errors.length > 0 ? 'err' : 'ok'} style={{ marginLeft: 'auto' }}>
              {errors.length > 0 ? `${errors.length} ${t(language, 'schemaErrors')}` : t(language, 'schemaValid')}
            </span>
          </>
        ) : <span>{t(language, 'startHint')}</span>}
      </footer>
    </div>
  );
}

function placementsForNewNode(
  blueprint: Blueprint,
  type: ResolvedComponentType,
  position: { x: number; y: number } | undefined,
  activeViewport: ViewportId
): UINode['placements'] {
  const active = blueprint.viewports.find((viewport) => viewport.id === activeViewport) ?? blueprint.viewports[0];
  const base = defaultPlacementForType(type, position ?? { x: 32, y: 32 });
  const placements: UINode['placements'] = {};
  for (const viewport of blueprint.viewports) {
    const ratio = active ? Math.min(1, viewport.width / active.width) : 1;
    const scalesHorizontally = active ? base.width > active.width * 0.5 : false;
    const scalesVertically = active ? base.height > active.height * 0.5 : false;
    const width = scalesHorizontally ? Math.round(base.width * ratio) : base.width;
    const height = scalesVertically ? Math.round(base.height * ratio) : base.height;
    const clampedWidth = Math.max(24, Math.min(width, viewport.width - 32));
    const clampedHeight = Math.max(1, Math.min(height, viewport.height - 32));
    placements[viewport.id] = {
      ...base,
      x: Math.max(0, Math.min(Math.round(base.x * ratio), viewport.width - clampedWidth)),
      y: Math.max(0, Math.min(Math.round(base.y * ratio), viewport.height - clampedHeight)),
      width: clampedWidth,
      height: clampedHeight,
    };
  }
  return placements;
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function localizeDefaultContent(
  language: Language,
  type: ResolvedComponentType,
  label: string,
  content: UINode['content']
): UINode['content'] {
  if (!content) return content;
  switch (type) {
    case 'heading':
    case 'text':
    case 'badge':
    case 'tag':
    case 'link':
      return { ...content, text: label };
    case 'button':
      return { ...content, label };
    case 'image':
    case 'avatar':
      return { ...content, alt: label };
    case 'icon':
      return { ...content, label };
    case 'textarea':
      return { ...content, label, placeholder: t(language, 'enterValue') };
    case 'search_input':
      return { ...content, label, placeholder: `${label}...` };
    default:
      return content;
  }
}
