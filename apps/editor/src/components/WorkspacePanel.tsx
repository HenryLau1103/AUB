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

  useEffect(() => {
    setPreviewDraft({
      devServerUrl: session?.preview?.devServerUrl ?? '',
      route: session?.preview?.route ?? '',
    });
  }, [session?.preview?.devServerUrl, session?.preview?.route]);

  const previewDirty = previewDraft.devServerUrl !== (session?.preview?.devServerUrl ?? '')
    || previewDraft.route !== (session?.preview?.route ?? '');

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
        <div className="workspace-grid">
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
      )}
    </section>
  );
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
