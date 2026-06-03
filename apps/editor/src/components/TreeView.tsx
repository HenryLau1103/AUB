import type { Blueprint, UINode } from '../types';

interface Props {
  blueprint: Blueprint | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TreeView({ blueprint, selectedId, onSelect }: Props) {
  if (!blueprint) {
    return (
      <section className="panel">
        <h2>Tree</h2>
        <p className="empty">Import a JSON file to begin.</p>
      </section>
    );
  }
  const root = blueprint.nodes.find((n) => n.parent_id === null);
  if (!root) {
    return (
      <section className="panel">
        <h2>Tree</h2>
        <p className="empty">No root node. Use the palette to add one.</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Tree</h2>
      <div className="tree">
        <NodeView node={root} blueprint={blueprint} selectedId={selectedId} onSelect={onSelect} depth={0} />
      </div>
    </section>
  );
}

function NodeView({
  node,
  blueprint,
  selectedId,
  onSelect,
  depth,
}: {
  node: UINode;
  blueprint: Blueprint;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const byId = new Map(blueprint.nodes.map((n) => [n.id, n]));
  const isSelected = node.id === selectedId;
  return (
    <div>
      <div
        className={`tree-node${isSelected ? ' selected' : ''}`}
        onClick={() => onSelect(node.id)}
      >
        <span className="tree-icon">
          {(node.children?.length ?? 0) > 0 ? '▾' : '·'}
        </span>
        <span>{node.name}</span>
        <span style={{ color: isSelected ? 'inherit' : 'var(--fg-2)', fontSize: 10 }}>
          {node.type}
        </span>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((cid) => {
            const child = byId.get(cid);
            if (!child) return null;
            return (
              <NodeView
                key={cid}
                node={child}
                blueprint={blueprint}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
