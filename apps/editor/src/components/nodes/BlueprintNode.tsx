import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { ComponentType, Content, Layout, UINode } from '../../types';

export interface BlueprintNodeData {
  name: string;
  type: ComponentType;
  role: string;
  content?: Content;
  childrenCount?: number;
  layout?: Layout;
  categoryColor: string;
  isContainer: boolean;
  [key: string]: unknown;
}

const CATEGORY_COLORS: Record<string, string> = {
  layout: '#3b82f6',
  data: '#10b981',
  form: '#f59e0b',
  action: '#ef4444',
  feedback: '#eab308',
  navigation: '#a855f7',
};

function getCategoryColor(type: ComponentType): string {
  const layout = new Set(['app_shell','page','section','header','sidebar','top_bar','bottom_nav','stack','grid','split_pane','scroll_area']);
  const data = new Set(['metric_card','data_table','list','detail_panel','chart_placeholder','timeline','activity_feed']);
  const form = new Set(['form','field_group','text_input','select','checkbox','radio_group','toggle','slider','date_picker','file_upload']);
  const action = new Set(['button','icon_button','button_group','menu','toolbar','command_palette']);
  const feedback = new Set(['modal','drawer','toast','alert','empty_state','loading_state','error_state']);
  if (layout.has(type)) return '#3b82f6';
  if (data.has(type)) return '#10b981';
  if (form.has(type)) return '#f59e0b';
  if (action.has(type)) return '#ef4444';
  if (feedback.has(type)) return '#eab308';
  return '#a855f7';
}

const W = 240;
const HEADER_H = 22;
const BODY_H = 100;
const FOOTER_H = 14;
const NODE_H = HEADER_H + BODY_H + FOOTER_H;

function BlueprintNodeImpl({ data, selected }: NodeProps) {
  const d = data as unknown as BlueprintNodeData;
  const color = d.categoryColor || getCategoryColor(d.type);
  const container = d.isContainer;
  const childCount = d.childrenCount ?? 0;

  return (
    <div
      style={{
        width: W,
        height: NODE_H,
        background: '#0f172a',
        border: `2px solid ${selected ? '#38bdf8' : color}`,
        borderRadius: 6,
        boxShadow: selected ? '0 0 0 2px rgba(56,189,248,0.3)' : '0 2px 8px rgba(0,0,0,0.4)',
        fontSize: 11,
        color: '#e2e8f0',
        fontFamily: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, width: 8, height: 8, border: '2px solid #0f172a' }}
      />

      <HeaderStrip type={d.type} color={color} container={container} />

      <div
        style={{
          flex: 1,
          padding: '6px 8px',
          background: '#1e293b',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {renderPreview(d, color)}
      </div>

      <FooterBar type={d.type} childCount={childCount} container={container} />

      {container && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: color, width: 8, height: 8, border: '2px solid #0f172a' }}
        />
      )}
    </div>
  );
}

export const BlueprintNode = memo(BlueprintNodeImpl);

