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
  onReviewCandidate: (candidate: ComponentCandidate, action: 'create_extension' | 'map_core' | 'ignore', coreType?: string) => void | Promise<void>;
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
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [instructionCopied, setInstructionCopied] = useState(false);
  const [reviewMode, setReviewMode] = useState<'template' | 'evidence'>('template');

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

  useEffect(() => {
    const candidateIds = new Set(status?.componentCandidates.map((candidate) => candidate.id) ?? []);
    setSelectedCandidateIds((current) => new Set([...current].filter((id) => candidateIds.has(id))));
  }, [status?.componentCandidates]);

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

  function toggleCandidate(id: string, selected: boolean) {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function reviewSelected(action: 'create_extension' | 'ignore') {
    const selected = status?.componentCandidates.filter((candidate) => selectedCandidateIds.has(candidate.id) && candidate.status === 'candidate') ?? [];
    for (const candidate of selected) void onReviewCandidate(candidate, action);
    setSelectedCandidateIds(new Set());
  }

  function approveHighConfidenceCore() {
    const highConfidence = status?.componentCandidates.filter((candidate) =>
      candidate.status === 'candidate'
      && candidate.suggestedCoreType
      && typeof candidate.confidence === 'number'
      && candidate.confidence >= 0.75
    ) ?? [];
    for (const candidate of highConfidence) void onReviewCandidate(candidate, 'map_core', candidate.suggestedCoreType);
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
              <h3>{zh ? '4 步完成既有 UI 修改交付' : '4-step existing UI handoff'}</h3>
              <p>
                {zh
                  ? '從連線、掃描、審核到交付，讓 Agent 依同一份 Blueprint 修改真實 app。'
                  : 'Connect, scan, review, and hand off one Blueprint-backed instruction for a real app change.'}
              </p>
            </div>
            <WorkspaceWizard language={language} status={status} />
            <div className="workspace-status-pills">
              <span>{zh ? 'Routes' : 'Routes'}: {status.routeCount || status.routes.length}</span>
              <span>{zh ? 'Templates' : 'Templates'}: {status.templateCount || status.templates.length}</span>
              <span>{zh ? '候選元件' : 'Candidates'}: {status.componentCandidateCount || status.componentCandidates.length}</span>
              <span>{zh ? 'Frameworks' : 'Frameworks'}: {status.frameworks.join(', ') || (zh ? '未偵測' : 'not detected')}</span>
              {status.scanReport && <span>{zh ? '掃描可信度' : 'Scan trust'}: {status.scanReport.trust.score}</span>}
              {status.storybook?.detected && <span>Storybook: {status.storybook.storyCount}</span>}
              {status.scanAudit && <span>{zh ? '略過' : 'Skipped'}: {status.scanAudit.filesSkipped + status.scanAudit.directoriesSkipped}</span>}
            </div>
            <div className="workspace-onboarding-actions">
              <button type="button" onClick={onScanWorkspace} disabled={loading}>
                {zh ? '掃描既有 app' : 'Scan existing app'}
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
                {zh ? '產生 candidate template' : 'Generate candidate template'}
              </button>
              <button type="button" disabled={!canCopyInstruction} onClick={() => void copyAgentInstruction()}>
                {instructionCopied ? (zh ? '已複製' : 'Copied') : (zh ? '複製 Agent 指令' : 'Copy agent instruction')}
              </button>
            </div>
            <div className="workspace-mode-tabs" role="tablist" aria-label={zh ? 'Workspace 審核模式' : 'Workspace review mode'}>
              <button
                type="button"
                className={reviewMode === 'template' ? 'active' : ''}
                aria-selected={reviewMode === 'template'}
                onClick={() => setReviewMode('template')}
              >
                {zh ? '範本審核' : 'Template Review'}
              </button>
              <button
                type="button"
                className={reviewMode === 'evidence' ? 'active' : ''}
                aria-selected={reviewMode === 'evidence'}
                onClick={() => setReviewMode('evidence')}
              >
                {zh ? 'PR 證據審核' : 'PR Evidence Review'}
              </button>
            </div>
            {status.scanReport && <ScanTrustSummary language={language} status={status} />}
          </section>
          <div className="workspace-grid">
            {reviewMode === 'template' && (
              <>
            <section>
            <h3>{zh ? 'Blueprint 檔案' : 'Blueprint files'}</h3>
              <select defaultValue="" onChange={(event) => event.target.value && onLoadBlueprint(event.target.value)}>
                <option value="" disabled>{zh ? '載入 workspace Blueprint...' : 'Load workspace Blueprint...'}</option>
                {status.routes.length === 0 && <option value="" disabled>{zh ? '尚未掃描 route' : 'No scanned routes yet'}</option>}
              {status.blueprints?.map((entry: { path: string; screenName: string }) => (
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
            <h3>{zh ? '自訂元件候選' : 'Component candidates'}</h3>
            <div className="workspace-candidate-batch">
              <button type="button" onClick={approveHighConfidenceCore}>
                {zh ? '核准高信心 core mapping' : 'Approve high-confidence core mappings'}
              </button>
              <button type="button" disabled={selectedCandidateIds.size === 0} onClick={() => reviewSelected('create_extension')}>
                {zh ? '選取項目建立 extension' : 'Create extension for selected'}
              </button>
              <button type="button" disabled={selectedCandidateIds.size === 0} onClick={() => reviewSelected('ignore')}>
                {zh ? '忽略選取項目' : 'Ignore selected'}
              </button>
              <button type="button" onClick={() => setSelectedCandidateIds(new Set())}>
                {zh ? '保留未決為候選' : 'Keep unresolved as candidates'}
              </button>
            </div>
            <CandidateList
              language={language}
              candidates={status.componentCandidates}
              selectedIds={selectedCandidateIds}
              onToggleCandidate={toggleCandidate}
              onReviewCandidate={onReviewCandidate}
            />
          </section>
          <section>
            <h3>{zh ? '來源對照' : 'Source references'}</h3>
            <SourceReferenceList language={language} templates={status.templates} />
          </section>
              </>
            )}
            {reviewMode === 'evidence' && (
              <>
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
            {status.implementationReport && (
              <div className="workspace-report-summary">
                <strong>{zh ? 'Implementation report' : 'Implementation report'}</strong>
                {'error' in status.implementationReport && status.implementationReport.error ? (
                  <small>{status.implementationReport.path}: {status.implementationReport.error}</small>
                ) : (
                  <>
                    <small>{status.implementationReport.path}</small>
                    {status.implementationReport.safetyScore && (
                      <div className="workspace-safety-score">
                        <strong>
                          {zh ? 'PR 安全分數' : 'PR Safety Score'} {status.implementationReport.safetyScore.overall}
                        </strong>
                        <span>{status.implementationReport.safetyScore.grade}</span>
                      </div>
                    )}
                    <div className="workspace-candidate-meta">
                      <span>pass {status.implementationReport.pass ?? 0}</span>
                      <span>fail {status.implementationReport.fail ?? 0}</span>
                      <span>{zh ? '待審' : 'review'} {status.implementationReport.needsReview ?? 0}</span>
                      <span>evidence {status.implementationReport.evidence ?? 0}</span>
                      {status.implementationReport.safetyScore && (
                        <>
                          <span>source {status.implementationReport.safetyScore.sourceCoverageScore}</span>
                          <span>viewport {status.implementationReport.safetyScore.viewportEvidenceScore}</span>
                          <span>reuse {status.implementationReport.safetyScore.componentReuseScore}</span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
          <section>
            <h3>{zh ? 'PR 驗證焦點' : 'PR verification focus'}</h3>
            <EvidenceFocus language={language} status={status} />
          </section>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ScanTrustSummary({ language, status }: { language: Language; status: WorkspaceStatus }) {
  const zh = language === 'zh-Hant';
  const report = status.scanReport;
  if (!report) return null;
  return (
    <div className={`workspace-scan-trust ${report.trust.grade}`}>
      <div>
        <strong>{zh ? '掃描可信度' : 'Scan trust'} {report.trust.score}</strong>
        <small>{report.path} · {report.trust.grade}</small>
      </div>
      <div className="workspace-candidate-meta">
        <span>{zh ? 'Routes' : 'Routes'} {report.summary.routes}</span>
        <span>{zh ? '候選' : 'Candidates'} {report.summary.componentCandidates}</span>
        <span>{zh ? '未決' : 'Unresolved'} {report.summary.unresolvedCandidates}</span>
        <span>{zh ? '掃描檔案' : 'Files'} {report.summary.filesScanned}</span>
      </div>
      {report.trust.warnings.length > 0 && (
        <small>{zh ? '警示' : 'Warnings'}: {report.trust.warnings.join(' ')}</small>
      )}
    </div>
  );
}

function EvidenceFocus({ language, status }: { language: Language; status: WorkspaceStatus }) {
  const zh = language === 'zh-Hant';
  const report = status.implementationReport;
  if (!report || ('error' in report && report.error)) {
    return (
      <p className="empty">
        {zh
          ? '尚未讀到 implementation report。Agent 完成後請把 report path 寫入 .aub/session.json。'
          : 'No implementation report is available yet. After implementation, the agent should write the report path into .aub/session.json.'}
      </p>
    );
  }
  const score = report.safetyScore;
  return (
    <div className="workspace-evidence-focus">
      <strong>{zh ? '這份 PR 是否可信？' : 'Is this PR trustworthy?'}</strong>
      <p>
        {zh
          ? '先看分數、機器證據、overflow 與 component reuse。低於門檻時，PR 不該只靠 Agent 自述通過。'
          : 'Start with score, machine evidence, overflow, and component reuse. Below threshold, the PR should not pass on agent narrative alone.'}
      </p>
      {score && (
        <div className="workspace-candidate-meta">
          <span>{zh ? '總分' : 'Overall'} {score.overall}</span>
          <span>{zh ? '來源' : 'Source'} {score.sourceCoverageScore}</span>
          <span>{zh ? '證據' : 'Evidence'} {score.acceptanceEvidenceScore}</span>
          <span>{zh ? 'Viewport' : 'Viewport'} {score.viewportEvidenceScore}</span>
          <span>{zh ? 'Overflow' : 'Overflow'} {score.overflowSafety}</span>
          <span>{zh ? 'Reuse' : 'Reuse'} {score.componentReuseScore}</span>
        </div>
      )}
      <small>{report.path}</small>
    </div>
  );
}

function WorkspaceWizard({ language, status }: { language: Language; status: WorkspaceStatus }) {
  const zh = language === 'zh-Hant';
  const candidateCount = status.componentCandidates.length;
  const pendingCandidateCount = status.componentCandidates.filter((candidate) => candidate.status === 'candidate').length;
  const steps = [
    {
      done: Boolean(status.root),
      label: zh ? 'Connect' : 'Connect',
      detail: zh
        ? `${status.packageName ?? 'workspace'} 已連線`
        : `${status.packageName ?? 'workspace'} is connected`,
    },
    {
      done: status.routes.length > 0 || status.routeCount > 0,
      label: zh ? 'Scan' : 'Scan',
      detail: zh
        ? `找到 ${status.routeCount || status.routes.length} 個 routes、${candidateCount} 個候選元件`
        : `Found ${status.routeCount || status.routes.length} routes and ${candidateCount} candidates`,
    },
    {
      done: status.templates.length > 0 || status.templateCount > 0,
      label: zh ? 'Review Template' : 'Review Template',
      detail: zh
        ? `${status.templateCount || status.templates.length} 個 workspace templates，${pendingCandidateCount} 個候選待審`
        : `${status.templateCount || status.templates.length} workspace templates, ${pendingCandidateCount} candidates pending`,
    },
    {
      done: Boolean(status.session.activeBlueprint),
      label: zh ? 'Hand Off' : 'Hand Off',
      detail: status.session.activeBlueprint
        ? status.session.activeBlueprint
        : zh ? '儲存 Blueprint/session 後複製 Agent 指令' : 'Save Blueprint/session, then copy the agent instruction',
    },
  ];

  return (
    <ol className="workspace-onboarding-steps">
      {steps.map((step, index) => (
        <li key={step.label} className={step.done ? 'complete' : 'pending'}>
          <span>{step.done ? '✓' : index + 1}</span>
          <strong>{step.label}</strong>
          <small>{step.detail}</small>
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
      'AUB UI 實作請求',
      '',
      '我已經在 AUB Editor 調整好了。請依照 AUB contract 修改真實 app，不要用自然語言自行重設計。',
      '',
      '請先透過 AUB MCP 讀取 get_aub_session，取得 activeBlueprint、targetRoute 與 preview 設定。',
      `目前 Blueprint：${activeBlueprint}`,
      `目標 route：${targetRoute}`,
      `預覽 URL：${preview}`,
      `Workspace：${status.root}`,
      '',
      '必要流程：',
      '1. 呼叫 get_aub_session 確認目前 session。',
      '2. 呼叫 get_blueprint 讀取 active Blueprint。',
      '3. 對每個自訂或 registry type 呼叫 resolve_component。',
      '4. 修改 target route 對應的真實程式碼。',
      '5. 不要自行建立 lookalike component；優先使用 aub.registry.json 中已核准 mapping。',
      '6. 不要自動 approve .aub/component-candidates.json；候選元件需使用者審核。',
      '7. 完成後提交 implementation report，逐項回報 acceptance criteria 與驗證證據。',
    ].join('\n');
  }
  return [
    'AUB UI implementation request',
    '',
    'I finished adjusting the screen in AUB Editor. Implement the real app change from the AUB contract; do not redesign from prose.',
    '',
    'Use AUB MCP get_aub_session to read activeBlueprint, targetRoute, and preview settings.',
    `Current Blueprint: ${activeBlueprint}`,
    `Target route: ${targetRoute}`,
    `Preview URL: ${preview}`,
    `Workspace: ${status.root}`,
    '',
    'Required workflow:',
    '1. Call get_aub_session to confirm the active session.',
    '2. Call get_blueprint for the active Blueprint.',
    '3. Call resolve_component for each custom or registry-backed type.',
    '4. Modify the real source code for the target route.',
    '5. Do not create lookalike components; prefer approved mappings from aub.registry.json.',
    '6. Do not auto-approve .aub/component-candidates.json; candidates require user review.',
    '7. When done, submit an implementation report with evidence for every acceptance criterion.',
  ].join('\n');
}

function CandidateList({
  language,
  candidates,
  selectedIds,
  onToggleCandidate,
  onReviewCandidate,
}: {
  language: Language;
  candidates: ComponentCandidate[];
  selectedIds: Set<string>;
  onToggleCandidate: (id: string, selected: boolean) => void;
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
          selected={selectedIds.has(candidate.id)}
          coreTypes={coreTypes}
          onToggleCandidate={onToggleCandidate}
          onReviewCandidate={onReviewCandidate}
        />
      ))}
    </div>
  );
}

function CandidateItem({
  language,
  candidate,
  selected,
  coreTypes,
  onToggleCandidate,
  onReviewCandidate,
}: {
  language: Language;
  candidate: ComponentCandidate;
  selected: boolean;
  coreTypes: string[];
  onToggleCandidate: (id: string, selected: boolean) => void;
  onReviewCandidate: Props['onReviewCandidate'];
}) {
  const zh = language === 'zh-Hant';
  const defaultCore = candidate.suggestedCoreType && coreTypes.includes(candidate.suggestedCoreType)
    ? candidate.suggestedCoreType
    : 'card';
  return (
    <article className={`workspace-candidate ${candidate.status}`}>
      <label className="workspace-candidate-select">
        <input
          type="checkbox"
          checked={selected}
          disabled={candidate.status !== 'candidate'}
          onChange={(event) => onToggleCandidate(candidate.id, event.target.checked)}
        />
        <strong>{candidate.componentName}</strong>
      </label>
      <small>{candidate.suggestedType} · {candidate.sourcePath}</small>
      <div className="workspace-candidate-meta">
        {candidate.framework && <span>{candidate.framework}</span>}
        {typeof candidate.usageCount === 'number' && <span>{zh ? '使用' : 'uses'} {candidate.usageCount}</span>}
        {typeof candidate.confidence === 'number' && <span>{zh ? '信心' : 'confidence'} {Math.round(candidate.confidence * 100)}%</span>}
        {candidate.suggestedCoreType && <span>{zh ? '建議 core' : 'core'}: {candidate.suggestedCoreType}</span>}
      </div>
      {candidate.props && candidate.props.length > 0 && (
        <small>{zh ? 'Props' : 'Props'}: {candidate.props.join(', ')}</small>
      )}
      {candidate.sourceUsage && candidate.sourceUsage.length > 0 && (
        <small>
          {zh ? '使用來源' : 'Usage'}: {candidate.sourceUsage.slice(0, 3).map((usage) => `${usage.file}${usage.line ? `:${usage.line}` : ''}`).join(', ')}
        </small>
      )}
      {candidate.storybookStories && candidate.storybookStories.length > 0 && (
        <small>
          Storybook: {candidate.storybookStories.slice(0, 3).map((story) => story.title ? `${story.title} · ${story.path}` : story.path).join(', ')}
        </small>
      )}
      {candidate.confidenceReason && <small>{candidate.confidenceReason}</small>}
      {candidate.mappingReason && <small>{candidate.mappingReason}</small>}
      {candidate.reason && <small>{candidate.reason}</small>}
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
      {candidate.reviewHistory && candidate.reviewHistory.length > 0 && (
        <small>
          {zh ? '紀錄' : 'History'}: {candidate.reviewHistory.map((entry) => entry.approvedAs ? `${entry.action}:${entry.approvedAs}` : entry.action).join(' → ')}
        </small>
      )}
    </article>
  );
}

function SourceReferenceList({ language, templates }: { language: Language; templates: WorkspaceStatus['templates'] }) {
  const zh = language === 'zh-Hant';
  const references = templates.flatMap((template) =>
    (template.sourceReferences ?? []).slice(0, 8).map((reference) => ({
      template: template.name,
      ...reference,
    }))
  ).slice(0, 24);
  const missing = templates.flatMap((template) =>
    (template.missingMappings ?? []).map((mapping) => ({
      template: template.name,
      ...mapping,
    }))
  ).slice(0, 24);
  if (references.length === 0 && missing.length === 0) {
    return <p className="empty">{zh ? '產生 workspace template 後會顯示來源對照。' : 'Generate a workspace template to see source references.'}</p>;
  }
  return (
    <div className="workspace-source-list">
      {references.map((reference, index) => (
        <div key={`${reference.template}-${reference.nodeId}-${index}`}>
          <strong>{reference.nodeId ?? reference.selector ?? reference.template}</strong>
          <small>{reference.template} · {reference.file}{reference.line ? `:${reference.line}` : ''}{reference.selector ? ` · ${reference.selector}` : ''}</small>
        </div>
      ))}
      {missing.length > 0 && (
        <>
          <h4>{zh ? '待審 mapping' : 'Missing mappings'}</h4>
          {missing.map((mapping, index) => (
            <div key={`${mapping.template}-${mapping.candidateId ?? mapping.componentName}-${index}`}>
              <strong>{mapping.componentName ?? mapping.suggestedType}</strong>
              <small>{mapping.template} · {mapping.suggestedType ?? mapping.suggestedCoreType} · {mapping.sourcePath}</small>
            </div>
          ))}
        </>
      )}
    </div>
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
