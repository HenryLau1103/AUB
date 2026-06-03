import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BlueprintNode } from './nodes/BlueprintNode';
import { layoutTree } from '../lib/layout';
import type { Blueprint, ComponentType, UINode } from '../types';

interface Props {
  blueprint: Blueprint | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddNode: (type: ComponentType, parentId: string | null, position?: { x: number; y: number }) => void;
  onDeleteNode: (id: string) => void;
  onUpdateNode: (id: string, patch: Partial<UINode>) => void;
}

const nodeTypes: NodeTypes = { blueprint: BlueprintNode };

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ blueprint, selectedId, onSelect, onAddNode, onDeleteNode, onUpdateNode }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const layouted = useMemo(() => {
    if (!blueprint) return { nodes: [], edges: [] };
    return layoutTree(blueprint);
  }, [blueprint]);

  useEffect(() => {
    if (!blueprint) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const byId = new Map(blueprint.nodes.map((n) => [n.id, n]));
    const flowNodes: Node[] = layouted.nodes.map((ln) => {
      const n = byId.get(ln.id);
      if (!n) throw new Error(`layout references missing node ${ln.id}`);
      return {
        id: ln.id,
        type: 'blueprint',
        position: ln.position,
        data: {
          name: n.name,
          type: n.type,
          role: n.role,
          categoryId: '',
          categoryColor: guessCategoryColor(n.type),
          isContainer: isContainer(n),
        },
        selected: ln.id === selectedId,
      };
    });
    const flowEdges: Edge[] = layouted.edges.map((le) => ({
      id: le.id,
      source: le.source,
      target: le.target,
      type: 'smoothstep',
      style: { stroke: '#64748b', strokeWidth: 2 },
    }));
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [layouted, blueprint, selectedId, setNodes, setEdges]);

  const handleSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => {
      if (sel.length === 1) onSelect(sel[0]!.id);
      else onSelect(null);
    },
    [onSelect]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        onDeleteNode(selectedId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, onDeleteNode]);

  const handleConnect = useCallback<OnConnect>(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      onUpdateNode(params.target, { parent_id: params.source });
    },
    [onUpdateNode]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/aub-component-type') as ComponentType;
      if (!type) return;
      const instance = rfInstance.current;
      if (!instance || !blueprint) return;
      const flowPos = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const target = findContainerAt(blueprint, flowPos);
      onAddNode(type, target, flowPos);
    },
    [blueprint, onAddNode]
  );

  if (!blueprint) {
    return (
      <section className="panel canvas-empty">
        <h2>Canvas</h2>
        <p className="empty">Click any component in the palette to start. Drag to move, drag handles to reparent, Delete key to remove.</p>
      </section>
    );
  }

  return (
    <section
      className="panel canvas"
      ref={wrapperRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        onInit={(inst) => { rfInstance.current = inst; }}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background color="#334155" gap={24} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => (n.data as { categoryColor?: string }).categoryColor ?? '#64748b'}
          maskColor="rgba(15,23,42,0.7)"
          style={{ background: '#1e293b' }}
        />
      </ReactFlow>
    </section>
  );
}

function guessCategoryColor(type: ComponentType): string {
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

function isContainer(n: UINode): boolean {
  const containers = new Set(['app_shell','page','section','header','sidebar','top_bar','bottom_nav','stack','grid','split_pane','scroll_area','list','detail_panel','timeline','activity_feed','form','field_group','menu','toolbar','button_group','command_palette','modal','drawer','tabs','stepper']);
  return containers.has(n.type);
}

function findContainerAt(blueprint: Blueprint, flowPos: { x: number; y: number }): string | null {
  const halfW = 110;
  const halfH = 45;
  const candidates = blueprint.nodes
    .filter((n) => isContainer(n))
    .map((n) => ({ n, layout: layoutTree(blueprint).nodes.find((p) => p.id === n.id)?.position }))
    .filter((c) => c.layout != null) as { n: UINode; layout: { x: number; y: number } }[];
  candidates.sort((a, b) => Math.abs(a.layout.x) - Math.abs(b.layout.x));
  for (const c of candidates) {
    if (
      flowPos.x >= c.layout.x - halfW &&
      flowPos.x <= c.layout.x + halfW &&
      flowPos.y >= c.layout.y - halfH &&
      flowPos.y <= c.layout.y + halfH
    ) {
      return c.n.id;
    }
  }
  return blueprint.nodes.find((n) => n.parent_id === null)?.id ?? null;
}
