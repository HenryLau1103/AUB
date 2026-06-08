import { getCategories } from '../lib/registry';
import {
  categoryDescription,
  categoryLabel,
  componentDescription,
  componentLabel,
  t,
  type Language,
} from '../lib/i18n';
import type { ComponentType } from '../types';

interface Props {
  language: Language;
  onAdd: (type: ComponentType) => void;
  draggingType: ComponentType | null;
  onDraggingTypeChange: (type: ComponentType | null) => void;
}

export function Palette({ language, onAdd, draggingType, onDraggingTypeChange }: Props) {
  const categories = getCategories();

  function handleDragStart(e: React.DragEvent, type: ComponentType) {
    e.dataTransfer.setData('application/aub-component-type', type);
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    onDraggingTypeChange(type);
  }

  return (
    <aside className="panel">
      <h2>{t(language, 'componentPalette')}</h2>
      <p className="palette-hint">{t(language, 'paletteHint')}</p>
      {categories.map((cat) => (
        <div key={cat.id} className="palette-category">
          <h3
            style={{ borderLeftColor: categoryColor(cat.id) }}
            title={categoryDescription(language, cat.id, cat.description)}
          >
            {categoryLabel(language, cat.id, cat.name)}
          </h3>
          {cat.types.map((typeMeta) => (
            <div
              key={typeMeta.name}
              className={`palette-item${draggingType === typeMeta.name ? ' dragging' : ''}`}
              draggable
              data-component-type={typeMeta.name}
              onPointerDown={(e) => {
                if (e.button === 0) onDraggingTypeChange(typeMeta.name);
              }}
              onPointerCancel={() => onDraggingTypeChange(null)}
              onMouseDown={(e) => {
                if (e.button === 0) onDraggingTypeChange(typeMeta.name);
              }}
              onTouchStart={() => onDraggingTypeChange(typeMeta.name)}
              onTouchCancel={() => onDraggingTypeChange(null)}
              onDragStart={(e) => handleDragStart(e, typeMeta.name)}
              onClick={() => onAdd(typeMeta.name)}
              title={componentDescription(language, typeMeta.name, typeMeta.description)}
              style={{ borderLeftColor: categoryColor(cat.id) }}
            >
              <span>{componentLabel(language, typeMeta.name, typeMeta.displayName)}</span>
              <span className="kind">{typeMeta.isContainer ? t(language, 'kindContainer') : t(language, 'kindLeaf')}</span>
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
