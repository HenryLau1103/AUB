import { useState } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { componentLabel, stateLabel, t, viewportLabel, type Language } from '../lib/i18n';
import { isContainerType } from '../lib/registry';
import { defaultLayoutForType } from '../lib/store';
import type { Blueprint, ComponentType, Layout, Placement, ResolvedComponentType, UINode, ViewportId } from '../types';
import { Tooltip } from './Tooltip';

interface Props {
  blueprint: Blueprint | null;
  node: UINode | null;
  selectedCount: number;
  language: Language;
  onUpdate: (patch: Partial<UINode>) => void;
  onUpdatePlacement: (viewportId: ViewportId, patch: Partial<Placement>) => void;
  onDelete: () => void;
  onSelectParent: () => void;
  onReparent: (parentId: string) => void;
  onCollapse: () => void;
}

type PropertyTab = 'content' | 'layout' | 'appearance' | 'interaction';

export function PropertiesPanel({
  blueprint,
  node,
  selectedCount,
  language,
  onUpdate,
  onUpdatePlacement,
  onDelete,
  onSelectParent,
  onReparent,
  onCollapse,
}: Props) {
  const [tab, setTab] = useState<PropertyTab>('content');
  const [viewportId, setViewportId] = useState<ViewportId>('desktop');
  if (!node) {
    return (
      <aside className="panel properties">
        <PropertyHeader language={language} onCollapse={onCollapse} />
        <p className="empty">{selectedCount > 1 ? t(language, 'multipleSelected', { count: selectedCount }) : t(language, 'selectNode')}</p>
      </aside>
    );
  }

  const canDelete = node.parent_id !== null;
  const placement = node.placements?.[viewportId]
    ?? node.placements?.desktop
    ?? node.placements?.tablet
    ?? node.placements?.mobile
    ?? node.placements?.wide;
  const descendantIds = blueprint ? collectDescendantIds(blueprint, node.id) : new Set<string>();
  const containers = blueprint?.nodes.filter((candidate) => (
    isContainerType(candidate.type) &&
    candidate.id !== node.id &&
    !descendantIds.has(candidate.id)
  )) ?? [];

  return (
    <aside className="panel properties">
      <PropertyHeader language={language} onCollapse={onCollapse} />
      <div className="selected-summary">
        <div>
          <strong>{node.name}</strong>
          <span>{componentLabel(language, node.type)}</span>
        </div>
        <Tooltip label={t(language, 'deleteComponent')} align="end">
          <button
            type="button"
            className="danger-icon"
            aria-label={t(language, 'deleteComponent')}
            disabled={!canDelete}
            onClick={onDelete}
          >
            <Trash2 />
          </button>
        </Tooltip>
      </div>
      <div className="property-tabs">
        {(['content', 'layout', 'appearance', 'interaction'] as PropertyTab[]).map((id) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{t(language, `propertyTab.${id}` as Parameters<typeof t>[1])}</button>
        ))}
      </div>

      {tab === 'content' && (
        <div className="property-section">
          <Field label={t(language, 'name')}><input value={node.name} onChange={(event) => onUpdate({ name: event.target.value })} /></Field>
      <Field label={t(language, 'type')}>
        <TypeSelect
          language={language}
          value={node.type}
          hasChildren={(node.children?.length ?? 0) > 0}
              onChange={(type) => onUpdate({
                type,
                children: isContainerType(type) ? node.children ?? [] : [],
                layout: isContainerType(type) ? defaultLayoutForType(type) : undefined,
              })}
            />
          </Field>
          <Field label={t(language, 'role')}><textarea value={node.role} onChange={(event) => onUpdate({ role: event.target.value })} /></Field>
          <ContentField label={t(language, 'contentText')} value={node.content?.text} onChange={(text) => onUpdate({ content: { ...node.content, text } })} />
          <ContentField label={t(language, 'contentLabel')} value={node.content?.label} onChange={(label) => onUpdate({ content: { ...node.content, label } })} />
          <ContentField label={t(language, 'placeholder')} value={node.content?.placeholder} onChange={(placeholder) => onUpdate({ content: { ...node.content, placeholder } })} />
          {(node.type === 'image' || node.type === 'avatar') && (
            <>
              <ContentField label={t(language, 'sourceUrl')} value={node.content?.src} onChange={(src) => onUpdate({ content: { ...node.content, src } })} />
              <ContentField label={t(language, 'altText')} value={node.content?.alt} onChange={(alt) => onUpdate({ content: { ...node.content, alt } })} />
            </>
          )}
          <details className="advanced-json">
            <summary>{t(language, 'advancedJson')}</summary>
            <JsonField value={node.content ?? null} onChange={(content) => onUpdate({ content: content as UINode['content'] })} />
          </details>
        </div>
      )}

      {tab === 'layout' && (
        <div className="property-section">
          {node.parent_id && <button type="button" className="select-parent-button" onClick={onSelectParent}>{t(language, 'selectParent')}</button>}
          {node.parent_id && (
            <Field label={t(language, 'parentContainer')}>
              <select value={node.parent_id} onChange={(event) => onReparent(event.target.value)}>
                {containers.map((container) => <option key={container.id} value={container.id}>{container.name} · {componentLabel(language, container.type)}</option>)}
              </select>
            </Field>
          )}
          {isContainerType(node.type) && (
            <LayoutControls layout={node.layout} language={language} onChange={(layout) => onUpdate({ layout })} />
          )}
          {placement && (
            <>
              <div className="viewport-property-tabs">
                {(blueprint?.viewports ?? []).map((viewport) => <button key={viewport.id} className={viewportId === viewport.id ? 'active' : ''} onClick={() => setViewportId(viewport.id)}>{viewportLabel(language, viewport.id)}</button>)}
              </div>
              <div className="geometry-grid">
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <Field key={key} label={key.toUpperCase()}>
                    <input type="number" value={Math.round(placement[key])} onChange={(event) => onUpdatePlacement(viewportId, { [key]: Number(event.target.value) })} />
                  </Field>
                ))}
                <Field label={t(language, 'zIndex')}><input type="number" value={placement.z_index ?? 1} onChange={(event) => onUpdatePlacement(viewportId, { z_index: Number(event.target.value) })} /></Field>
              </div>
            </>
          )}
          <details className="advanced-json">
            <summary>{t(language, 'advancedJson')}</summary>
            <JsonField value={node.layout ?? null} onChange={(layout) => onUpdate({ layout: layout as Layout })} />
          </details>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="property-section">
          <TokenSelect label={t(language, 'backgroundToken')} value={node.style?.background} options={blueprint?.design_system?.colors} onChange={(background) => onUpdate({ style: { ...node.style, background } })} />
          <TokenSelect label={t(language, 'foregroundToken')} value={node.style?.foreground} options={blueprint?.design_system?.colors} onChange={(foreground) => onUpdate({ style: { ...node.style, foreground } })} />
          <TokenSelect label={t(language, 'typographyToken')} value={node.style?.typography} options={blueprint?.design_system?.typography} onChange={(typography) => onUpdate({ style: { ...node.style, typography } })} />
          <TokenSelect label={t(language, 'radiusToken')} value={node.style?.radius} options={blueprint?.design_system?.radii} onChange={(radius) => onUpdate({ style: { ...node.style, radius } })} />
          <TokenSelect label={t(language, 'shadowToken')} value={node.style?.shadow} options={blueprint?.design_system?.shadows} onChange={(shadow) => onUpdate({ style: { ...node.style, shadow } })} />
          <ContentField label={t(language, 'variant')} value={node.style?.variant} onChange={(variant) => onUpdate({ style: { ...node.style, variant } })} />
          <Field label={t(language, 'opacity')}><input type="range" min="0" max="1" step="0.05" value={node.style?.opacity ?? 1} onChange={(event) => onUpdate({ style: { ...node.style, opacity: Number(event.target.value) } })} /></Field>
          <details className="advanced-json">
            <summary>{t(language, 'advancedJson')}</summary>
            <JsonField value={node.style ?? null} onChange={(style) => onUpdate({ style: style as UINode['style'] })} />
          </details>
        </div>
      )}

      {tab === 'interaction' && (
        <div className="property-section">
          <ContentField label={t(language, 'actionIntent')} value={node.content?.action} onChange={(action) => onUpdate({ content: { ...node.content, action } })} />
          <Field label={t(language, 'supportedStates')}>
            <div className="state-options">
              {(['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'empty', 'error', 'selected'] as const).map((state) => (
                <label key={state}><input type="checkbox" checked={node.states?.includes(state) ?? false} onChange={(event) => onUpdate({ states: event.target.checked ? [...(node.states ?? []), state] : (node.states ?? []).filter((item) => item !== state) })} />{stateLabel(language, state)}</label>
              ))}
            </div>
          </Field>
          <div className="interaction-list">
            <strong>{t(language, 'declaredInteractions')}</strong>
            {(blueprint?.interactions.filter((interaction) => interaction.source_node_id === node.id) ?? []).map((interaction) => (
              <div key={interaction.id}><span>{interaction.trigger}</span><code>{interaction.action}</code><small>{interaction.result_state}</small></div>
            ))}
            {!blueprint?.interactions.some((interaction) => interaction.source_node_id === node.id) && <p className="empty">{t(language, 'noDeclaredInteractions')}</p>}
          </div>
        </div>
      )}
    </aside>
  );
}