function HeaderStrip({ type, color, container }: { type: string; color: string; container: boolean }) {
  return (
    <div
      style={{
        height: HEADER_H,
        background: color,
        color: '#0f172a',
        padding: '0 8px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span>{type}</span>
      {container && <span style={{ fontSize: 9, opacity: 0.75 }}>▾ container</span>}
    </div>
  );
}

function FooterBar({ type, childCount, container }: { type: string; childCount: number; container: boolean }) {
  return (
    <div
      style={{
        height: FOOTER_H,
        background: '#0f172a',
        borderTop: '1px solid #334155',
        padding: '0 8px',
        fontSize: 9,
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {type}
      </span>
      {container && childCount > 0 && (
        <span style={{ color: '#64748b' }}>{childCount} child{childCount === 1 ? '' : 'ren'}</span>
      )}
    </div>
  );
}

function renderPreview(d: BlueprintNodeData, color: string): JSX.Element {
  const renderer = RENDERERS[d.type] ?? renderGeneric;
  return renderer(d, color);
}

const RENDERERS: Partial<Record<ComponentType, (d: BlueprintNodeData, color: string) => JSX.Element>> = {
  app_shell: (d) => (
    <ZonePreview
      label="app shell"
      zones={[
        { side: 'left', w: 18, label: d.content?.label ?? 'sidebar' },
        { side: 'right-top', w: 82, h: 18, label: 'top bar' },
        { side: 'right-main', w: 82, h: 82, label: 'main' },
      ]}
    />
  ),
  page: () => (
    <ZonePreview
      zones={[
        { side: 'top', w: 100, h: 12, label: 'header' },
        { side: 'mid', w: 100, h: 76, label: 'scrollable content' },
        { side: 'bot', w: 100, h: 12, label: 'footer' },
      ]}
    />
  ),
  section: (d) => (
    <ZonePreview
      label={d.content?.text ?? d.name}
      zones={[{ side: 'full', w: 100, h: 100, label: 'section content' }]}
    />
  ),
  header: () => (
    <ZonePreview
      zones={[
        { side: 'left', w: 30, label: 'logo' },
        { side: 'mid', w: 50, label: 'title' },
        { side: 'right', w: 20, label: 'user' },
      ]}
    />
  ),
  top_bar: () => (
    <ZonePreview
      zones={[
        { side: 'left', w: 30, label: 'logo' },
        { side: 'mid', w: 50, label: 'search' },
        { side: 'right', w: 20, label: 'actions' },
      ]}
    />
  ),
  sidebar: (d) => (
    <ZonePreview
      label={d.content?.label ?? 'sidebar'}
      zones={[
        { side: 'top', w: 100, h: 14, label: 'nav item 1' },
        { side: 'mid', w: 100, h: 14, label: 'nav item 2' },
        { side: 'mid2', w: 100, h: 14, label: 'nav item 3' },
        { side: 'bot', w: 100, h: 58, label: '' },
      ]}
    />
  ),
  bottom_nav: () => (
    <ZonePreview
      zones={[
        { side: 'left', w: 25, label: 'tab 1' },
        { side: 'mid-l', w: 25, label: 'tab 2' },
        { side: 'mid-r', w: 25, label: 'tab 3' },
        { side: 'right', w: 25, label: 'tab 4' },
      ]}
    />
  ),
  stack: (d) => (
    <ZonePreview
      label={d.layout?.direction === 'row' ? 'stack (row)' : 'stack (column)'}
      zones={d.layout?.direction === 'row'
        ? [
            { side: 'left', w: 33, label: 'child 1' },
            { side: 'mid', w: 33, label: 'child 2' },
            { side: 'right', w: 34, label: 'child 3' },
          ]
        : [
            { side: 'top', w: 100, h: 33, label: 'child 1' },
            { side: 'mid', w: 100, h: 33, label: 'child 2' },
            { side: 'bot', w: 100, h: 34, label: 'child 3' },
          ]}
    />
  ),
  grid: (d) => {
    const cols = d.layout?.grid?.columns ?? 3;
    return (
      <ZonePreview
        label={`grid ${cols}-col`}
        zones={Array.from({ length: cols }, (_, i) => ({
          side: `c${i}`,
          w: 100 / cols,
          label: `cell ${i + 1}`,
        }))}
      />
    );
  },
  split_pane: () => (
    <ZonePreview
      zones={[
        { side: 'left', w: 50, label: 'master' },
        { side: 'right', w: 50, label: 'detail' },
      ]}
    />
  ),
  scroll_area: (d) => (
    <ZonePreview
      label={d.name}
      zones={[
        { side: 'top', w: 100, h: 100, label: '↓ scroll ↓' },
      ]}
    />
  ),

  metric_card: (d) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {d.content?.label ?? d.name}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.1, margin: '4px 0' }}>
        {d.content?.data_binding ? formatBinding(d.content.data_binding) : '$0'}
      </div>
      <div style={{ fontSize: 9, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>▲</span>
        <span>+0% vs last</span>
      </div>
    </div>
  ),
  data_table: (d) => {
    const cols = d.content?.columns ?? [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
        <div style={{ display: 'flex', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
          {d.content?.label ?? d.name}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols.length || 1}, 1fr)`,
            gap: 1,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 2,
            overflow: 'hidden',
            flex: 1,
          }}
        >
          {(cols.length ? cols : [{ id: 'col', header: 'col' }]).map((c) => (
            <div
              key={c.id}
              style={{
                background: '#1e293b',
                padding: '3px 6px',
                fontSize: 9,
                color: '#cbd5e1',
                borderRight: '1px solid #334155',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {c.header}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length || 1}, 1fr)`, gap: 1 }}>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                padding: '3px 6px',
                fontSize: 9,
                color: '#64748b',
              }}
            >
              —
            </div>
          ))}
        </div>
      </div>
    );
  },
  list: (d) => {
    const items = d.content?.items ?? [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
          {d.content?.label ?? d.name}
        </div>
        {(items.length ? items : [{ id: '1', label: 'item 1' }, { id: '2', label: 'item 2' }, { id: '3', label: 'item 3' }]).slice(0, 4).map((it) => (
          <div
            key={it.id}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 2,
              padding: '3px 6px',
              fontSize: 9,
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label ?? it.id}
            </span>
          </div>
        ))}
      </div>
    );
  },
  detail_panel: (d) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>detail</div>
      <div
        style={{
          flex: 1,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 2,
          padding: 6,
          fontSize: 9,
          color: '#64748b',
        }}
      >
        {d.content?.label ?? d.name}
      </div>
    </div>
  ),
  chart_placeholder: () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8' }}>chart</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, padding: '4px 0' }}>
        {[30, 60, 45, 80, 55, 90, 70, 95, 60, 75].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              background: '#10b981',
              opacity: 0.7,
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  ),
  timeline: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>timeline</div>
      {['event 1', 'event 2', 'event 3'].map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
          <div style={{ height: 1, background: '#334155', flex: 1 }} />
          <div style={{ fontSize: 8, color: '#cbd5e1' }}>{e}</div>
        </div>
      ))}
    </div>
  ),
  activity_feed: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>activity</div>
      {['user did x', 'user did y', 'user did z'].map((e, i) => (
        <div
          key={i}
          style={{
            fontSize: 9,
            color: '#cbd5e1',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 2,
            padding: '2px 6px',
          }}
        >
          {e}
        </div>
      ))}
    </div>
  ),

  form: (d) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
        {d.content?.label ?? 'form'}
      </div>
      <MockInput placeholder="text input" />
      <MockInput placeholder="text input" />
      <MockButton label="Submit" />
    </div>
  ),
  field_group: (d) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
        {d.content?.label ?? 'group'}
      </div>
      <MockInput placeholder="field 1" />
      <MockInput placeholder="field 2" />
    </div>
  ),
  text_input: (d) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
        {d.content?.label ?? 'input'}
      </div>
      <MockInput
        placeholder={d.content?.placeholder ?? 'type here…'}
        value={d.content?.text}
      />
    </div>
  ),
  select: (d) => <MockSelect d={d} />,
  checkbox: (d) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%' }}>
      <div style={{ width: 14, height: 14, border: '2px solid #64748b', borderRadius: 2, background: '#0f172a' }} />
      <span style={{ fontSize: 11, color: '#cbd5e1' }}>{d.content?.label ?? d.name}</span>
    </div>
  ),
  radio_group: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>radio</div>
      {['option A', 'option B', 'option C'].map((o, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: `2px solid ${i === 0 ? '#f59e0b' : '#64748b'}`,
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i === 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />}
          </div>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>{o}</span>
        </div>
      ))}
    </div>
  ),
  toggle: (d) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
      <span style={{ fontSize: 11, color: '#cbd5e1' }}>{d.content?.label ?? d.name}</span>
      <div
        style={{
          width: 32,
          height: 16,
          borderRadius: 8,
          background: '#f59e0b',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 2,
            top: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#0f172a',
          }}
        />
      </div>
    </div>
  ),
  slider: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>value</span>
        <span style={{ fontSize: 9, color: '#cbd5e1' }}>50</span>
      </div>
      <div style={{ position: 'relative', height: 4, background: '#0f172a', borderRadius: 2, marginTop: 4 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: '#f59e0b', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 'calc(50% - 6px)', top: -4, width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0' }} />
      </div>
    </div>
  ),
  date_picker: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
      <MockInput placeholder="YYYY-MM-DD" />
      <span style={{ fontSize: 14 }}>📅</span>
    </div>
  ),
  file_upload: () => (
    <div
      style={{
        flex: 1,
        border: '2px dashed #475569',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        color: '#94a3b8',
        fontSize: 10,
      }}
    >
      <span style={{ fontSize: 16 }}>📁</span>
      <span>Drop file or click</span>
    </div>
  ),

  button: (d) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div
        style={{
          background: '#ef4444',
          color: '#0f172a',
          padding: '6px 16px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {d.content?.text ?? d.content?.label ?? d.name}
      </div>
    </div>
  ),
  icon_button: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div
        style={{
          width: 32,
          height: 32,
          background: '#ef4444',
          color: '#0f172a',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ⚙
      </div>
    </div>
  ),
  button_group: () => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ background: '#ef4444', color: '#0f172a', padding: '4px 12px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>Yes</div>
      <div style={{ background: '#334155', color: '#e2e8f0', padding: '4px 12px', borderRadius: 3, fontSize: 10 }}>No</div>
      <div style={{ background: '#334155', color: '#e2e8f0', padding: '4px 12px', borderRadius: 3, fontSize: 10 }}>Cancel</div>
    </div>
  ),
  menu: (d) => {
    const items = d.content?.items ?? [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
          {d.content?.label ?? d.name}
        </div>
        {(items.length ? items : [{ id: '1', label: 'item 1' }, { id: '2', label: 'item 2' }]).slice(0, 4).map((it) => (
          <div
            key={it.id}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 2,
              padding: '3px 6px',
              fontSize: 10,
              color: '#cbd5e1',
            }}
          >
            {it.label ?? it.id}
          </div>
        ))}
      </div>
    );
  },
  toolbar: () => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {['B', 'I', 'U', '🔗', '🖼'].map((b, i) => (
        <div
          key={i}
          style={{
            width: 24,
            height: 24,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: '#cbd5e1',
            fontWeight: i < 3 ? 700 : 400,
          }}
        >
          {b}
        </div>
      ))}
    </div>
  ),
  command_palette: () => (
    <div
      style={{
        flex: 1,
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        fontSize: 11,
        color: '#94a3b8',
        gap: 6,
      }}
    >
      <span style={{ fontFamily: 'monospace', background: '#334155', padding: '1px 4px', borderRadius: 2, color: '#e2e8f0' }}>⌘K</span>
      <span>Type a command or search…</span>
    </div>
  ),

  modal: (d) => (
    <div style={{ position: 'relative', height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '15%',
          right: '15%',
          bottom: '15%',
          background: '#1e293b',
          border: '1px solid #475569',
          borderRadius: 4,
          padding: 6,
          fontSize: 10,
          color: '#cbd5e1',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{d.content?.label ?? 'Modal'}</div>
        <div style={{ flex: 1, background: '#0f172a', borderRadius: 2, padding: 4, fontSize: 9, color: '#94a3b8' }}>
          body content
        </div>
      </div>
    </div>
  ),
  drawer: (d) => (
    <div style={{ position: 'relative', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 2 }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '60%',
          background: '#1e293b',
          borderLeft: '1px solid #475569',
          padding: 6,
          fontSize: 10,
          color: '#cbd5e1',
        }}
      >
        <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{d.content?.label ?? 'Drawer'}</div>
        <div style={{ fontSize: 9, color: '#94a3b8' }}>detail content</div>
      </div>
    </div>
  ),
  toast: (d) => (
    <div
      style={{
        flex: 1,
        background: '#eab308',
        color: '#0f172a',
        borderRadius: 4,
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <span>✓</span>
      <span>{d.content?.text ?? d.name}</span>
    </div>
  ),
  alert: (d) => (
    <div
      style={{
        flex: 1,
        background: 'rgba(234, 179, 8, 0.15)',
        border: '1px solid #eab308',
        borderRadius: 3,
        padding: '6px 10px',
        fontSize: 10,
        color: '#fef3c7',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 13 }}>⚠</span>
      <span>{d.content?.text ?? d.name}</span>
    </div>
  ),
  empty_state: (d) => (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: '#64748b',
      }}
    >
      <span style={{ fontSize: 22, opacity: 0.4 }}>∅</span>
      <span style={{ fontSize: 10 }}>{d.content?.text ?? d.name}</span>
    </div>
  ),
  loading_state: () => (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: '#94a3b8',
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          border: '2px solid #eab308',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: 10 }}>Loading…</span>
    </div>
  ),
  error_state: (d) => (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        color: '#fca5a5',
      }}
    >
      <span style={{ fontSize: 18 }}>✕</span>
      <span style={{ fontSize: 10 }}>{d.content?.text ?? d.name}</span>
    </div>
  ),

  tabs: () => (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', height: '100%', borderBottom: '1px solid #334155' }}>
      {['Overview', 'Details', 'Settings'].map((t, i) => (
        <div
          key={t}
          style={{
            padding: '4px 12px',
            background: i === 0 ? '#0f172a' : 'transparent',
            borderTop: i === 0 ? '2px solid #a855f7' : '2px solid transparent',
            color: i === 0 ? '#e2e8f0' : '#94a3b8',
            fontSize: 10,
            fontWeight: i === 0 ? 600 : 400,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  ),
  breadcrumb: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%', color: '#94a3b8', fontSize: 10 }}>
      <span>Home</span>
      <span style={{ color: '#475569' }}>›</span>
      <span>Section</span>
      <span style={{ color: '#475569' }}>›</span>
      <span style={{ color: '#e2e8f0' }}>Current</span>
    </div>
  ),
  pagination: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
      {['‹', '1', '2', '3', '4', '›'].map((p, i) => (
        <div
          key={i}
          style={{
            minWidth: 22,
            height: 22,
            background: i === 2 ? '#a855f7' : '#0f172a',
            color: i === 2 ? '#0f172a' : '#cbd5e1',
            border: '1px solid #334155',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: i === 2 ? 600 : 400,
            padding: '0 4px',
          }}
        >
          {p}
        </div>
      ))}
    </div>
  ),
  stepper: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
      {[1, 2, 3, 4].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: i < 2 ? '#a855f7' : '#0f172a',
              color: i < 2 ? '#0f172a' : '#64748b',
              border: i === 2 ? '2px solid #a855f7' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {i < 2 ? '✓' : s}
          </div>
          {i < 3 && <div style={{ width: 16, height: 1, background: i < 2 ? '#a855f7' : '#334155' }} />}
        </div>
      ))}
    </div>
  ),
  nav_item: (d) => (
    <div
      style={{
        flex: 1,
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 3,
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: '#cbd5e1',
      }}
    >
      <span style={{ color: '#64748b' }}>▸</span>
      <span>{d.content?.label ?? d.name}</span>
    </div>
  ),
};

