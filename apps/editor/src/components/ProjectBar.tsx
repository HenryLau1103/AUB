import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Star, Trash2, X } from 'lucide-react';
import { t, type Language } from '../lib/i18n';
import { NAV_TRIGGERS, type EditorProject, type NavigationEdge, type NavigationTrigger } from '../lib/project';
import { Tooltip } from './Tooltip';

interface Props {
  project: EditorProject;
  activeScreenId: string | null;
  language: Language;
  onSwitchScreen: (id: string) => void;
  onAddScreen: () => void;
  onRemoveScreen: (id: string) => void;
  onRenameScreen: (id: string, name: string) => void;
  onSetEntryScreen: (id: string) => void;
  onUpdateNavigation: (edges: NavigationEdge[]) => void;
  onUpdateMeta: (patch: { name?: string; description?: string }) => void;
}

export function ProjectBar({
  project,
  activeScreenId,
  language,
  onSwitchScreen,
  onAddScreen,
  onRemoveScreen,
  onRenameScreen,
  onSetEntryScreen,
  onUpdateNavigation,
  onUpdateMeta,
}: Props) {
  const [navOpen, setNavOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function commitRename(id: string) {
    const next = draftName.trim();
    if (next) onRenameScreen(id, next);
    setEditingId(null);
  }

  function updateEdge(index: number, patch: Partial<NavigationEdge>) {
    const next = project.navigation.map((edge, i) => (i === index ? { ...edge, ...patch } : edge));
    onUpdateNavigation(next);
  }

  function removeEdge(index: number) {
    onUpdateNavigation(project.navigation.filter((_, i) => i !== index));
  }

  function addEdge() {
    const first = project.screens[0]?.id ?? '';
    const second = project.screens[1]?.id ?? first;
    onUpdateNavigation([...project.navigation, { from: first, to: second }]);
  }

  const screenOnly = project.screens.length <= 1;

  return (
    <div className="project-bar">
      <div className="project-bar-meta">
        <input
          className="project-name-input"
          aria-label={t(language, 'projectName')}
          placeholder={t(language, 'projectName')}
          value={project.name}
          onChange={(event) => onUpdateMeta({ name: event.target.value })}
        />
        <input
          className="project-description-input"
          aria-label={t(language, 'projectDescription')}
          placeholder={t(language, 'projectDescription')}
          value={project.description ?? ''}
          onChange={(event) => onUpdateMeta({ description: event.target.value })}
        />
      </div>
      <div className="project-screens" role="tablist" aria-label={t(language, 'projectScreens')}>
        {project.screens.map((screen) => {
          const isActive = screen.id === activeScreenId;
          const isEntry = screen.id === project.entryScreenId;
          return (
            <div key={screen.id} className={`project-tab ${isActive ? 'active' : ''}`}>
              {editingId === screen.id ? (
                <input
                  className="project-tab-rename"
                  autoFocus
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => commitRename(screen.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename(screen.id);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="project-tab-label"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSwitchScreen(screen.id)}
                  onDoubleClick={() => {
                    setEditingId(screen.id);
                    setDraftName(screen.name);
                  }}
                >
                  {isEntry && <Star className="project-tab-entry" aria-hidden />}
                  <span>{screen.name}</span>
                </button>
              )}
              <Tooltip label={t(language, 'setEntryScreen')}>
                <button
                  type="button"
                  className="project-tab-icon"
                  aria-label={t(language, 'setEntryScreen')}
                  disabled={isEntry}
                  onClick={() => onSetEntryScreen(screen.id)}
                >
                  <Star />
                </button>
              </Tooltip>
              <Tooltip label={t(language, 'removeScreen')} align="end">
                <button
                  type="button"
                  className="project-tab-icon"
                  aria-label={t(language, 'removeScreen')}
                  disabled={screenOnly}
                  onClick={() => onRemoveScreen(screen.id)}
                >
                  <X />
                </button>
              </Tooltip>
            </div>
          );
        })}
        <Tooltip label={t(language, 'addScreen')}>
          <button
            type="button"
            className="project-add-screen"
            aria-label={t(language, 'addScreen')}
            onClick={onAddScreen}
          >
            <Plus />
          </button>
        </Tooltip>
        <button
          type="button"
          className="project-nav-toggle"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? <ChevronUp /> : <ChevronDown />}
          <span>{navOpen ? t(language, 'hideNavigation') : t(language, 'showNavigation')}</span>
        </button>
      </div>
      {navOpen && (
        <div className="project-nav-editor">
          <div className="project-nav-toolbar">
            <strong>{t(language, 'navigation')}</strong>
            <button type="button" onClick={addEdge}><Plus />{t(language, 'addNavEdge')}</button>
          </div>
          {project.navigation.length === 0 ? (
            <p className="project-nav-empty">{t(language, 'noNavEdges')}</p>
          ) : (
            <div className="project-nav-rows">
              {project.navigation.map((edge, index) => (
                <div className="project-nav-row" key={index}>
                  <label>
                    <span>{t(language, 'navFrom')}</span>
                    <select value={edge.from} onChange={(event) => updateEdge(index, { from: event.target.value })}>
                      {project.screens.map((screen) => (
                        <option key={screen.id} value={screen.id}>{screen.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t(language, 'navTo')}</span>
                    <select value={edge.to} onChange={(event) => updateEdge(index, { to: event.target.value })}>
                      {project.screens.map((screen) => (
                        <option key={screen.id} value={screen.id}>{screen.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t(language, 'navTrigger')}</span>
                    <select
                      value={edge.trigger ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateEdge(index, { trigger: value ? (value as NavigationTrigger) : undefined });
                      }}
                    >
                      <option value="">{t(language, 'navTriggerNone')}</option>
                      {NAV_TRIGGERS.map((trigger) => (
                        <option key={trigger} value={trigger}>{trigger}</option>
                      ))}
                    </select>
                  </label>
                  <label className="project-nav-label-field">
                    <span>{t(language, 'navLabel')}</span>
                    <input
                      value={edge.label ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateEdge(index, { label: value ? value : undefined });
                      }}
                    />
                  </label>
                  <Tooltip label={t(language, 'removeScreen')} align="end">
                    <button
                      type="button"
                      className="project-nav-remove"
                      aria-label={t(language, 'removeScreen')}
                      onClick={() => removeEdge(index)}
                    >
                      <Trash2 />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
