import { useEffect, useState } from 'react';
import { RefreshCcw, Save, Wifi, X } from 'lucide-react';
import { getCategories } from '../lib/registry';
import { previewUrl, type ComponentCandidate, type WorkspaceStatus } from '../lib/workspace-client';
import type { Blueprint } from '../types';
import type { Language } from '../lib/i18n';

interface Props {
  language: Language;
  endpoint: string;
  connected: boolean;
  loading: boolean;
  error: string | null;
  status: WorkspaceStatus | null;
  blueprint: Blueprint | null;
  savePath: string;
  onEndpointChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onScanWorkspace: () => void;
  onGenerateTemplate: (sourcePath: string) => void;
  onLoadBlueprint: (path: string) => void;
  onSaveBlueprint: () => void;
  onSavePathChange: (value: string) => void;
  onPreviewChange: (patch: { devServerUrl?: string; route?: string }) => void;
  onReviewCandidate: (candidate: ComponentCandidate, action: 'create_extension' | 'map_core' | 'ignore', coreType?: string) => void;
}

export function WorkspacePanel({
  language,
  endpoint,
  connected,
  loading,
  error,
  status,
  blueprint,
  savePath,
  onEndpointChange,
  onConnect,
  onDisconnect,
  onRefresh,
  onScanWorkspace,
  onGenerateTemplate,
  onLoadBlueprint,
  onSaveBlueprint,
  onSavePathChange,
  onPreviewChange,
  onReviewCandidate,
}: Props) {
  const zh = language === 'zh-Hant';
  const session = status?.session ?? null;
  const currentPreviewUrl = previewUrl(session);
  const [previewDraft, setPreviewDraft] = useState({ devServerUrl: '', route: '' });
  const [selectedTemplateSource, setSelectedTemplateSource] = useState('');
  const [instructionCopied, setInstructionCopied] = useState(false);

  useEffect(() => {
    setPreviewDraft({
      devServerUrl: session?.preview?.devServerUrl ?? '',
      route: session?.preview?.route ?? '',
    });
  }, [session?.preview?.devServerUrl, session?.preview?.route]);

  useEffect(() => {
    if (selectedTemplateSource) return;
    const firstRoute = status?.routes[0];
    if (firstRoute?.path) setSelectedTemplateSource(firstRoute.path);
  }, [selectedTemplateSource, status?.routes]);

  const previewDirty = previewDraft.devServerUrl !== (session?.preview?.devServerUrl ?? '')
    || previewDraft.route !== (session?.preview?.route ?? '');
  const agentInstruction = status ? buildAgentInstruction(language, status, savePath) : '';
  const canCopyInstruction = Boolean(status?.session.activeBlueprint || savePath.trim());

  async function copyAgentInstruction() {
    if (!agentInstruction) return;
    try {
      await navigator.clipboard.writeText(agentInstruction);
      setInstructionCopied(true);
      window.setTimeout(() => setInstructionCopied(false), 1800);
    } catch {
      window.prompt(zh ? '請複製這段 Agent 指令' : 'Copy this agent instruction', agentInstruction);
    }
  }

  return (
    <section className={`workspace-panel${connected ? ' connected' : ''}`}>
      <header>
        <div>
          <strong>{zh ? 'Workspace 連線' : 'Workspace connection'}</strong>
          <span>
            {connected && status
              ? `${status.packageName ?? 'workspace'} · ${status.frameworks.join(', ')}`
              : zh ? '連到本機 aub-mcp-http' : 'Connect to local aub-mcp-http'}
          </span>
        </div>
        <div className="workspace-connect-row">
          <input
            value={endpoint}
            onChange={(event) => onEndpointChange(event.target.value)}
            placeholder="http://127.0.0.1:3100/mcp"
          />
          <button type="button" onClick={connected ? onRefresh : onConnect} disabled={loading}>
            {connected ? <RefreshCcw /> : <Wifi />}
            {connected ? (zh ? '刷新' : 'Refresh') : (zh ? '連線' : 'Connect')}
          </button>
          {connected && (
            <button type="button" onClick={onDisconnect} title={zh ? '中斷連線' : 'Disconnect'}>
              <X />
            </button>
          )}
        </div>
      </header>
      {error && <p className="workspace-error">{error}</p>}
      {connected && status && (
        <>
          <section className="workspace-onboarding">
            <div>
              <h3>{zh ? '第一次使用流程' : 'First workspace loop'}</h3>
              <p>
                {zh
                  ? '照順序完成掃描、產範本、審核、儲存，再把指令交給 Agent。'
                  : 'Scan, generate a template, review candidates, save, then hand the instruction to your agent.'}
              </p>
            </div>
            <OnboardingSteps language={language} status={status} />
            <div className="workspace-onboarding-actions">
              <button type="button" onClick={onScanWorkspace} disabled={loading}>
                {zh ? '掃描專案' : 'Scan project'}
              </button>
              <select
                value={selectedTemplateSource}
                onChange={(event) => setSelectedTemplateSource(event.target.value)}
                disabled={status.routes.length === 0}
              >
                <option value="" disabled>{zh ? '選擇 route 產生範本' : 'Select route for template'}</option>
                {status.routes.map((route) => (
                  <option key={`${route.path}-${route.route}`} value={route.path}>
                    {route.route} · {route.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedTemplateSource || loading}
                onClick={() => onGenerateTemplate(selectedTemplateSource)}
              >
                {zh ? '產生範本' : 'Generate template'}
              </button>
              <button type="button" disabled={!canCopyInstruction} onClick={() => void copyAgentInstruction()}>
                {instructionCopied ? (zh ? '已複製' : 'Copied') : (zh ? '複製 Agent 指令' : 'Copy agent instruction')}
              </button>
            </div>
          </section>
          <div className="workspace-grid">
            <section>
            <h3>{zh ? 'Blueprint 檔案' : 'Blueprint files'}</h3>
            <select defaultValue="" onChange={(event) => event.target.value && onLoadBlueprint(event.target.value)}>
              <option value="" disabled>{zh ? '載入 workspace Blueprint...' : 'Load workspace Blueprint...'}</option>
              {status.routes.length === 0 && <option value="" disabled>{zh ? '尚未掃描 route' : 'No scanned routes yet'}</option>}
              {(status as any).blueprints?.map((entry: { path: string; screenName: string }) => (
                <option key={entry.path} value={entry.path}>{entry.screenName} · {entry.path}</option>
              ))}
            </select>
            <div className="workspace-save-row">
              <input value={savePath} onChange={(event) => onSavePathChange(event.target.value)} placeholder="screens/settings.ui.json" />
              <button type="button" disabled={!blueprint || loading} onClick={onSaveBlueprint}>
                <Save />
                {zh ? '存回 workspace' : 'Save to workspace'}
              </button>
            </div>
            <small>
              {session?.activeBlueprint
                ? `${zh ? '目前 session' : 'Current session'}: ${session.activeBlueprint}`
                : zh ? '儲存後 Agent 可透過 get_aub_session 讀到。' : 'After save, agents can read this through get_aub_session.'}
            </small>
          </section>
          <section>
            <h3>{zh ? '真實畫面預覽' : 'Implementation preview'}</h3>
            <input
              value={previewDraft.devServerUrl}
              onChange={(event) => setPreviewDraft((draft) => ({ ...draft, devServerUrl: event.target.value }))}
              placeholder="http://localhost:3000"
            />
            <input
              value={previewDraft.route}
              onChange={(event) => setPreviewDraft((draft) => ({ ...draft, route: event.target.value }))}
              placeholder="/settings"
            />
            <button
              type="button"
              disabled={!previewDirty || loading}
              onClick={() => onPreviewChange(previewDraft)}
            >
              {zh ? '套用預覽' : 'Apply preview'}
            </button>
            {currentPreviewUrl && (
              <>
                <a href={currentPreviewUrl} target="_blank" rel="noreferrer">{zh ? '另開預覽' : 'Open preview'}</a>
                <iframe title="AUB implementation preview" src={currentPreviewUrl} />
              </>
            )}
          </section>
          <section>
            <h3>{zh ? '自訂元件候選' : 'Component candidates'}</h3>
            <CandidateList
              language={language}
              candidates={status.componentCandidates}
              onReviewCandidate={onReviewCandidate}
            />
          </section>
          </div>
        </>
      )}
    </section>
  );
}

function OnboardingSteps({ language, status }: { language: Language; status: WorkspaceStatus }) {
  const zh = language === 'zh-Hant';
  const candidateCount = status.componentCandidates.length;
  const pendingCandidateCount = status.componentCandidates.filter((candidate) => candidate.status === 'candidate').length;
  const steps = [
    {
      done: true,
      label: zh ? '已連線 workspace' : 'Workspace connected',
    },
    {
      done: status.routes.length > 0 || status.routeCount > 0,
      label: zh ? '掃描 routes / components' : 'Scan routes / components',
    },
    {
      done: status.templates.length > 0 || status.templateCount > 0,
      label: zh ? '產生 workspace 範本' : 'Generate workspace template',
    },
    {
      done: candidateCount === 0 ? status.routes.length > 0 : pendingCandidateCount === 0,
      label: zh ? '審核自訂元件候選' : 'Review component candidates',
    },
    {
      done: Boolean(status.session.activeBlueprint),
      label: zh ? '儲存 Blueprint / session' : 'Save Blueprint / session',
    },
    {
      done: Boolean(status.session.activeBlueprint),
      label: zh ? '交給 Agent 實作' : 'Hand off to agent',
    },
  ];

  return (
    <ol className="workspace-onboarding-steps">
      {steps.map((step, index) => (
        <li key={step.label} className={step.done ? 'complete' : 'pending'}>
          <span>{step.done ? '✓' : index + 1}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function buildAgentInstruction(language: Language, status: WorkspaceStatus, savePath: string): string {
  const zh = language === 'zh-Hant';
  const session = status.session;
  const activeBlueprint = session.activeBlueprint ?? (savePath.trim() || '(active blueprint)');
  const targetRoute = session.targetRoute ?? session.preview?.route ?? '(target route)';
  const preview = previewUrl(session) || '(preview URL not set)';
  if (zh) {
    return [
      '我已經在 AUB Editor 調整好了。',
      '',
      '請透過 AUB MCP 讀取 get_aub_session，取得 activeBlueprint、targetRoute 與 preview 設定。',
      `目前 Blueprint：${activeBlueprint}`,
      `目標 route：${targetRoute}`,
      `預覽 URL：${preview}`,
      '',
      '接著請讀 get_blueprint，依照這份 Blueprint 修改目前專案的真實畫面。',
      '請優先使用 aub.registry.json 中已核准的元件 mapping，不要自行重做相似元件。',
      '完成後請提交 implementation report，逐項回報 acceptance criteria 與驗證證據。',
    ].join('\n');
  }
  return [
    'I finished adjusting the screen in AUB Editor.',
    '',
    'Use AUB MCP get_aub_session to read activeBlueprint, targetRoute, and preview settings.',
    `Current Blueprint: ${activeBlueprint}`,
    `Target route: ${targetRoute}`,
    `Preview URL: ${preview}`,
    '',
    'Then read get_blueprint and update the real app screen according to this Blueprint.',
    'Prefer approved component mappings from aub.registry.json. Do not recreate lookalike components.',
    'When done, submit an implementation report with evidence for every acceptance criterion.',
  ].join('\n');
}

function CandidateList({
  language,
  candidates,
  onReviewCandidate,
}: {
  language: Language;
  candidates: ComponentCandidate[];
  onReviewCandidate: Props['onReviewCandidate'];
}) {
  const zh = language === 'zh-Hant';
  const coreTypes = getCategories().flatMap((category) => category.types.map((type) => type.name));
  if (candidates.length === 0) {
    return <p className="empty">{zh ? '尚未有候選元件。請先讓 Agent 執行 scan_project_ui。' : 'No candidates yet. Ask an agent to run scan_project_ui first.'}</p>;
  }
  return (
    <div className="workspace-candidates">
      {candidates.map((candidate) => (
        <CandidateItem
          key={candidate.id}
          language={language}
          candidate={candidate}
          coreTypes={coreTypes}
          onReviewCandidate={onReviewCandidate}
        />
      ))}
    </div>
  );
}

function CandidateItem({
  language,
  candidate,
  coreTypes,
  onReviewCandidate,
}: {
  language: Language;
  candidate: ComponentCandidate;
  coreTypes: string[];
  onReviewCandidate: Props['onReviewCandidate'];
}) {
  const zh = language === 'zh-Hant';
  const defaultCore = candidate.suggestedCoreType && coreTypes.includes(candidate.suggestedCoreType)
    ? candidate.suggestedCoreType
    : 'card';
  return (
    <article className={`workspace-candidate ${candidate.status}`}>
      <strong>{candidate.componentName}</strong>
      <small>{candidate.suggestedType} · {candidate.sourcePath}</small>
      <span>{candidate.status}</span>
      <CandidateActions
        language={language}
        candidate={candidate}
        coreTypes={coreTypes}
        defaultCore={defaultCore}
        onReviewCandidate={onReviewCandidate}
      />
      {candidate.status !== 'candidate' && (
        <small>{zh ? '已審核' : 'Reviewed'}{candidate.approvedAs ? `: ${candidate.approvedAs}` : ''}</small>
      )}
    </article>
  );
}

function CandidateActions({
  language,
  candidate,
  coreTypes,
  defaultCore,
  onReviewCandidate,
}: {
  language: Language;
  candidate: ComponentCandidate;
  coreTypes: string[];
  defaultCore: string;
  onReviewCandidate: Props['onReviewCandidate'];
}) {
  const zh = language === 'zh-Hant';
  const selectId = `core-${candidate.id}`;
  if (candidate.status !== 'candidate') return null;
  return (
    <div className="workspace-candidate-actions">
      <select id={selectId} defaultValue={defaultCore}>
        {coreTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <button
        type="button"
        onClick={() => {
          const select = document.getElementById(selectId) as HTMLSelectElement | null;
          onReviewCandidate(candidate, 'map_core', select?.value ?? defaultCore);
        }}
      >
        {zh ? '映射 core' : 'Map core'}
      </button>
      <button type="button" onClick={() => onReviewCandidate(candidate, 'create_extension')}>
        {zh ? '建立 extension' : 'Create extension'}
      </button>
      <button type="button" onClick={() => onReviewCandidate(candidate, 'ignore')}>
        {zh ? '忽略' : 'Ignore'}
      </button>
    </div>
  );
}