function renderGeneric(d: BlueprintNodeData, _color: string): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>{d.type}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 10 }}>
        (no preview)
      </div>
    </div>
  );
}

function MockInput({ placeholder, value }: { placeholder?: string; value?: string }) {
  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #475569',
        borderRadius: 3,
        padding: '5px 8px',
        fontSize: 11,
        color: value ? '#e2e8f0' : '#64748b',
        fontStyle: value ? 'normal' : 'italic',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {value || placeholder || 'text'}
    </div>
  );
}

function MockButton({ label }: { label: string }) {
  return (
    <div
      style={{
        background: '#334155',
        color: '#e2e8f0',
        padding: '4px 12px',
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 500,
        textAlign: 'center',
        alignSelf: 'flex-start',
      }}
    >
      {label}
    </div>
  );
}

function MockSelect({ d }: { d: BlueprintNodeData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>
        {d.content?.label ?? 'select'}
      </div>
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #475569',
          borderRadius: 3,
          padding: '5px 8px',
          fontSize: 11,
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Choose…</span>
        <span style={{ color: '#64748b' }}>▾</span>
      </div>
    </div>
  );
}

interface ZoneSpec {
  side: string;
  w?: number;
  h?: number;
  label: string;
}
function ZonePreview({ label, zones }: { label?: string; zones: ZoneSpec[] }) {
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {label && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            fontSize: 9,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            zIndex: 1,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 2,
          padding: '10px 2px 2px 2px',
        }}
      >
        {zones.map((z) => (
          <div
            key={z.side}
            style={{
              flex: z.w ?? 1,
              height: z.h ? `${z.h}%` : '100%',
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px dashed #475569',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: '#94a3b8',
              textAlign: 'center',
              padding: '2px 4px',
            }}
          >
            {z.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBinding(b: string): string {
  const parts = b.split('.');
  const last = parts[parts.length - 1] ?? b;
  return last.replace(/_/g, ' ');
}
