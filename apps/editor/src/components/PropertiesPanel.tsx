import { useState, useEffect } from 'react';
import type { UINode, ComponentType } from '../types';
import { isContainerType } from '../lib/registry';
import { getCategories } from '../lib/registry';
import { categoryLabel, componentLabel, t, type Language } from '../lib/i18n';
import { defaultLayoutForType } from '../lib/store';
import type { Layout } from '../types';

interface Props {
  node: UINode | null;
  language: Language;
  onUpdate: (patch: Partial<UINode>) => void;
  onDelete: () => void;
  onSelectParent: () => void;
  onCollapse: () => void;
}

export function PropertiesPanel({ node, language, onUpdate, onDelete, onSelectParent, onCollapse }: Props) {
  if (!node) {
    return (
      <aside className="panel properties">
        <div className="properties-header">
          <h2>{t(language, 'properties')}</h2>
          <button type="button" onClick={onCollapse}>{t(language, 'hideProperties')}</button>
        </div>
        <p className="empty">{t(language, 'selectNode')}</p>
      </aside>
    );
  }
  const canDelete = node.parent_id !== null;

  return (
    <aside className="panel properties">
      <div className="properties-header">
        <h2>{t(language, 'properties')}</h2>
        <div className="properties-header-actions">
          <button type="button" onClick={onCollapse}>
            {t(language, 'hideProperties')}
          </button>
          {node.parent_id && (
            <button type="button" onClick={onSelectParent}>
              {t(language, 'selectParent')}
            </button>
          )}
          <button
            type="button"
            className="danger-button"
            onClick={onDelete}
            disabled={!canDelete}
            title={canDelete ? t(language, 'deleteComponent') : t(language, 'rootCannotDelete')}
          >
            {t(language, 'delete')}
          </button>
        </div>
      </div>
      <div className="field">
        <label>{t(language, 'id')}</label>
        <input value={node.id} onChange={(e) => onUpdate({ id: e.target.value })} />
      </div>
      <div className="field">
        <label>{t(language, 'name')}</label>
        <input value={node.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>{t(language, 'type')}</label>
        <TypeSelect
          language={language}
          value={node.type}
          onChange={(nextType) => onUpdate({
            type: nextType,
            children: isContainerType(nextType) ? (node.children ?? []) : [],
            layout: isContainerType(nextType) ? defaultLayoutForType(nextType) : undefined,
          })}
        />
      </div>
      <div className="field">
        <label>{t(language, 'role')}</label>
        <textarea
          value={node.role}
          onChange={(e) => onUpdate({ role: e.target.value })}
          style={{ minHeight: 60 }}
        />
      </div>
      {node.type === 'app_shell' && (
        <div className="layout-fixed-note">
          <strong>{t(language, 'layoutFixed')}</strong>
          <p>{t(language, 'layoutAppShellHelp')}</p>
        </div>
      )}
      {isContainerType(node.type) && node.type !== 'app_shell' && (
        <LayoutControls
          layout={node.layout}
          language={language}
          onChange={(layout) => onUpdate({ layout })}
        />
      )}
      <JsonField
        label={t(language, 'layoutJson')}
        value={node.layout ?? null}
        onChange={(v) => onUpdate({ layout: v as UINode['layout'] })}
      />
      <JsonField
        label={t(language, 'contentJson')}
        value={node.content ?? null}
        onChange={(v) => onUpdate({ content: v as UINode['content'] })}
      />
    </aside>
  );
}

function LayoutControls({
  layout,
  language,
  onChange,
}: {
  layout: Layout | undefined;
  language: Language;
  onChange: (layout: Layout) => void;
}) {
  const mode = layout?.display === 'grid'
    ? 'grid'
    : layout?.direction === 'row' || layout?.direction === 'row-reverse'
      ? 'row'
      : 'column';

  function update(patch: Partial<Layout>) {
    onChange({ ...layout, ...patch });
  }

  function setMode(nextMode: 'column' | 'row' | 'grid') {
    if (nextMode === 'grid') {
      update({
        display: 'grid',
        direction: undefined,
        grid: layout?.grid ?? { columns: 2 },
      });
      return;
    }
    update({
      display: 'flex',
      direction: nextMode,
      grid: undefined,
    });
  }

  const gapX = layout?.gap?.x ?? 12;
  const gapY = layout?.gap?.y ?? 12;

  return (
    <fieldset className="layout-controls">
      <legend>{t(language, 'layoutControls')}</legend>
      <div className="layout-mode-buttons">
        <button type="button" className={mode === 'column' ? 'active' : ''} onClick={() => setMode('column')}>
          {t(language, 'layoutVertical')}
        </button>
        <button type="button" className={mode === 'row' ? 'active' : ''} onClick={() => setMode('row')}>
          {t(language, 'layoutHorizontal')}
        </button>
        <button type="button" className={mode === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}>
          {t(language, 'layoutGrid')}
        </button>
      </div>

      <div className="layout-control-grid">
        <label>
          <span>{t(language, 'layoutAlign')}</span>
          <select
            value={layout?.align ?? 'stretch'}
            onChange={(e) => update({ align: e.target.value as NonNullable<Layout['align']> })}
          >
            <option value="start">{t(language, 'layoutStart')}</option>
            <option value="center">{t(language, 'layoutCenter')}</option>
            <option value="end">{t(language, 'layoutEnd')}</option>
            <option value="stretch">{t(language, 'layoutStretch')}</option>
            <option value="baseline">{t(language, 'layoutBaseline')}</option>
          </select>
        </label>
        <label>
          <span>{t(language, 'layoutJustify')}</span>
          <select
            value={layout?.justify ?? 'start'}
            onChange={(e) => update({ justify: e.target.value as NonNullable<Layout['justify']> })}
          >
            <option value="start">{t(language, 'layoutStart')}</option>
            <option value="center">{t(language, 'layoutCenter')}</option>
            <option value="end">{t(language, 'layoutEnd')}</option>
            <option value="space-between">{t(language, 'layoutSpaceBetween')}</option>
            <option value="space-around">{t(language, 'layoutSpaceAround')}</option>
            <option value="space-evenly">{t(language, 'layoutSpaceEvenly')}</option>
          </select>
        </label>
        <label>
          <span>{t(language, 'layoutHorizontalGap')}</span>
          <input
            type="number"
            min="0"
            max="128"
            value={gapX}
            onChange={(e) => update({ gap: { ...layout?.gap, x: Math.max(0, Number(e.target.value)) } })}
          />
        </label>
        <label>
          <span>{t(language, 'layoutVerticalGap')}</span>
          <input
            type="number"
            min="0"
            max="128"
            value={gapY}
            onChange={(e) => update({ gap: { ...layout?.gap, y: Math.max(0, Number(e.target.value)) } })}
          />
        </label>
        {mode === 'grid' && (
          <label>
            <span>{t(language, 'layoutColumns')}</span>
            <input
              type="number"
              min="1"
              max="24"
              value={layout?.grid?.columns ?? 2}
              onChange={(e) => update({
                grid: {
                  ...layout?.grid,
                  columns: Math.min(24, Math.max(1, Number(e.target.value))),
                },
              })}
            />
          </label>
        )}
        {mode !== 'grid' && (
          <label className="layout-checkbox">
            <input
              type="checkbox"
              checked={layout?.wrap ?? false}
              onChange={(e) => update({ wrap: e.target.checked })}
            />
            <span>{t(language, 'layoutWrap')}</span>
          </label>
        )}
      </div>
      <p>{t(language, 'layoutHelp')}</p>
    </fieldset>
  );
}

function TypeSelect({ language, value, onChange }: { language: Language; value: ComponentType; onChange: (t: ComponentType) => void }) {
  const categories = getCategories();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ComponentType)}
      style={{
        width: '100%',
        background: 'var(--bg)',
        color: 'var(--fg)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        padding: '4px 6px',
        fontFamily: 'inherit',
        fontSize: 12,
      }}
    >
      {categories.map((cat) => (
        <optgroup key={cat.id} label={categoryLabel(language, cat.id, cat.name)}>
          {cat.types.map((typeMeta) => (
            <option key={typeMeta.name} value={typeMeta.name}>
              {language === 'zh-Hant'
                ? componentLabel(language, typeMeta.name, typeMeta.displayName)
                : `${componentLabel(language, typeMeta.name, typeMeta.displayName)} (${typeMeta.name})`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => (value == null ? '' : JSON.stringify(value, null, 2)));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setText(value == null ? '' : JSON.stringify(value, null, 2));
    setErr(null);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setText(next);
    if (next.trim() === '') {
      setErr(null);
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(next);
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={text} onChange={handleChange} spellCheck={false} />
      {err && <div style={{ color: 'var(--danger)', fontSize: 10, marginTop: 4 }}>{err}</div>}
    </div>
  );
}
