import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BringToFront,
  Copy,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Grid2X2,
  GripHorizontal,
  Layers,
  Maximize2,
  SendToBack,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { componentLabel, t, viewportLabel, type Language } from '../lib/i18n';
import { directDragMode } from '../lib/drag-intent.mjs';
import { alignPlacements, distributePlacements, placementFor } from '../lib/geometry';
import { getTypeMeta, isContainerType } from '../lib/registry';
import { defaultPlacementForType, RESOLUTION_PRESETS, clampViewportWidth, clampViewportHeight } from '../lib/store';
import { TEMPLATE_IDS, templateLabel, type TemplateId } from '../lib/templates';
import type { ViewportQualityIssue, ViewportQualityReport } from '../lib/viewport-quality';
import { Tooltip } from './Tooltip';
import type {
  Blueprint,
  ResolvedComponentType,
  DesignSystem,
  Layout,
  Placement,
  Size,
  UINode,
  Viewport,
  ViewportId,
} from '../types';

export interface CanvasHandle {
  captureViewports(): Promise<Record<string, string>>;
  auditViewports(): Promise<ViewportQualityReport>;
  addComponent(type: ResolvedComponentType): boolean;
  focusNode(id: string): boolean;
}

interface AddNodeOptions {
  makeParentFreeform?: boolean;
  existingPlacements?: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }>;
}

interface Props {
  blueprint: Blueprint | null;
  selectedIds: string[];
  language: Language;
  onSelectionChange: (ids: string[]) => void;
  onAddNode: (
    type: ResolvedComponentType,
    parentId: string | null,
    position?: { x: number; y: number },
    viewportId?: ViewportId,
    options?: AddNodeOptions
  ) => void;
  onDeleteNodes: (ids: string[]) => void;
  onUpdateNode: (id: string, patch: Partial<UINode>) => void;
  onUpdatePlacements: (
    updates: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }>
  ) => void;
  onMoveNode: (
    id: string,
    parentId: string,
    position: { x: number; y: number } | undefined,
    viewportId: ViewportId
  ) => void;
  onDuplicateNodes: (ids: string[]) => void;
  onSetZIndex: (ids: string[], viewportId: ViewportId, direction: 'front' | 'back') => void;
  onSetViewportSize: (viewportId: ViewportId, size: { width?: number; height?: number }) => void;
  onCreateStarter: (kind: 'page' | 'app') => void;
  onTemplateSelect: (id: TemplateId) => void;
  draggingType: ResolvedComponentType | null;
  onDragComplete: () => void;
  resetKey: number;
  propertiesOpen: boolean;
  onPropertiesOpen: () => void;
}

interface TreeContext {
  byId: Map<string, UINode>;
  childrenById: Map<string, UINode[]>;
  root: UINode | null;
}

const FALLBACK_VIEWPORT: Viewport = { id: 'desktop', width: 1440, height: 900 };
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

interface ResolutionControlProps {
  language: Language;
  viewport: Viewport;
  onSetViewportSize: (viewportId: ViewportId, size: { width?: number; height?: number }) => void;
}

