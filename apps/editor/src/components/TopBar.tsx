import { downloadBlob, readFileAsText } from '../lib/io';
import type { Blueprint } from '../types';

interface Props {
  blueprint: Blueprint | null;
  onImport: (b: Blueprint) => void;
  onExportMarkdown: () => void;
  errorCount: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function TopBar({ blueprint, onImport, onExportMarkdown, errorCount, fileInputRef }: Props) {
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
      window.alert(`Failed to parse JSON: ${(err as Error).message}`);
    }
    // Reset so the same file can be re-selected later.
    e.target.value = '';
  }

  function handleExportJson() {
    if (!blueprint) return;
    downloadBlob(`${blueprint.screen.id}.ui.json`, JSON.stringify(blueprint, null, 2), 'application/json');
  }

  return (
    <header className="topbar">
      <h1>AUB Editor — {blueprint ? blueprint.screen.name : 'no blueprint loaded'}</h1>
      <div className="actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button onClick={handleImportClick}>Import JSON</button>
        <button onClick={handleExportJson} disabled={!blueprint} className="primary">
          Export JSON
        </button>
        <button onClick={onExportMarkdown} disabled={!blueprint}>
          Export Markdown
        </button>
        <span style={{ marginLeft: 8, color: errorCount > 0 ? 'var(--danger)' : 'var(--ok)' }}>
          {errorCount > 0 ? `${errorCount} schema error${errorCount === 1 ? '' : 's'}` : 'valid'}
        </span>
      </div>
    </header>
  );
}
