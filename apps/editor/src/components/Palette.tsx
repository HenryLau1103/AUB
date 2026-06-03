import { getCategories } from '../lib/registry';
import type { ComponentType } from '../types';

interface Props {
  onAdd: (type: ComponentType) => void;
}

export function Palette({ onAdd }: Props) {
  const categories = getCategories();
  return (
    <aside className="panel">
      <h2>Component Palette</h2>
      {categories.map((cat) => (
        <div key={cat.id} className="palette-category">
          <h3>{cat.name}</h3>
          {cat.types.map((t) => (
            <div
              key={t.name}
              className="palette-item"
              onClick={() => onAdd(t.name)}
              title={t.description}
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