function PropertyHeader({ language, onCollapse }: { language: Language; onCollapse: () => void }) {
  const label = t(language, 'hideProperties');
  return (
    <div className="properties-header">
      <h2>{t(language, 'properties')}</h2>
      <Tooltip label={label} align="end">
        <button type="button" className="icon-button" aria-label={label} title={label} onClick={onCollapse}>
          <ChevronLeft />
        </button>
      </Tooltip>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function ContentField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <Field label={label}><input value={value ?? ''} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function TokenSelect({ label, value, options, onChange }: { label: string; value?: string; options?: Record<string, string>; onChange: (value: string | undefined) => void }) {
  return (
    <Field label={label}>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">—</option>
        {Object.entries(options ?? {}).map(([name, tokenValue]) => <option key={name} value={name}>{name} · {tokenValue}</option>)}
      </select>
    </Field>
  );
}

function TypeSelect({
  language,
  value,
  hasChildren,
  onChange,
}: {
  language: Language;
  value: ResolvedComponentType;
  hasChildren: boolean;
  onChange: (value: ResolvedComponentType) => void;
}) {
  const groups = [
    ['app_shell', 'page', 'section', 'header', 'sidebar', 'top_bar', 'bottom_nav', 'stack', 'grid', 'split_pane', 'scroll_area'],
    ['heading', 'text', 'card', 'image', 'icon', 'avatar', 'badge', 'tag', 'divider', 'link'],
    ['metric_card', 'data_table', 'list', 'detail_panel', 'chart_placeholder', 'timeline', 'activity_feed', 'calendar', 'kanban_board', 'kanban_column'],
    ['form', 'field_group', 'text_input', 'textarea', 'search_input', 'select', 'checkbox', 'radio_group', 'toggle', 'slider', 'date_picker', 'file_upload', 'rich_text_editor'],
    ['button', 'icon_button', 'button_group', 'menu', 'toolbar', 'command_palette'],
    ['modal', 'drawer', 'toast', 'alert', 'empty_state', 'loading_state', 'error_state'],
    ['tabs', 'breadcrumb', 'pagination', 'stepper', 'nav_item'],
  ] as ComponentType[][];
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as ResolvedComponentType)}>
      {groups.flat().map((type) => (
        <option key={type} value={type} disabled={hasChildren && !isContainerType(type)}>
          {componentLabel(language, type)}
        </option>
      ))}
    </select>
  );
}

