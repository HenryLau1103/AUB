import { AlertTriangle, Bot, Check, FileCode2, LoaderCircle, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  requestImportSuggestions,
  type AngularComponentCandidate,
  type AngularImportResult,
  type ImportSuggestion,
  type SourceBundleFile,
} from '../lib/angular-import';
import type { Language, } from '../lib/i18n';
import type { UINode } from '../types';

interface Props {
  open: boolean;
  language: Language;
  files: SourceBundleFile[];
  entries: AngularComponentCandidate[];
  selectedEntry: string;
  result: AngularImportResult | null;
  loading: boolean;
  error: string | null;
  onEntryChange: (entry: string) => void;
  onClose: () => void;
  onLoad: (result: AngularImportResult) => void;
  onResultChange: (result: AngularImportResult) => void;
}

export function AngularImportDialog({
  open,
  language,
  files,
  entries,
  selectedEntry,
  result,
  loading,
  error,
  onEntryChange,
  onClose,
  onLoad,
  onResultChange,
}: Props) {
  const zh = language === 'zh-Hant';
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('aub.ollama.base-url') ?? import.meta.env.VITE_AUB_OLLAMA_URL ?? 'http://127.0.0.1:11434');
  const [model, setModel] = useState(() => localStorage.getItem('aub.ollama.model') ?? import.meta.env.VITE_AUB_OLLAMA_MODEL ?? '');
  const [suggestions, setSuggestions] = useState<ImportSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setSuggestions([]);
    setAiError(null);
  }, [result]);

  const counts = useMemo(() => ({
    errors: result?.diagnostics.filter((item) => item.severity === 'error').length ?? 0,
    warnings: result?.diagnostics.filter((item) => item.severity === 'warning').length ?? 0,
  }), [result]);

  if (!open) return null;

  async function handleAiReview() {
    if (!result || !model.trim()) return;
    setAiLoading(true);
    setAiError(null);
    localStorage.setItem('aub.ollama.base-url', baseUrl);
    localStorage.setItem('aub.ollama.model', model);
    try {
      setSuggestions(await requestImportSuggestions(result, files, { baseUrl, model }));
    } catch (nextError) {
      setAiError((nextError as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  function applySuggestion(suggestion: ImportSuggestion) {
    if (!result) return;
    const nodes = result.blueprint.nodes.map((node) => (
      node.id === suggestion.node_id ? mergeNodePatch(node, suggestion.patch) : node
    ));
    onResultChange({ ...result, blueprint: { ...result.blueprint, nodes } });
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="angular-import-title">
        <header>
          <div>
            <FileCode2 />
            <div>
              <h2 id="angular-import-title">{zh ? '匯入 Angular 元件' : 'Import Angular component'}</h2>
              <p>{zh ? `${files.length} 個來源檔案` : `${files.length} source files`}</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={zh ? '關閉' : 'Close'}
            title={zh ? '關閉' : 'Close'}
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        <div className="import-dialog-body">
          <label className="import-entry-field">
            <span>{zh ? '入口元件' : 'Entry component'}</span>
            <select value={selectedEntry} onChange={(event) => onEntryChange(event.target.value)}>
              {entries.map((entry) => (
                <option key={entry.selector ?? entry.templatePath ?? entry.label} value={entry.selector ?? entry.templatePath ?? ''}>
                  {entry.label} {entry.templatePath ? `· ${entry.templatePath}` : ''}
                </option>
              ))}
            </select>
          </label>

          {loading && <div className="import-loading"><LoaderCircle className="spin" />{zh ? '正在解析元件、樣式與互動…' : 'Parsing components, styles, and interactions...'}</div>}
          {error && <div className="import-error"><AlertTriangle />{error}</div>}

          {result && !loading && (
            <>
              <div className="import-summary">
                <div><strong>{result.blueprint.nodes.length}</strong><span>{zh ? '節點' : 'Nodes'}</span></div>
                <div><strong>{result.blueprint.interactions.length}</strong><span>{zh ? '互動' : 'Interactions'}</span></div>
                <div><strong>{Math.round(result.confidenceSummary.score * 100)}%</strong><span>{zh ? '解析信心' : 'Confidence'}</span></div>
                <div className={counts.warnings ? 'warn' : ''}><strong>{counts.warnings}</strong><span>{zh ? '警告' : 'Warnings'}</span></div>
              </div>

              <section className="import-diagnostics">
                <h3>{zh ? '解析診斷' : 'Import diagnostics'}</h3>
                {result.diagnostics.length === 0
                  ? <p className="import-clean"><Check />{zh ? '沒有需要處理的問題。' : 'No issues require review.'}</p>
                  : result.diagnostics.map((diagnostic, index) => (
                    <div
                      key={`${diagnostic.code}-${diagnostic.node_id ?? index}`}
                      className={`diagnostic-row ${diagnostic.severity}`}
                    >
                      <AlertTriangle />
                      <span>
                        <strong>{diagnostic.message}</strong>
                        <small>{diagnostic.file}{diagnostic.line ? `:${diagnostic.line}` : ''} · {Math.round(diagnostic.confidence * 100)}%</small>
                      </span>
                    </div>
                  ))}
              </section>

              <section className="import-ai">
                <div className="import-ai-heading">
                  <div><Bot /><strong>{zh ? '本機 AI 建議' : 'Local AI suggestions'}</strong></div>
                  <button type="button" onClick={handleAiReview} disabled={aiLoading || !model.trim()}>
                    {aiLoading ? <LoaderCircle className="spin" /> : <Bot />}
                    {zh ? '分析低信心項目' : 'Review low-confidence items'}
                  </button>
                </div>
                <div className="import-ai-config">
                  <label><span>Ollama URL</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
                  <label><span>{zh ? '模型' : 'Model'}</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="qwen3.6:35b" /></label>
                </div>
                {aiError && <p className="import-ai-error">{aiError}</p>}
                {suggestions.map((suggestion) => (
                  <div className="ai-suggestion" key={suggestion.id}>
                    <div>
                      <strong>{result.blueprint.nodes.find((node) => node.id === suggestion.node_id)?.name ?? suggestion.node_id}</strong>
                      <p>{suggestion.reason}</p>
                      <small>{Math.round(suggestion.confidence * 100)}%</small>
                    </div>
                    <button type="button" onClick={() => applySuggestion(suggestion)}>{zh ? '套用' : 'Apply'}</button>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>

        <footer>
          <button type="button" onClick={onClose}>{zh ? '取消' : 'Cancel'}</button>
          <button type="button" className="primary" disabled={!result || loading || counts.errors > 0} onClick={() => result && onLoad(result)}>
            {zh ? '載入畫布' : 'Load into canvas'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function mergeNodePatch(node: UINode, patch: ImportSuggestion['patch']): UINode {
  return {
    ...node,
    ...patch,
    id: node.id,
    parent_id: node.parent_id,
    children: node.children,
    content: patch.content ? { ...node.content, ...patch.content } : node.content,
    bindings: patch.bindings ? { ...node.bindings, ...patch.bindings } : node.bindings,
    validation: patch.validation ? { ...node.validation, ...patch.validation } : node.validation,
  };
}
