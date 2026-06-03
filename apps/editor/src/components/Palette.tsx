import { getCategories } from '../lib/registry';
import type { ComponentType } from '../types';

interface Props {
  onAdd: (type: ComponentType) => void;
}

export function Palette({ onAdd }: Props) {
  const categories = getCategories();

  function handleDragStart(e: React.DragEvent, type: ComponentType) {
    e.dataTransfer.setData('application/aub-component-type', type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="panel">
      <h2>Component Palette</h2>
      <p className="palette-hint">點擊新增到 root，拖曳到畫布指定位置</p>
      {categories.map((cat) => (
        <div key={cat.id} className="palette-category">
          <h3 style={{ borderLeftColor: categoryColor(cat.id) }}>{cat.name}</h3>
          {cat.types.map((t) => (
            <div
              key={t.name}
              className="palette-item"
              draggable
              onDragStart={(e) => handleDragStart(e, t.name)}
              onClick={() => onAdd(t.name)}
              title={t.description}
              style={{ borderLeftColor: categoryColor(cat.id) }}
            >
              <span>{t.displayName}</span>
              <span className="kind">{t.isContainer ? 'C' : 'L'}</span>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

function categoryColor(id: string): string {
  const m: Record<string, string> = {
    layout: '#3b82f6',
    data: '#10b981',
    form: '#f59e0b',
    action: '#ef4444',
    feedback: '#eab308',
    navigation: '#a855f7',
  };
  return m[id] ?? '#64748b';
}