function LayoutControls({ layout, language, onChange }: { layout?: Layout; language: Language; onChange: (layout: Layout) => void }) {
  const mode = layout?.display === 'grid' ? 'grid' : layout?.direction === 'row' ? 'row' : 'column';
  const update = (patch: Partial<Layout>) => onChange({ ...layout, ...patch, mode: layout?.mode ?? 'auto' });
  return (
    <fieldset className="layout-controls">
      <legend>{t(language, 'layoutControls')}</legend>
      <div className="layout-mode-buttons">
        {(['column', 'row', 'grid'] as const).map((next) => <button key={next} type="button" className={mode === next ? 'active' : ''} onClick={() => update(next === 'grid' ? { display: 'grid', direction: undefined, grid: layout?.grid ?? { columns: 2 } } : { display: 'flex', direction: next, grid: undefined })}>{t(language, next === 'column' ? 'layoutVertical' : next === 'row' ? 'layoutHorizontal' : 'layoutGrid')}</button>)}
      </div>
      <div className="layout-control-grid">
        <Field label={t(language, 'layoutHorizontalGap')}><input type="number" min="0" value={layout?.gap?.x ?? 12} onChange={(event) => update({ gap: { ...layout?.gap, x: Number(event.target.value) } })} /></Field>
        <Field label={t(language, 'layoutVerticalGap')}><input type="number" min="0" value={layout?.gap?.y ?? 12} onChange={(event) => update({ gap: { ...layout?.gap, y: Number(event.target.value) } })} /></Field>
        {mode === 'grid' && <Field label={t(language, 'layoutColumns')}><input type="number" min="1" max="24" value={layout?.grid?.columns ?? 2} onChange={(event) => update({ grid: { ...layout?.grid, columns: Number(event.target.value) } })} /></Field>}
      </div>
    </fieldset>
  );
}

function JsonField({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState('');
  return (
    <>
      <textarea value={text} onChange={(event) => {
        setText(event.target.value);
        try {
          onChange(JSON.parse(event.target.value));
          setError('');
        } catch (nextError) {
          setError((nextError as Error).message);
        }
      }} />
      {error && <small className="json-error">{error}</small>}
    </>
  );
}

function collectDescendantIds(blueprint: Blueprint, rootId: string): Set<string> {
  const descendants = new Set<string>();
  const visit = (id: string) => {
    const current = blueprint.nodes.find((candidate) => candidate.id === id);
    for (const childId of current?.children ?? []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      visit(childId);
    }
  };
  visit(rootId);
  return descendants;
}
