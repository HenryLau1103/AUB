import { useState, useEffect } from 'react';
import type { Blueprint, UINode, ComponentType } from '../types';
import { getTypeMeta, isContainerType } from '../lib/registry';
import { getCategories } from '../lib/registry';

interface Props {
  node: UINode | null;
  onUpdate: (patch: Partial<UINode>) => void;
  onDelete: () => void;
}

export function PropertiesPanel({ node, onUpdate, onDelete }: Props) {
  if (!node) {
    return (
      <aside className="panel">
        <h2>Properties</h2>
        <p className="empty">Select a node to edit.</p>
      </aside>
    );
  }
  return (
    <aside className="panel properties">
      <h2>Properties</h2>
      <div className="field">
        <label>id</label>
        <input value={node.id} onChange={(e) => onUpdate({ id: e.target.value })} />
      </div>
      <div className="field">
        <label>name</label>
        <input value={node.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>type</label>
        <TypeSelect value={node.type} onChange={(t) => onUpdate({ type: t, children: isContainerType(t) ? (node.children ?? []) : [] })} />
      </div>
      <div className="field">
        <label>role</label>
        <textarea
          value={node.role}
          onChange={(e) => onUpdate({ role: e.target.value })}
          style={{ minHeight: 60 }}
        />
      </div>
      <JsonField
        label="layout"
        value={node.layout ?? null}
        onChange={(v) => onUpdate({ layout: v as UINode['layout'] })}
      />
      <JsonField
        label="content"
        value={node.content ?? null}
        onChange={(v) => onUpdate({ content: v as UINode['content'] })}
      />
      <div style={{ marginTop: 16 }}>
        <button onClick={onDelete} style={{ color: 'var(--danger)' }}>
          Delete node
        </button>
      </div>
    </aside>
  );
}

function TypeSelect({ value, onChange }: { value: ComponentType; onChange: (t: ComponentType) => void }) {
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
        <optgroup key={cat.id} label={cat.name}>
          {cat.types.map((t) => (
            <option key={t.name} value={t.name}>
              {t.displayName} ({t.name})
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
      <label>{label} (JSON)</label>
      <textarea value={text} onChange={handleChange} spellCheck={false} />
      {err && <div style={{ color: 'var(--danger)', fontSize: 10, marginTop: 4 }}>{err}</div>}
    </div>
  );
}
