import { downloadBlob, readFileAsText } from '../lib/io';
import { LANGUAGES, languageOptionLabel, t, type Language } from '../lib/i18n';
import { TEMPLATE_IDS, templateLabel, type TemplateId } from '../lib/templates';
import type { Blueprint } from '../types';

interface Props {
  blueprint: Blueprint | null;
  onImport: (b: Blueprint) => void;
  onExportMarkdown: () => void;
  errorCount: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onTemplateSelect: (templateId: TemplateId) => void;
}

export function TopBar({
  blueprint,
  onImport,
  onExportMarkdown,
  errorCount,
  fileInputRef,
  language,
  onLanguageChange,
  onTemplateSelect,
}: Props) {
  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    try {
      const parsed = JSON.parse(text) as Blueprint;
      onImport(parsed);
    } catch (err) {
      window.alert(t(language, 'parseJsonFailed', { message: (err as Error).message }));
    }
    // Reset so the same file can be re-selected later.
    e.target.value = '';
  }

  function handleExportJson() {
    if (!blueprint) return;
    downloadBlob(`${blueprint.screen.id}.ui.json`, JSON.stringify(blueprint, null, 2), 'application/json');
  }

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as TemplateId | '';
    if (value) onTemplateSelect(value);
    e.target.value = '';
  }

  return (
    <header className="topbar">
      <h1>{t(language, 'appTitle')} — {blueprint ? blueprint.screen.name : t(language, 'noBlueprintLoaded')}</h1>
      <div className="actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <label className="language-select">
          <span>{t(language, 'language')}</span>
          <select value={language} onChange={(e) => onLanguageChange(e.target.value as Language)}>
            {LANGUAGES.map((item) => (
              <option key={item.id} value={item.id}>
                {languageOptionLabel(language, item.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="template-select">
          <span>{t(language, 'template')}</span>
          <select defaultValue="" onChange={handleTemplateChange}>
            <option value="" disabled>
              {t(language, 'chooseTemplate')}
            </option>
            {TEMPLATE_IDS.map((templateId) => (
              <option key={templateId} value={templateId}>
                {templateLabel(language, templateId)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleImportClick}>{t(language, 'importJson')}</button>
        <button onClick={handleExportJson} disabled={!blueprint} className="primary">
          {t(language, 'exportJson')}
        </button>
        <button onClick={onExportMarkdown} disabled={!blueprint}>
          {t(language, 'exportMarkdown')}
        </button>
        <span style={{ marginLeft: 8, color: errorCount > 0 ? 'var(--danger)' : 'var(--ok)' }}>
          {errorCount > 0
            ? `${errorCount} ${t(language, errorCount === 1 ? 'schemaError' : 'schemaErrors')}`
            : t(language, 'valid')}
        </span>
      </div>
    </header>
  );
}
