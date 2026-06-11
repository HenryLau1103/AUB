import {
  Download,
  BookOpenCheck,
  FileArchive,
  FileCode2,
  FileJson,
  FileText,
  FolderOpen,
  FolderPlus,
  LibraryBig,
  Redo2,
  Save,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { useRef } from 'react';
import { readFileAsText } from '../lib/io';
import { LANGUAGES, languageOptionLabel, t, type Language } from '../lib/i18n';
import { TEMPLATE_GROUPS, templateLabel, type TemplateId } from '../lib/templates';
import type { Blueprint } from '../types';
import { Tooltip } from './Tooltip';

interface Props {
  blueprint: Blueprint | null;
  onImport: (blueprint: Blueprint) => void;
  onAngularFiles: (files: FileList) => void;
  onPersonalTemplateFile: (file: File) => void;
  onDownloadAuthoringKit: () => void;
  onOpenProject: (files: FileList) => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onCloseProject: () => void;
  projectActive: boolean;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportPackage: () => void;
  packageBlocked: boolean;
  errorCount: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onTemplateSelect: (templateId: TemplateId) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function TopBar({
  blueprint,
  onImport,
  onAngularFiles,
  onPersonalTemplateFile,
  onDownloadAuthoringKit,
  onOpenProject,
  onNewProject,
  onSaveProject,
  onCloseProject,
  projectActive,
  onExportJson,
  onExportMarkdown,
  onExportPackage,
  packageBlocked,
  errorCount,
  fileInputRef,
  language,
  onLanguageChange,
  onTemplateSelect,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const angularInputRef = useRef<HTMLInputElement>(null);
  const personalTemplateInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onImport(JSON.parse(await readFileAsText(file)) as Blueprint);
    } catch (error) {
      window.alert(t(language, 'parseJsonFailed', { message: (error as Error).message }));
    }
    event.target.value = '';
  }

  return (
    <header className="topbar">
      <div className="brand-block">
        <strong>{t(language, 'appTitle')}</strong>
        <span>{blueprint?.screen.name ?? t(language, 'noBlueprintLoaded')}</span>
      </div>
      <div className="topbar-actions">
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileChange} hidden />
        <input
          ref={angularInputRef}
          type="file"
          accept=".html,.scss,.css,.ts,.zip,application/zip"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) onAngularFiles(event.target.files);
            event.target.value = '';
          }}
          hidden
        />
        <input
          ref={personalTemplateInputRef}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPersonalTemplateFile(file);
            event.target.value = '';
          }}
          hidden
        />
        <input
          ref={projectInputRef}
          type="file"
          accept=".json,application/json"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) onOpenProject(event.target.files);
            event.target.value = '';
          }}
          hidden
        />
        <label className="language-select">
          <span>{t(language, 'language')}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
            {LANGUAGES.map((item) => <option key={item.id} value={item.id}>{languageOptionLabel(language, item.id)}</option>)}
          </select>
        </label>
        <label className="template-select">
          <span>{t(language, 'template')}</span>
          <select defaultValue="" onChange={(event) => {
            const value = event.target.value as TemplateId | '';
            if (value) onTemplateSelect(value);
            event.target.value = '';
          }}>
            <option value="" disabled>{t(language, 'chooseTemplate')}</option>
            {TEMPLATE_GROUPS.map((group) => (
              <optgroup key={group.id} label={language === 'zh-Hant' ? group.labelZh : group.labelEn}>
                {group.ids.map((id) => <option key={id} value={id}>{templateLabel(language, id)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="topbar-icon-group">
          <ToolButton icon={<Undo2 />} label={t(language, 'undo')} disabled={!canUndo} onClick={onUndo} />
          <ToolButton icon={<Redo2 />} label={t(language, 'redo')} disabled={!canRedo} onClick={onRedo} />
          <ToolButton icon={<Upload />} label={t(language, 'importJson')} onClick={() => fileInputRef.current?.click()} />
          <ToolButton icon={<FileCode2 />} label={t(language, 'importAngular')} onClick={() => angularInputRef.current?.click()} />
          <ToolButton icon={<LibraryBig />} label={t(language, 'importPersonalTemplate')} onClick={() => personalTemplateInputRef.current?.click()} />
          <ToolButton icon={<BookOpenCheck />} label={t(language, 'downloadAuthoringKit')} onClick={onDownloadAuthoringKit} />
          <ToolButton icon={<FolderOpen />} label={t(language, 'openProject')} onClick={() => projectInputRef.current?.click()} />
          <ToolButton icon={<FolderPlus />} label={t(language, 'newProject')} disabled={!blueprint} onClick={onNewProject} />
          <ToolButton icon={<Save />} label={t(language, 'saveProject')} disabled={!projectActive} onClick={onSaveProject} />
          {projectActive && (
            <ToolButton icon={<X />} label={t(language, 'closeProject')} onClick={onCloseProject} />
          )}
        </div>
        <div className="export-menu">
          <Download />
          <ToolButton icon={<FileJson />} label={t(language, 'exportJson')} disabled={!blueprint} onClick={onExportJson} />
          <ToolButton icon={<FileText />} label={t(language, 'exportMarkdown')} disabled={!blueprint} onClick={onExportMarkdown} />
          <ToolButton
            icon={<FileArchive />}
            label={t(language, 'exportPackage')}
            tooltipAlign="end"
            disabled={!blueprint || errorCount > 0 || packageBlocked}
            onClick={onExportPackage}
          />
        </div>
        <span className={`validation-pill ${errorCount ? 'invalid' : 'valid'}`}>
          {errorCount ? `${errorCount} ${t(language, 'schemaErrors')}` : t(language, 'valid')}
        </span>
      </div>
    </header>
  );
}

function ToolButton({
  icon,
  label,
  tooltipAlign,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tooltipAlign?: 'center' | 'end';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label} align={tooltipAlign}>
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