function ResolutionControl({ language, viewport, onSetViewportSize }: ResolutionControlProps) {
  const [draftWidth, setDraftWidth] = useState(String(viewport.width));
  const [draftHeight, setDraftHeight] = useState(String(viewport.height));

  useEffect(() => {
    setDraftWidth(String(viewport.width));
    setDraftHeight(String(viewport.height));
  }, [viewport.id, viewport.width, viewport.height]);

  const activePresetId = useMemo(() => {
    const match = RESOLUTION_PRESETS.find(
      (preset) => preset.width === viewport.width && preset.height === viewport.height
    );
    return match?.id ?? 'custom';
  }, [viewport.width, viewport.height]);

  const commitWidth = () => {
    const next = clampViewportWidth(Number(draftWidth));
    setDraftWidth(String(next));
    if (next !== viewport.width) onSetViewportSize(viewport.id, { width: next });
  };
  const commitHeight = () => {
    const next = clampViewportHeight(Number(draftHeight));
    setDraftHeight(String(next));
    if (next !== viewport.height) onSetViewportSize(viewport.id, { height: next });
  };

  return (
    <div className="resolution-control" title={t(language, 'resolution')}>
      <select
        aria-label={t(language, 'resolutionPreset')}
        value={activePresetId}
        onChange={(event) => {
          const preset = RESOLUTION_PRESETS.find((item) => item.id === event.target.value);
          if (preset) onSetViewportSize(viewport.id, { width: preset.width, height: preset.height });
        }}
      >
        {RESOLUTION_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.width} × {preset.height}
          </option>
        ))}
        {activePresetId === 'custom' && (
          <option value="custom">{t(language, 'customResolution')}</option>
        )}
      </select>
      <input
        type="number"
        className="resolution-input"
        aria-label={t(language, 'viewportWidth')}
        value={draftWidth}
        min={320}
        max={7680}
        onChange={(event) => setDraftWidth(event.target.value)}
        onBlur={commitWidth}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
      />
      <span className="resolution-times">×</span>
      <input
        type="number"
        className="resolution-input"
        aria-label={t(language, 'viewportHeight')}
        value={draftHeight}
        min={320}
        max={4320}
        onChange={(event) => setDraftHeight(event.target.value)}
        onBlur={commitHeight}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas({
  blueprint,
  selectedIds,
  language,
  onSelectionChange,
  onAddNode,
  onDeleteNodes,
  onUpdateNode,
  onUpdatePlacements,
  onMoveNode,
  onDuplicateNodes,
  onSetZIndex,
  onSetViewportSize,
  onCreateStarter,
  onTemplateSelect,
  draggingType,
  onDragComplete,
  resetKey,
  propertiesOpen,
  onPropertiesOpen,
}, ref) {
  const [viewportId, setViewportId] = useState<ViewportId>('desktop');
  const viewportIdRef = useRef<ViewportId>('desktop');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const dragHandledRef = useRef(false);
  const resizeRef = useRef(new Map<string, Partial<Placement>>());
  const artboardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);
  const tree = useMemo(() => blueprint ? buildTree(blueprint) : null, [blueprint]);
  const viewports = blueprint?.viewports.length ? blueprint.viewports : [FALLBACK_VIEWPORT];
  const activeViewport = viewports.find((viewport) => viewport.id === viewportId)
    ?? viewports[0]
    ?? FALLBACK_VIEWPORT;
  const rootContentHeight = tree?.root
    ? Math.max(activeViewport.height, ...(tree.childrenById.get(tree.root.id) ?? []).map((node) => {
        const placement = placementFor(node, activeViewport.id);
        return placement.y + placement.height + 16;
      }))
    : activeViewport.height;
  const artboardMetrics = getArtboardMetrics(activeViewport, rootContentHeight);
  const geometryScale = artboardMetrics.width / activeViewport.width;
  const selectedNodes = selectedIds
    .map((id) => tree?.byId.get(id))
    .filter((node): node is UINode => Boolean(node));
  const canDuplicate = selectedNodes.some((node) => node.parent_id !== null);
  const selectionGeometryKey = selectedNodes
    .map((node) => `${node.id}:${JSON.stringify(node.placements?.[viewportId] ?? null)}`)
    .join('|');
  const selectedContainer = selectedNodes.length === 1 && selectedNodes[0] && isContainerType(selectedNodes[0].type)
    ? selectedNodes[0]
    : null;

  useEffect(() => {
    viewportIdRef.current = viewportId;
  }, [viewportId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitArtboard());
    return () => cancelAnimationFrame(frame);
  }, [resetKey]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitArtboard());
    return () => cancelAnimationFrame(frame);
  }, [viewportId, activeViewport.width, activeViewport.height]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    let frame = requestAnimationFrame(() => fitArtboard());
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitArtboard());
    });
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [viewportId, activeViewport.width, activeViewport.height, resetKey]);

  useEffect(() => {
    if (draggingType) dragHandledRef.current = false;
  }, [draggingType]);

  useEffect(() => {
    if (!draggingType) return;
    const pointerDragType = draggingType;
    function handlePointerUp(event: PointerEvent) {
      if (dragHandledRef.current) {
        onDragComplete();
        return;
      }
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const artboard = element instanceof HTMLElement ? element.closest<HTMLElement>('.artboard') : null;
      if (!artboard || !artboardRef.current?.contains(element)) {
        onDragComplete();
        return;
      }
      const targetElement = element instanceof HTMLElement
        ? element.closest<HTMLElement>('[data-node-id]')
        : null;
      const targetNode = targetElement ? tree?.byId.get(targetElement.dataset.nodeId ?? '') : null;
      const parent = targetNode && isContainerType(targetNode.type)
        ? targetNode
        : targetNode?.parent_id
          ? tree?.byId.get(targetNode.parent_id) ?? null
        : selectedContainer
          ?? tree?.root
          ?? null;
      const drop = parent
        ? prepareFreeformDrop(parent, event.clientX, event.clientY)
        : { position: undefined, options: {} };
      dragHandledRef.current = true;
      onAddNode(pointerDragType, parent?.id ?? null, drop.position, viewportId, drop.options);
      onDragComplete();
    }
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [
    draggingType,
    geometryScale,
    onAddNode,
    onDragComplete,
    selectedContainer,
    tree,
    viewportId,
    zoom,
  ]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const root = artboardRef.current;
      if (!root) {
        setTargets([]);
        return;
      }
      setTargets(selectedIds
        .map((id) => root.querySelector<HTMLElement>(`.freeform-node[data-node-id="${CSS.escape(id)}"]`))
        .filter((element): element is HTMLElement => Boolean(element)));
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedIds, blueprint, viewportId, zoom]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      moveableRef.current?.updateRect();
      syncMoveableScrollOffset();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectionGeometryKey, targets, viewportId, zoom]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!blueprint || selectedIds.length === 0 || isTextEditingTarget(event.target)) return;
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        onDeleteNodes(selectedIds);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        onDuplicateNodes(selectedIds);
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const delta = event.shiftKey ? 10 : 1;
      event.preventDefault();
      onUpdatePlacements(selectedNodes.map((node) => {
        const placement = placementFor(node, viewportId);
        return {
          id: node.id,
          viewportId,
          patch: {
            x: placement.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0),
            y: placement.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0),
          },
        };
      }));
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blueprint, onDeleteNodes, onDuplicateNodes, onUpdatePlacements, selectedIds, selectedNodes, viewportId]);

  useImperativeHandle(ref, () => ({
    focusNode(id) {
      const target = artboardRef.current?.querySelector<HTMLElement>(
        `.preview-node[data-node-id="${CSS.escape(id)}"]`
      );
      if (!target) return false;
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      return true;
    },
    addComponent(type) {
      const selected = selectedNodes[0];
      const parent = selected && isContainerType(selected.type)
        ? selected
        : selected?.parent_id
          ? tree?.byId.get(selected.parent_id) ?? tree?.root ?? null
          : tree?.root ?? null;
      if (!parent) return false;
      const existingPlacements = parent.layout?.mode === 'freeform'
        ? []
        : freeformPlacementUpdates(parent);
      const position = nextFreeformPosition(parent, type, existingPlacements);
      onAddNode(type, parent.id, position, viewportId, {
        ...(parent.layout?.mode === 'freeform'
          ? {}
          : { makeParentFreeform: true, existingPlacements }),
      });
      return true;
    },
    async captureViewports() {
      const { toPng } = await import('html-to-image');
      const result: Record<string, string> = {};
      const previous = viewportIdRef.current;
      for (const viewport of viewports) {
        setViewportId(viewport.id);
        viewportIdRef.current = viewport.id;
        await nextPaint();
        if (artboardRef.current) {
          artboardRef.current.classList.add('capture-clean');
          try {
            result[viewport.id] = await toPng(artboardRef.current, {
              cacheBust: true,
              pixelRatio: 1,
              backgroundColor: '#ffffff',
            });
          } finally {
            artboardRef.current.classList.remove('capture-clean');
          }
        }
      }
      setViewportId(previous);
      viewportIdRef.current = previous;
      await nextPaint();
      return result;
    },
    async auditViewports() {
      const previous = viewportIdRef.current;
      const issues: ViewportQualityIssue[] = [];
      for (const viewport of viewports) {
        setViewportId(viewport.id);
        viewportIdRef.current = viewport.id;
        await nextPaint();
        if (artboardRef.current && blueprint) {
          artboardRef.current.classList.add('capture-clean');
          try {
            issues.push(...auditRenderedViewport(artboardRef.current, blueprint, viewport.id));
          } finally {
            artboardRef.current.classList.remove('capture-clean');
          }
        }
      }
      setViewportId(previous);
      viewportIdRef.current = previous;
      await nextPaint();
      return {
        checkedViewportIds: viewports.map((viewport) => viewport.id),
        issues,
      };
    },
  }), [
    activeViewport,
    blueprint,
    geometryScale,
    onAddNode,
    selectedNodes,
    tree,
    viewportId,
    viewports,
    zoom,
  ]);

  function updateZoom(value: number) {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2)))));
  }

  function fitArtboard() {
    const stage = stageRef.current;
    if (!stage) return;
    const availableWidth = stage.clientWidth - 56;
    const availableHeight = stage.clientHeight - 56;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const horizontalScale = availableWidth / artboardMetrics.width;
    const verticalScale = availableHeight / artboardMetrics.height;
    updateZoom(Math.min(1, horizontalScale, verticalScale));
    stage.scrollTo({ left: 0, top: 0 });
  }

  function syncMoveableScrollOffset() {
    const stage = stageRef.current;
    const controlBox = stage?.parentElement?.querySelector<HTMLElement>('.moveable-control-box');
    if (!stage || !controlBox) return;
    controlBox.style.marginLeft = `${-stage.scrollLeft}px`;
    controlBox.style.marginTop = `${-stage.scrollTop}px`;
  }

  function handleCanvasDrop(event: React.DragEvent) {
    event.preventDefault();
    const type = readDropType(event, draggingType);
    if (!type || dragHandledRef.current) {
      onDragComplete();
      return;
    }
    dragHandledRef.current = true;
    const element = event.target instanceof HTMLElement ? event.target : null;
    const targetElement = element?.closest<HTMLElement>('[data-node-id]');
    const targetNode = targetElement ? tree?.byId.get(targetElement.dataset.nodeId ?? '') : null;
    const parent = targetNode && isContainerType(targetNode.type)
      ? targetNode
      : targetNode?.parent_id
        ? tree?.byId.get(targetNode.parent_id) ?? null
      : selectedContainer
        ?? tree?.root
        ?? null;
    const drop = parent
      ? prepareFreeformDrop(parent, event.clientX, event.clientY)
      : { position: undefined, options: {} };
    onAddNode(type, parent?.id ?? null, drop.position, viewportId, drop.options);
    setDropTargetId(null);
    onDragComplete();
  }

  function handleAlign(mode: Parameters<typeof alignPlacements>[2]) {
    onUpdatePlacements(alignPlacements(selectedNodes, viewportId, mode).map((update) => ({
      ...update,
      viewportId,
    })));
  }

  function handleDistribute(axis: 'horizontal' | 'vertical') {
    onUpdatePlacements(distributePlacements(selectedNodes, viewportId, axis).map((update) => ({
      ...update,
      viewportId,
    })));
  }

  function beginDirectDrag(id: string, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return;
    const node = tree?.byId.get(id);
    const target = event.currentTarget.closest<HTMLElement>('[data-node-id]');
    const parentSurface = node?.parent_id ? containerSurface(node.parent_id) : null;
    const placement = node ? placementFor(node, viewportId) : null;
    if (!node || !target || !placement || !parentSurface) return;
    const draggedNode = node;
    const draggedElement = target;
    const basePlacement = placement;

    event.preventDefault();
    event.stopPropagation();
    onSelectionChange([id]);
    draggedElement.classList.add('is-handle-dragging');

    const startX = event.clientX;
    const startY = event.clientY;
    const targetRect = draggedElement.getBoundingClientRect();
    const parentRect = parentSurface.getBoundingClientRect();
    const grabOffsetX = event.clientX - targetRect.left;
    const grabOffsetY = event.clientY - targetRect.top;
    let visualX = 0;
    let visualY = 0;
    let moved = false;
    let destination: UINode | null = null;

    function handlePointerMove(pointerEvent: PointerEvent) {
      visualX = pointerEvent.clientX - startX;
      visualY = pointerEvent.clientY - startY;
      moved ||= Math.abs(visualX) > 2 || Math.abs(visualY) > 2;
      draggedElement.style.transform = `translate(${visualX / zoom}px, ${visualY / zoom}px)`;
      destination = pointerEvent.altKey
        ? dropContainerAt(pointerEvent.clientX, pointerEvent.clientY, id)
        : null;
      setDropTargetId(destination && destination.id !== draggedNode.parent_id ? destination.id : null);
    }

    function handlePointerUp(pointerEvent: PointerEvent) {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      draggedElement.style.transform = '';
      draggedElement.classList.remove('is-handle-dragging');
      setDropTargetId(null);
      if (!moved) return;
      const mode = directDragMode({
        altKey: pointerEvent.altKey,
        currentParentId: draggedNode.parent_id,
        destinationId: destination?.id ?? null,
      });
      if (mode === 'reparent' && destination) {
        const surfaceRect = containerSurface(destination.id)?.getBoundingClientRect();
        const position = destination.layout?.mode === 'freeform' && surfaceRect
          ? {
              x: Math.max(0, Math.min(
                (pointerEvent.clientX - surfaceRect.left - grabOffsetX) / zoom / geometryScale,
                Math.max(0, (surfaceRect.width - targetRect.width) / zoom / geometryScale)
              )),
              y: Math.max(0, Math.min(
                (pointerEvent.clientY - surfaceRect.top - grabOffsetY) / zoom / geometryScale,
                Math.max(0, (surfaceRect.height - targetRect.height) / zoom / geometryScale)
              )),
            }
          : undefined;
        onMoveNode(id, destination.id, position, viewportId);
        return;
      }
      if (draggedNode.parent_id && tree?.byId.get(draggedNode.parent_id)?.layout?.mode !== 'freeform') return;
      const boundedX = Math.min(
        parentRect.right - targetRect.right,
        Math.max(parentRect.left - targetRect.left, visualX)
      );
      const boundedY = Math.min(
        parentRect.bottom - targetRect.bottom,
        Math.max(parentRect.top - targetRect.top, visualY)
      );
      onUpdatePlacements([{
        id,
        viewportId,
        patch: {
          x: basePlacement.x + boundedX / zoom / geometryScale,
          y: basePlacement.y + boundedY / zoom / geometryScale,
        },
      }]);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  function dropContainerAt(clientX: number, clientY: number, draggedId: string): UINode | null {
    if (!tree) return null;
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const nodeElement = element instanceof HTMLElement
        ? element.closest<HTMLElement>('[data-node-id]')
        : null;
      const hitId = nodeElement?.dataset.nodeId;
      if (!hitId || isNodeInSubtree(hitId, draggedId, tree)) continue;
      let candidate = tree.byId.get(hitId) ?? null;
      while (candidate && !isContainerType(candidate.type)) {
        candidate = candidate.parent_id ? tree.byId.get(candidate.parent_id) ?? null : null;
      }
      if (candidate && !isNodeInSubtree(candidate.id, draggedId, tree)) return candidate;
    }
    return null;
  }

  function toggleLayoutMode() {
    if (!selectedContainer || !tree) return;
    const nextMode = selectedContainer.layout?.mode === 'freeform' ? 'auto' : 'freeform';
    if (nextMode === 'auto') {
      onUpdateNode(selectedContainer.id, {
        layout: {
          ...selectedContainer.layout,
          mode: 'auto',
          display: selectedContainer.layout?.display ?? 'flex',
          direction: selectedContainer.layout?.direction ?? 'column',
        },
      });
      return;
    }

    const updates = freeformPlacementUpdates(selectedContainer);
    if (updates.length) onUpdatePlacements(updates);
    onUpdateNode(selectedContainer.id, { layout: { ...selectedContainer.layout, mode: 'freeform' } });
  }

  function prepareFreeformDrop(parent: UINode, clientX: number, clientY: number): {
    position: { x: number; y: number };
    options: AddNodeOptions;
  } {
    const surface = containerSurface(parent.id);
    return {
      position: pointWithinContainer(clientX, clientY, surface ?? artboardRef.current, zoom, geometryScale),
      options: parent.layout?.mode === 'freeform'
        ? {}
        : {
            makeParentFreeform: true,
            existingPlacements: freeformPlacementUpdates(parent),
          },
    };
  }

  function containerSurface(id: string): HTMLElement | null {
    return artboardRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(id)}"] > .preview-children`
    ) ?? null;
  }

  function freeformPlacementUpdates(container: UINode) {
    const containerElement = containerSurface(container.id);
    const containerRect = containerElement?.getBoundingClientRect();
    const children = tree?.childrenById.get(container.id) ?? [];
    const updates: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }> = [];
    if (!containerRect) return updates;
    const activeContainerSize = {
      width: containerRect.width / zoom / geometryScale,
      height: containerRect.height / zoom / geometryScale,
    };
    for (const child of children) {
      const childElement = artboardRef.current?.querySelector<HTMLElement>(
        `[data-node-id="${CSS.escape(child.id)}"]`
      );
      const childRect = childElement?.getBoundingClientRect();
      if (!childRect) continue;
      const activePlacement = {
        x: Math.round((childRect.left - containerRect.left) / zoom / geometryScale),
        y: Math.round((childRect.top - containerRect.top) / zoom / geometryScale),
        width: Math.round(childRect.width / zoom / geometryScale),
        height: Math.round(childRect.height / zoom / geometryScale),
      };
      for (const targetViewport of viewports) {
        const containerPlacement = container.parent_id
          ? placementFor(container, targetViewport.id)
          : { width: targetViewport.width, height: targetViewport.height };
        const fallbackRatio = Math.min(
          targetViewport.width / activeViewport.width,
          targetViewport.height / activeViewport.height
        );
        const ratioX = containerPlacement.width > 0
          ? containerPlacement.width / activeContainerSize.width
          : fallbackRatio;
        const ratioY = containerPlacement.height > 0
          ? containerPlacement.height / activeContainerSize.height
          : fallbackRatio;
        updates.push({
          id: child.id,
          viewportId: targetViewport.id,
          patch: {
            x: Math.max(0, Math.round(activePlacement.x * ratioX)),
            y: Math.max(0, Math.round(activePlacement.y * ratioY)),
            width: Math.max(1, Math.round(activePlacement.width * ratioX)),
            height: Math.max(1, Math.round(activePlacement.height * ratioY)),
          },
        });
      }
    }
    return updates;
  }

  function nextFreeformPosition(
    parent: UINode,
    type: ResolvedComponentType,
    convertedPlacements: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }>
  ): { x: number; y: number } {
    const surface = containerSurface(parent.id);
    const surfaceRect = surface?.getBoundingClientRect();
    const surfaceWidth = surfaceRect
      ? surfaceRect.width / zoom / geometryScale
      : activeViewport.width;
    const surfaceHeight = surfaceRect
      ? surfaceRect.height / zoom / geometryScale
      : activeViewport.height;
    const size = defaultPlacementForType(type);
    const children = tree?.childrenById.get(parent.id) ?? [];
    const occupied = parent.layout?.mode === 'freeform'
      ? children.map((child) => placementFor(child, viewportId))
      : convertedPlacements
          .filter((update) => update.viewportId === viewportId)
          .map((update) => ({
            ...defaultPlacementForType(tree?.byId.get(update.id)?.type ?? 'text'),
            ...update.patch,
          } as Placement));
    const maxX = Math.max(0, surfaceWidth - Math.min(size.width, surfaceWidth));
    const maxY = Math.max(0, surfaceHeight - Math.min(size.height, surfaceHeight));

    for (let y = 16; y <= maxY; y += 32) {
      for (let x = 16; x <= maxX; x += 32) {
        if (!occupied.some((placement) => rectanglesOverlap(
          { x, y, width: size.width, height: size.height },
          placement,
          8
        ))) {
          return { x, y };
        }
      }
    }
    return {
      x: Math.min(16, maxX),
      y: Math.min(Math.max(0, ...occupied.map((placement) => placement.y + placement.height + 16)), maxY),
    };
  }

  if (!blueprint || !tree?.root) {
    return (
      <section
        className={`panel canvas canvas-empty${draggingType ? ' drag-active' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const type = readDropType(event, draggingType);
          if (type) onAddNode(type, null, undefined, viewportId);
          onDragComplete();
        }}
      >
        {!propertiesOpen && <button className="properties-reopen-button" onClick={onPropertiesOpen}>{t(language, 'showProperties')}</button>}
        <div className="empty-artboard start-artboard">
          <div className="start-heading"><h2>{t(language, 'startTitle')}</h2><p>{t(language, 'startPrompt')}</p></div>
          <div className="start-options">
            <button className="start-option" onClick={() => onCreateStarter('page')}><strong>{t(language, 'startPage')}</strong><span>{t(language, 'startPagePath')}</span></button>
            <button className="start-option" onClick={() => onCreateStarter('app')}><strong>{t(language, 'startApp')}</strong><span>{t(language, 'startAppPath')}</span></button>
          </div>
          <div className="start-templates">
            <span>{t(language, 'startFromTemplate')}</span>
            <div>{TEMPLATE_IDS.map((id) => <button key={id} onClick={() => onTemplateSelect(id)}>{templateLabel(language, id)}</button>)}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`panel canvas${draggingType ? ' drag-active' : ''}`}
      onClick={() => onSelectionChange([])}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleCanvasDrop}
    >
      <div className="canvas-toolbar" onClick={(event) => event.stopPropagation()}>
        <div className="canvas-title">
          <strong>{blueprint.screen.name}</strong>
          <span>{activeViewport.width} × {activeViewport.height}</span>
        </div>
        <div className="viewport-tabs">
          {viewports.map((viewport) => (
            <button key={viewport.id} className={viewport.id === viewportId ? 'active' : ''} onClick={() => setViewportId(viewport.id)}>
              {viewportLabel(language, viewport.id)}
            </button>
          ))}
        </div>
        <ResolutionControl
          language={language}
          viewport={activeViewport}
          onSetViewportSize={onSetViewportSize}
        />
        <div className="canvas-tool-group selection-tools">
          <IconButton icon={<Copy />} label={t(language, 'duplicate')} disabled={!canDuplicate} onClick={() => onDuplicateNodes(selectedIds)} />
          <IconButton icon={<BringToFront />} label={t(language, 'bringFront')} disabled={!targets.length} onClick={() => onSetZIndex(selectedIds, viewportId, 'front')} />
          <IconButton icon={<SendToBack />} label={t(language, 'sendBack')} disabled={!targets.length} onClick={() => onSetZIndex(selectedIds, viewportId, 'back')} />
        </div>
        <div className="canvas-tool-group align-tools">
          <IconButton icon={<AlignStartVertical />} label={t(language, 'alignLeft')} disabled={targets.length < 2} onClick={() => handleAlign('left')} />
          <IconButton icon={<AlignCenterVertical />} label={t(language, 'alignCenter')} disabled={targets.length < 2} onClick={() => handleAlign('center')} />
          <IconButton icon={<AlignEndVertical />} label={t(language, 'alignRight')} disabled={targets.length < 2} onClick={() => handleAlign('right')} />
          <IconButton icon={<AlignStartHorizontal />} label={t(language, 'alignTop')} disabled={targets.length < 2} onClick={() => handleAlign('top')} />
          <IconButton icon={<AlignCenterHorizontal />} label={t(language, 'alignMiddle')} disabled={targets.length < 2} onClick={() => handleAlign('middle')} />
          <IconButton icon={<AlignEndHorizontal />} label={t(language, 'alignBottom')} disabled={targets.length < 2} onClick={() => handleAlign('bottom')} />
          <IconButton icon={<AlignHorizontalDistributeCenter />} label={t(language, 'distributeHorizontal')} disabled={targets.length < 3} onClick={() => handleDistribute('horizontal')} />
          <IconButton icon={<AlignVerticalDistributeCenter />} label={t(language, 'distributeVertical')} disabled={targets.length < 3} onClick={() => handleDistribute('vertical')} />
        </div>
        <button
          className={`layout-mode-toggle${selectedContainer?.layout?.mode === 'freeform' ? ' active' : ''}`}
          disabled={!selectedContainer}
          onClick={toggleLayoutMode}
          title={t(language, 'toggleLayoutMode')}
        >
          {selectedContainer?.layout?.mode === 'freeform' ? <Layers /> : <Grid2X2 />}
          <span>{selectedContainer?.layout?.mode === 'freeform' ? t(language, 'freeform') : t(language, 'autoLayout')}</span>
        </button>
        <div className="zoom-controls">
          <IconButton icon={<Maximize2 />} label={t(language, 'fitArtboard')} onClick={fitArtboard} />
          <IconButton icon={<ZoomOut />} label={t(language, 'zoomOut')} disabled={zoom <= MIN_ZOOM} onClick={() => updateZoom(zoom - ZOOM_STEP)} />
          <input aria-label={t(language, 'zoom')} type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP} value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} />
          <IconButton icon={<ZoomIn />} label={t(language, 'zoomIn')} disabled={zoom >= MAX_ZOOM} onClick={() => updateZoom(zoom + ZOOM_STEP)} />
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        {!propertiesOpen && <button className="properties-toolbar-button" onClick={onPropertiesOpen}>{t(language, 'showProperties')}</button>}
      </div>

      {draggingType && <div className="canvas-drop-hint">{t(language, 'releaseToAdd', { component: componentLabel(language, draggingType) })}</div>}
      <div
        className="artboard-stage"
        ref={stageRef}
        onScroll={() => requestAnimationFrame(() => {
          moveableRef.current?.updateRect();
          syncMoveableScrollOffset();
        })}
      >
        <div className="artboard-zoom-shell" style={{ width: artboardMetrics.width * zoom, height: artboardMetrics.height * zoom }}>
          <div
            ref={artboardRef}
            className={`artboard artboard-${activeViewport.id}`}
            data-viewport-id={viewportId}
            style={{ width: artboardMetrics.width, height: artboardMetrics.height, transform: `scale(${zoom})` }}
          >
            <PreviewNode
              node={tree.root}
              tree={tree}
              selectedIds={selectedIds}
              dropTargetId={dropTargetId}
              viewportId={viewportId}
              isRoot
              language={language}
              designSystem={blueprint.design_system}
              onSelect={(id, additive) => {
                if (additive) {
                  onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
                } else {
                  onSelectionChange([id]);
                }
              }}
              onDelete={(id) => onDeleteNodes([id])}
              onDropTargetChange={setDropTargetId}
              onDirectDragStart={beginDirectDrag}
              zoom={zoom}
              geometryScale={geometryScale}
            />
          </div>
        </div>
      </div>

      <Selecto
        container={artboardRef.current}
        dragContainer={stageRef.current}
        selectableTargets={['.freeform-node']}
        selectByClick={false}
        selectFromInside={false}
        continueSelectWithoutDeselect
        toggleContinueSelect={['shift']}
        hitRate={20}
        onSelect={(event) => {
          const ids = event.selected
            .map((element) => (element as HTMLElement).dataset.nodeId)
            .filter((id): id is string => Boolean(id));
          onSelectionChange(ids);
        }}
      />
      <Moveable
        ref={moveableRef}
        key={`${viewportId}:${selectionGeometryKey}`}
        target={targets}
        draggable={false}
        resizable
        renderDirections={['nw', 'ne', 'e', 'se', 's', 'sw', 'w']}
        snappable
        snapThreshold={6}
        elementGuidelines={Array.from(artboardRef.current?.querySelectorAll<HTMLElement>('.freeform-node') ?? [])}
        verticalGuidelines={[0, artboardMetrics.width / 2, artboardMetrics.width]}
        horizontalGuidelines={[0, artboardMetrics.height / 2, artboardMetrics.height]}
        bounds={{ left: 0, top: 0, right: artboardMetrics.width, bottom: artboardMetrics.height }}
        origin={false}
        keepRatio={false}
        throttleResize={1}
        onResizeStart={(event) => {
          event.setOrigin(['%', '%']);
          if (event.dragStart) event.dragStart.set([0, 0]);
        }}
        onResize={(event) => {
          const id = event.target.dataset.nodeId;
          if (!id) return;
          const [x, y] = event.drag.beforeTranslate;
          resizeRef.current.set(id, { width: event.width, height: event.height, x, y });
          event.target.style.width = `${event.width}px`;
          event.target.style.height = `${event.height}px`;
          event.target.style.transform = `translate(${x}px, ${y}px)`;
        }}
        onResizeEnd={() => commitResize()}
        onResizeGroupStart={(event) => event.events.forEach((item) => {
          item.setOrigin(['%', '%']);
          if (item.dragStart) item.dragStart.set([0, 0]);
        })}
        onResizeGroup={(event) => event.events.forEach((item) => {
          const id = item.target.dataset.nodeId;
          if (!id) return;
          const [x, y] = item.drag.beforeTranslate;
          resizeRef.current.set(id, { width: item.width, height: item.height, x, y });
          item.target.style.width = `${item.width}px`;
          item.target.style.height = `${item.height}px`;
          item.target.style.transform = `translate(${x}px, ${y}px)`;
        })}
        onResizeGroupEnd={() => commitResize()}
      />
    </section>
  );

  function commitResize() {
    const updates: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }> = [];
    for (const [id, patch] of resizeRef.current.entries()) {
      const node = tree?.byId.get(id);
      const placement = node ? placementFor(node, viewportId) : null;
      if (placement) {
        updates.push({
            id,
            viewportId,
            patch: {
              width: (patch.width ?? placement.width) / geometryScale,
              height: (patch.height ?? placement.height) / geometryScale,
              x: placement.x + (patch.x ?? 0) / geometryScale,
              y: placement.y + (patch.y ?? 0) / geometryScale,
            },
          });
      }
    }
    targets.forEach((target) => { target.style.transform = ''; });
    resizeRef.current.clear();
    if (updates.length) onUpdatePlacements(updates);
  }
});

function PreviewNode({
  node,
  tree,
  selectedIds,
  dropTargetId,
  viewportId,
  language,
  designSystem,
  isRoot = false,
  onSelect,
  onDelete,
  onDropTargetChange,
  onDirectDragStart,
  zoom,
  geometryScale,
}: {
  node: UINode;
  tree: TreeContext;
  selectedIds: string[];
  dropTargetId: string | null;
  viewportId: ViewportId;
  language: Language;
  designSystem?: DesignSystem;
  isRoot?: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onDelete: (id: string) => void;
  onDropTargetChange: (id: string | null) => void;
  onDirectDragStart: (id: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  zoom: number;
  geometryScale: number;
}) {
  const children = tree.childrenById.get(node.id) ?? [];
  const canContain = isContainerType(node.type);
  const selected = selectedIds.includes(node.id);
  const parent = node.parent_id ? tree.byId.get(node.parent_id) : null;
  const isFreeformChild = parent?.layout?.mode === 'freeform';
  const placement = isFreeformChild ? placementFor(node, viewportId) : null;
  const isAppSidebar = node.type === 'sidebar' && parent?.type === 'app_shell';
  const style = {
    ...nodeStyle(node),
    ...nodeTokenStyle(node, designSystem),
    ...(placement ? placementStyle(placement, geometryScale) : {}),
  };
  const childrenStyle = node.layout?.mode === 'freeform'
    ? { position: 'relative', width: '100%', height: '100%' } satisfies CSSProperties
    : childrenLayoutStyle(node, children.length > 0);

  return (
    <div
      className={[
        'preview-node',
        `preview-${node.type}`,
        selected ? 'selected' : '',
        isRoot ? 'is-root' : '',
        canContain ? 'can-contain' : 'is-leaf',
        dropTargetId === node.id ? 'drop-target' : '',
        isFreeformChild ? 'freeform-node' : '',
        node.type === 'sidebar' ? (isAppSidebar ? 'app-sidebar' : 'page-sidebar') : '',
      ].filter(Boolean).join(' ')}
      data-node-id={node.id}
      data-parent-id={node.parent_id ?? ''}
      data-type={node.type}
      data-name={node.name}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      onDragOver={(event) => {
        if (!canContain) return;
        event.preventDefault();
        event.stopPropagation();
        onDropTargetChange(node.id);
      }}
      onDragLeave={(event) => {
        if (event.target === event.currentTarget) onDropTargetChange(null);
      }}
    >
      {!isRoot && node.parent_id !== null && (
        <button
          type="button"
          className="preview-drag-handle"
          aria-label={t(language, 'dragComponent', { component: node.name })}
          title={t(language, 'dragComponentHint', { component: node.name })}
          onPointerDown={(event) => onDirectDragStart(node.id, event)}
          onClick={(event) => event.stopPropagation()}
        >
          <GripHorizontal />
        </button>
      )}
      {!isRoot && node.parent_id !== null && (
        <button className="preview-delete-button" aria-label={`${t(language, 'delete')} ${node.name}`} onClick={(event) => {
          event.stopPropagation();
          onDelete(node.id);
        }}>{t(language, 'delete')}</button>
      )}
      {canContain ? (
        <>
          {containerHeader(node, language, isAppSidebar)}
          <div className={`preview-children${node.layout?.mode === 'freeform' ? ' freeform-surface' : ''}`} style={childrenStyle}>
            {children.length
              ? children.map((child) => (
                  <PreviewNode
                    key={child.id}
                    node={child}
                    tree={tree}
                    selectedIds={selectedIds}
                    dropTargetId={dropTargetId}
                    viewportId={viewportId}
                    language={language}
                    designSystem={designSystem}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDropTargetChange={onDropTargetChange}
                    onDirectDragStart={onDirectDragStart}
                    zoom={zoom}
                    geometryScale={geometryScale}
                  />
                ))
              : emptyContainer(node, language, isAppSidebar)}
          </div>
        </>
      ) : leafPreview(node, language)}
    </div>
  );
}

function buildTree(blueprint: Blueprint): TreeContext {
  const byId = new Map(blueprint.nodes.map((node) => [node.id, node]));
  const root = blueprint.nodes.find((node) => node.parent_id === null) ?? null;
  const childrenById = new Map<string, UINode[]>();

  for (const node of blueprint.nodes) {
    childrenById.set(node.id, []);
  }

  const declaredChildren = new Map<string, Set<string>>();
  for (const node of blueprint.nodes) {
    const childIds: string[] = node.children ?? [];
    const declared = childIds
      .map((id) => byId.get(id))
      .filter((child): child is UINode => Boolean(child));
    const declaredSet = new Set<string>(declared.map((child) => child.id));
    childrenById.set(node.id, [...declared]);
    declaredChildren.set(node.id, declaredSet);
  }

  for (const node of blueprint.nodes) {
    if (!node.parent_id || !childrenById.has(node.parent_id)) continue;
    const childrenSet = declaredChildren.get(node.parent_id);
    if (childrenSet?.has(node.id)) continue;
    childrenById.get(node.parent_id)?.push(node);
  }
  return { byId, childrenById, root };
}

function isNodeInSubtree(id: string, ancestorId: string, tree: TreeContext): boolean {
  let current = tree.byId.get(id);
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parent_id ? tree.byId.get(current.parent_id) : undefined;
  }
  return false;
}

function readDropType(event: React.DragEvent, fallback: ResolvedComponentType | null): ResolvedComponentType | null {
  const value = event.dataTransfer.getData('application/aub-component-type')
    || event.dataTransfer.getData('text/plain')
    || fallback
    || '';
  return getTypeMeta(value as ResolvedComponentType) ? value as ResolvedComponentType : null;
}

function getArtboardMetrics(viewport: Viewport, contentHeight = viewport.height) {
  return {
    width: viewport.width,
    height: Math.max(viewport.height, Math.round(contentHeight)),
  };
}

function pointWithinContainer(clientX: number, clientY: number, element: HTMLElement | null, zoom: number, geometryScale: number) {
  const rect = element?.getBoundingClientRect();
  if (!rect) return { x: 32, y: 32 };
  return {
    x: Math.max(0, Math.round((clientX - rect.left) / zoom / geometryScale)),
    y: Math.max(0, Math.round((clientY - rect.top) / zoom / geometryScale)),
  };
}

function rectanglesOverlap(a: Placement, b: Placement, gap = 0): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function auditRenderedViewport(
  artboard: HTMLElement,
  blueprint: Blueprint,
  viewportId: ViewportId
): ViewportQualityIssue[] {
  const tolerance = 2;
  const issues: ViewportQualityIssue[] = [];
  const artboardRect = artboard.getBoundingClientRect();
  const byId = new Map(blueprint.nodes.map((node) => [node.id, node]));
  const horizontalScrollAllowed = new Set(
    blueprint.responsive
      .filter((rule) => rule.viewport === viewportId && rule.rule === 'scroll')
      .map((rule) => rule.target_node_id)
  );
  const elements = Array.from(
    artboard.querySelectorAll<HTMLElement>('.preview-node[data-node-id]:not(.is-root)')
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  for (const element of elements) {
    const id = element.dataset.nodeId;
    if (!id) continue;
    const rect = element.getBoundingClientRect();
    if (
      !hasScrollableAncestor(element, artboard) &&
      (
        rect.left < artboardRect.left - tolerance ||
        rect.right > artboardRect.right + tolerance ||
        rect.top < artboardRect.top - tolerance ||
        rect.bottom > artboardRect.bottom + tolerance
      )
    ) {
      issues.push({ viewportId, type: 'viewport-overflow', nodeIds: [id] });
    }

    const node = byId.get(id);
    const surface = element.querySelector<HTMLElement>(':scope > .preview-children');
    if (
      surface &&
      node?.type !== 'scroll_area' &&
      !horizontalScrollAllowed.has(id) &&
      surface.scrollWidth > surface.clientWidth + tolerance
    ) {
      issues.push({ viewportId, type: 'horizontal-overflow', nodeIds: [id] });
    }
    const minimumWidth = minimumReadableWidth(node?.type, viewportId);
    if (minimumWidth > 0 && element.clientWidth < minimumWidth) {
      issues.push({ viewportId, type: 'undersized', nodeIds: [id] });
    }
  }

  const groups = new Map<string, HTMLElement[]>();
  for (const element of elements.filter((candidate) => candidate.classList.contains('freeform-node'))) {
    const parentId = element.dataset.parentId;
    if (!parentId) continue;
    groups.set(parentId, [...(groups.get(parentId) ?? []), element]);
  }
  const overlayTypes = new Set(['modal', 'drawer', 'toast']);
  for (const siblings of groups.values()) {
    for (let firstIndex = 0; firstIndex < siblings.length; firstIndex += 1) {
      const first = siblings[firstIndex]!;
      const firstNode = byId.get(first.dataset.nodeId ?? '');
      const firstRect = first.getBoundingClientRect();
      for (let secondIndex = firstIndex + 1; secondIndex < siblings.length; secondIndex += 1) {
        const second = siblings[secondIndex]!;
        const secondNode = byId.get(second.dataset.nodeId ?? '');
        if (
          !firstNode ||
          !secondNode ||
          overlayTypes.has(firstNode.type) ||
          overlayTypes.has(secondNode.type)
        ) continue;
        const secondRect = second.getBoundingClientRect();
        const overlapWidth = Math.max(0, Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left));
        const overlapHeight = Math.max(0, Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top));
        const overlapArea = overlapWidth * overlapHeight;
        const smallerArea = Math.min(
          firstRect.width * firstRect.height,
          secondRect.width * secondRect.height
        );
        const firstZ = Number.parseInt(getComputedStyle(first).zIndex || '1', 10);
        const secondZ = Number.parseInt(getComputedStyle(second).zIndex || '1', 10);
        if (smallerArea > 0 && overlapArea / smallerArea >= 0.15 && firstZ === secondZ) {
          issues.push({
            viewportId,
            type: 'overlap',
            nodeIds: [firstNode.id, secondNode.id],
          });
        }
      }
    }
  }

  return deduplicateQualityIssues(issues);
}

function hasScrollableAncestor(element: HTMLElement, boundary: HTMLElement): boolean {
  let current = element.parentElement;
  while (current && current !== boundary) {
    const style = getComputedStyle(current);
    const scrollable = ['auto', 'scroll'].includes(style.overflowX)
      || ['auto', 'scroll'].includes(style.overflowY);
    if (
      scrollable &&
      (
        current.scrollWidth > current.clientWidth + 2 ||
        current.scrollHeight > current.clientHeight + 2
      )
    ) return true;
    current = current.parentElement;
  }
  return false;
}

function minimumReadableWidth(type: ResolvedComponentType | undefined, viewportId: ViewportId): number {
  if (viewportId !== 'mobile') return 0;
  if (type === 'kanban_column') return 160;
  if (type === 'data_table') return 300;
  if (type === 'split_pane') return 280;
  return 0;
}

function deduplicateQualityIssues(issues: ViewportQualityIssue[]): ViewportQualityIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.viewportId}:${issue.type}:${issue.nodeIds.slice().sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function placementStyle(placement: Placement, geometryScale: number): CSSProperties {
  return {
    position: 'absolute',
    left: placement.x * geometryScale,
    top: placement.y * geometryScale,
    width: placement.width * geometryScale,
    height: placement.height * geometryScale,
    zIndex: placement.z_index ?? 1,
    minWidth: 0,
    minHeight: 0,
  };
}

function nodeStyle(node: UINode): CSSProperties {
  const style: CSSProperties = {};
  if (node.layout?.width) style.width = sizeToCss(node.layout.width);
  if (node.layout?.height) style.height = sizeToCss(node.layout.height);
  if (node.layout?.min_width) style.minWidth = sizeToCss(node.layout.min_width);
  if (node.layout?.max_width) style.maxWidth = sizeToCss(node.layout.max_width);
  return style;
}

function childrenLayoutStyle(node: UINode, hasChildren: boolean): CSSProperties {
  if (node.type === 'app_shell' && node.layout?.mode !== 'auto') return {};
  return layoutToStyle(node.layout, node.type, hasChildren);
}

function layoutToStyle(layout: Layout | undefined, type: ResolvedComponentType, hasChildren: boolean): CSSProperties {
  const style: CSSProperties = {};
  if (layout?.display === 'grid' || type === 'grid') {
    style.display = 'grid';
    style.gridTemplateColumns = layout?.grid?.template ?? `repeat(${layout?.grid?.columns ?? 3}, minmax(0, 1fr))`;
  } else if (layout?.display === 'flex' || hasChildren) {
    style.display = 'flex';
    style.flexDirection = layout?.direction ?? 'column';
    style.flexWrap = layout?.wrap ? 'wrap' : undefined;
  }
  if (layout?.align) style.alignItems = ({ start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' } as const)[layout.align];
  if (layout?.justify) style.justifyContent = ({ start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between', 'space-around': 'space-around', 'space-evenly': 'space-evenly' } as const)[layout.justify];
  if (layout?.gap) style.gap = `${layout.gap.y ?? layout.gap.x ?? 12}px ${layout.gap.x ?? layout.gap.y ?? 12}px`;
  if (layout?.padding) style.padding = `${layout.padding.top ?? 0}px ${layout.padding.right ?? 0}px ${layout.padding.bottom ?? 0}px ${layout.padding.left ?? 0}px`;
  return style;
}

function nodeTokenStyle(node: UINode, designSystem?: DesignSystem): CSSProperties {
  const token = (group: keyof DesignSystem, name?: string) => {
    const map = designSystem?.[group];
    return name && map && typeof map === 'object' ? (map as Record<string, string>)[name] : undefined;
  };
  return {
    background: token('colors', node.style?.background),
    color: token('colors', node.style?.foreground),
    borderColor: token('colors', node.style?.border),
    font: token('typography', node.style?.typography),
    borderRadius: token('radii', node.style?.radius),
    boxShadow: token('shadows', node.style?.shadow),
    opacity: node.style?.opacity,
  };
}

function sizeToCss(size: Size) {
  return `${size.value}${size.unit}`;
}

function containerHeader(node: UINode, language: Language, isAppSidebar: boolean) {
  if (['page', 'app_shell', 'stack', 'grid', 'card'].includes(node.type)) return null;
  return (
    <div className="preview-container-title">
      <span>{node.content?.label ?? node.content?.text ?? node.name}</span>
      {node.type === 'sidebar' && <small>{t(language, isAppSidebar ? 'appSidebarLabel' : 'pageSidebarLabel')}</small>}
    </div>
  );
}

function emptyContainer(node: UINode, language: Language, isAppSidebar: boolean) {
  const text = node.type === 'sidebar'
    ? t(language, isAppSidebar ? 'navigationItems' : 'pageSidebarItems')
    : t(language, 'dropComponents');
  return <div className="preview-empty-slot">{text}</div>;
}

function leafPreview(node: UINode, language: Language) {
  const content = node.content ?? {};
  switch (node.type) {
    case 'heading':
      return <h2 className="mock heading">{content.text ?? node.name}</h2>;
    case 'text':
      return <p className="mock text">{content.text ?? node.name}</p>;
    case 'image':
      return content.src
        ? <img className="mock image" src={content.src} alt={content.alt ?? node.name} />
        : <div className="mock image-placeholder">{content.alt ?? node.name}</div>;
    case 'avatar':
      return <div className="mock avatar">{(content.alt ?? node.name).slice(0, 2).toUpperCase()}</div>;
    case 'icon':
      return <div className="mock icon">{content.icon ?? '●'}</div>;
    case 'badge':
    case 'tag':
      return <span className={`mock ${node.type} ${content.variant ?? ''}`}>{content.text ?? node.name}</span>;
    case 'divider':
      return <hr className="mock divider" />;
    case 'link':
      return <span className="mock link">{content.text ?? node.name}</span>;
    case 'metric_card':
      return <div className="mock metric-card"><span>{content.label ?? node.name}</span><strong>{content.value ?? formatBinding(content.data_binding) ?? '42.8k'}</strong><small>+12.4%</small></div>;
    case 'data_table':
      return <DataTablePreview node={node} language={language} />;
    case 'chart_placeholder':
      return <div className="mock chart"><span>{content.label ?? node.name}</span><div className="chart-bars">{[42, 64, 48, 78, 58, 86, 68, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>;
    case 'calendar':
      return <CalendarPreview language={language} />;
    case 'text_input':
    case 'search_input':
    case 'textarea':
    case 'date_picker':
    case 'file_upload':
      return <label className={`mock input ${node.type}`}><span>{content.label ?? node.name}</span><em>{content.placeholder ?? t(language, 'enterValue')}</em>{content.helper_text && <small>{content.helper_text}</small>}</label>;
    case 'select':
      return <label className="mock input select"><span>{content.label ?? node.name}</span><em>{content.placeholder ?? t(language, 'chooseOption')}</em></label>;
    case 'checkbox':
    case 'toggle':
    case 'radio_group':
      return <div className={`mock choice ${node.type}`}><i /><span>{content.label ?? node.name}</span></div>;
    case 'button':
    case 'icon_button':
      return <div className={`mock button ${content.variant ?? node.style?.variant ?? ''}`}>{content.label ?? content.text ?? node.name}</div>;
    case 'menu':
      return <div className="mock menu-button">{content.label ?? node.name}<span>⌄</span></div>;
    case 'nav_item':
      return <div className="mock nav-item">{content.label ?? node.name}</div>;
    case 'breadcrumb':
      return <div className="mock breadcrumb">{t(language, 'home')} / {content.label ?? node.name}</div>;
    case 'pagination':
      return <div className="mock pagination"><span>1</span><span>2</span><span>3</span></div>;
    default:
      return <div className={`mock generic ${node.type}`}>{content.text ?? content.label ?? node.name}</div>;
  }
}

function DataTablePreview({ node, language }: { node: UINode; language: Language }) {
  const columns = node.content?.columns?.length
    ? node.content.columns
    : [
        { id: 'name', header: t(language, 'defaultColumnName') },
        { id: 'status', header: t(language, 'defaultColumnStatus') },
        { id: 'amount', header: t(language, 'defaultColumnAmount') },
      ];
  return (
    <div className="mock data-table">
      <div className="table-title">{node.content?.label ?? node.name}</div>
      <div className="table-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(72px, 1fr))` }}>
        {columns.map((column) => <strong key={column.id}>{column.header}</strong>)}
        {Array.from({ length: columns.length * 4 }, (_, index) => <span key={index}>{index % columns.length === 0 ? `${t(language, 'row')} ${Math.floor(index / columns.length) + 1}` : '—'}</span>)}
      </div>
    </div>
  );
}

function CalendarPreview({ language }: { language: Language }) {
  const days = language === 'zh-Hant' ? ['一', '二', '三', '四', '五', '六', '日'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return <div className="mock calendar">{days.map((day) => <strong key={day}>{day}</strong>)}{Array.from({ length: 35 }, (_, index) => <span key={index}>{index < 30 ? index + 1 : ''}</span>)}</div>;
}

function formatBinding(binding?: string) {
  if (!binding) return null;
  return (binding.split('.').at(-1) ?? binding).replace(/_/g, ' ');
}

function IconButton({ icon, label, disabled, onClick }: { icon: React.ReactNode; label: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()) || target.isContentEditable;
}

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
