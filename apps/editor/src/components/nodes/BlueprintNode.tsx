import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { isContainerType } from '../../lib/registry';
import type { ComponentType } from '../../types';

export interface BlueprintNodeData {
  name: string;
  type: ComponentType;
  role: string;
  categoryId: string;
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

function BlueprintNodeImpl({ data, selected }: NodeProps) {
  const d = data as unknown as BlueprintNodeData;
  const color = d.categoryColor || CATEGORY_COLORS[d.categoryId] || '#64748b';
  const container = isContainerType(d.type);

  return (
    <div
      style={{
        width: 220,
        minHeight: 80,
        background: '#1e293b',
        border: `2px solid ${selected ? '#38bdf8' : color}`,
        borderRadius: 6,
        boxShadow: selected ? '0 0 0 2px rgba(56,189,248,0.3)' : 'none',
        fontSize: 12,
        color: '#e2e8f0',
        fontFamily: 'inherit',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, width: 8, height: 8, border: '2px solid #0f172a' }}
      />

      <div
        style={{
          background: color,
          color: '#0f172a',
          padding: '4px 8px',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{d.type}</span>
        {container && <span style={{ fontSize: 9, opacity: 0.8 }}>▾ container</span>}
      </div>

      <div style={{ padding: '6px 8px' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {d.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#94a3b8',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {d.role}
        </div>
      </div>

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
