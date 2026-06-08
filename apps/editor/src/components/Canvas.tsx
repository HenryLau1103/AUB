import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { componentLabel, t, viewportLabel, type Language } from '../lib/i18n';
import { getTypeMeta, isContainerType } from '../lib/registry';
import { TEMPLATE_IDS, templateLabel, type TemplateId } from '../lib/templates';
import type { Blueprint, ComponentType, Layout, Size, UINode, Viewport } from '../types';

interface Props {
  blueprint: Blueprint | null;
  selectedId: string | null;
  language: Language;
  onSelect: (id: string | null) => void;
  onAddNode: (type: ComponentType, parentId: string | null, position?: { x: number; y: number }) => void;
  onDeleteNode: (id: string) => void;
  onUpdateNode: (id: string, patch: Partial<UINode>) => void;
  onCreateStarter: (kind: 'page' | 'app') => void;
  onTemplateSelect: (id: TemplateId) => void;
  draggingType: ComponentType | null;
  onDragComplete: () => void;
  propertiesOpen: boolean;
  onPropertiesOpen: () => void;
}

interface TreeContext {
  byId: Map<string, UINode>;
  childrenById: Map<string, UINode[]>;
  root: UINode | null;
}

const FALLBACK_VIEWPORT: Viewport = { id: 'desktop', width: 1440, height: 900 };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

export function Canvas({
  blueprint,
  selectedId,
  language,
  onSelect,
  onAddNode,
  onDeleteNode,
  onCreateStarter,
  onTemplateSelect,
  draggingType,
  onDragComplete,
  propertiesOpen,
  onPropertiesOpen,
}: Props) {
  const [viewportId, setViewportId] = useState<Viewport['id']>('desktop');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const dragHandledRef = useRef(false);

  const tree = useMemo(() => (blueprint ? buildTree(blueprint) : null), [blueprint]);
  const viewports = blueprint?.viewports.length ? blueprint.viewports : [FALLBACK_VIEWPORT];
  const activeViewport = viewports.find((v) => v.id === viewportId) ?? viewports[0] ?? FALLBACK_VIEWPORT;
  const artboardMetrics = getArtboardMetrics(activeViewport);
  const selectedNode = selectedId && tree ? tree.byId.get(selectedId) ?? null : null;

  useEffect(() => {
    if (draggingType) dragHandledRef.current = false;
  }, [draggingType]);

  useEffect(() => {
    if (!draggingType) return;

    function completeDragAtPoint(x: number, y: number) {
      if (dragHandledRef.current) return;
      const element = document.elementFromPoint(x, y);
      if (element instanceof HTMLElement && element.closest('.canvas')) {
        addDraggedTypeFromElement(element);
        return;
      }
      onDragComplete();
    }

    function handleWindowPointerUp(e: PointerEvent) {
      completeDragAtPoint(e.clientX, e.clientY);
    }

    function handleWindowMouseUp(e: MouseEvent) {
      completeDragAtPoint(e.clientX, e.clientY);
    }

    function handleWindowTouchEnd(e: TouchEvent) {
      const touch = e.changedTouches[0];
      if (touch) completeDragAtPoint(touch.clientX, touch.clientY);
      else onDragComplete();
    }

    function handleWindowDragEnd(e: DragEvent) {
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (element instanceof HTMLElement && element.closest('.canvas')) {
        addDraggedTypeFromElement(element);
        return;
      }
      onDragComplete();
    }

    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchend', handleWindowTouchEnd);
    window.addEventListener('dragend', handleWindowDragEnd);
    window.addEventListener('pointercancel', onDragComplete);
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('dragend', handleWindowDragEnd);
      window.removeEventListener('pointercancel', onDragComplete);
    };
  }, [draggingType, onDragComplete]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedId || !selectedNode || selectedNode.parent_id === null) return;
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (isTextEditingTarget(e.target)) return;
      e.preventDefault();
      onDeleteNode(selectedId);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedNode, onDeleteNode]);

  function handleDropOnCanvas(e: React.DragEvent) {
    e.preventDefault();
    const type = readDropType(e, draggingType);
    if (!type) {
      onDragComplete();
      return;
    }
    if (dragHandledRef.current) return;
    dragHandledRef.current = true;
    const parentId = selectedNode && isContainerNode(selectedNode)
      ? selectedNode.id
      : tree?.root?.id ?? null;
    onAddNode(type, parentId);
    setDropTargetId(null);
    onDragComplete();
  }

  function addDraggedTypeFromElement(element: HTMLElement) {
    if (!draggingType || dragHandledRef.current) return;
    dragHandledRef.current = true;
    const hoveredNodeId = element.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null;
    const hoveredNode = hoveredNodeId ? tree?.byId.get(hoveredNodeId) ?? null : null;
    const parentId = hoveredNode && isContainerNode(hoveredNode)
      ? hoveredNode.id
      : selectedNode && isContainerNode(selectedNode)
        ? selectedNode.id
        : tree?.root?.id ?? null;
    onAddNode(draggingType, parentId);
    setDropTargetId(null);
    onDragComplete();
  }

  function addDraggedTypeToCanvas(e: React.PointerEvent<HTMLElement>) {
    if (e.target instanceof HTMLElement) addDraggedTypeFromElement(e.target);
  }

  function updateZoom(nextZoom: number) {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoom.toFixed(2)))));
  }

  if (!blueprint || !tree?.root) {
    return (
      <section
        className={`panel canvas canvas-empty${draggingType ? ' drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const type = readDropType(e, draggingType);
          if (type && !dragHandledRef.current) {
            dragHandledRef.current = true;
            onAddNode(type, null);
          }
          onDragComplete();
        }}
        onPointerUp={addDraggedTypeToCanvas}
      >
        {!propertiesOpen && (
          <button type="button" className="properties-reopen-button" onClick={onPropertiesOpen}>
            {t(language, 'showProperties')}
          </button>
        )}
        {draggingType && (
          <div className="canvas-drop-hint">
            {t(language, 'releaseToAdd', { component: componentLabel(language, draggingType) })}
          </div>
        )}
        <div className="empty-artboard start-artboard">
          <div className="start-heading">
            <h2>{t(language, 'startTitle')}</h2>
            <p>{t(language, 'startPrompt')}</p>
          </div>
          <div className="start-options">
            <button type="button" className="start-option" onClick={() => onCreateStarter('page')}>
              <strong>{t(language, 'startPage')}</strong>
              <span>{t(language, 'startPagePath')}</span>
            </button>
            <button type="button" className="start-option" onClick={() => onCreateStarter('app')}>
              <strong>{t(language, 'startApp')}</strong>
              <span>{t(language, 'startAppPath')}</span>
            </button>
          </div>
          <div className="start-templates">
            <span>{t(language, 'startFromTemplate')}</span>
            <div>
              {TEMPLATE_IDS.map((templateId) => (
                <button key={templateId} type="button" onClick={() => onTemplateSelect(templateId)}>
                  {templateLabel(language, templateId)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`panel canvas${draggingType ? ' drag-active' : ''}`}
      onClick={() => onSelect(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDropOnCanvas}
      onPointerUp={addDraggedTypeToCanvas}
    >
      <div className="canvas-toolbar" onClick={(e) => e.stopPropagation()}>
        <div>
          <strong>{blueprint.screen.name}</strong>
          <span>{activeViewport.width} x {activeViewport.height}</span>
        </div>
        <div className="viewport-tabs" aria-label="Viewport">
          {viewports.map((viewport) => (
            <button
              key={viewport.id}
              type="button"
              className={viewport.id === activeViewport.id ? 'active' : ''}
              onClick={() => setViewportId(viewport.id)}
            >
              {viewportLabel(language, viewport.id)}
            </button>
          ))}
        </div>
        <div className="zoom-controls" aria-label={t(language, 'zoom')}>
          <span className="zoom-label">{t(language, 'zoom')}</span>
          <button
            type="button"
            onClick={() => updateZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            title={t(language, 'zoomOut')}
          >
            -
          </button>
          <input
            aria-label={t(language, 'zoom')}
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(e) => updateZoom(Number(e.target.value))}
          />
          <button
            type="button"
            onClick={() => updateZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            title={t(language, 'zoomIn')}
          >
            +
          </button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        {!propertiesOpen && (
          <button type="button" className="properties-toolbar-button" onClick={onPropertiesOpen}>
            {t(language, 'showProperties')}
          </button>
        )}
      </div>

      {draggingType && (
        <div className="canvas-drop-hint">
          {t(language, 'releaseToAdd', { component: componentLabel(language, draggingType) })}
        </div>
      )}
      <div className="artboard-stage">
        <div
          className="artboard-zoom-shell"
          style={{
            width: artboardMetrics.width * zoom,
            height: artboardMetrics.height * zoom,
          }}
        >
          <div
            className={`artboard artboard-${activeViewport.id}`}
            style={{
              width: artboardMetrics.width,
              height: artboardMetrics.height,
              transform: `scale(${zoom})`,
            }}
          >
            <PreviewNode
              node={tree.root}
              tree={tree}
              selectedId={selectedId}
              dropTargetId={dropTargetId}
              isRoot
              language={language}
              onSelect={onSelect}
              onDeleteNode={onDeleteNode}
              onDropType={(type, parentId) => {
                if (dragHandledRef.current) return;
                dragHandledRef.current = true;
                onAddNode(type, parentId);
              }}
              onDropTargetChange={setDropTargetId}
              draggingType={draggingType}
              onDragComplete={onDragComplete}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewNode({
  node,
  tree,
  selectedId,
  dropTargetId,
  isRoot = false,
  language,
  onSelect,
  onDeleteNode,
  onDropType,
  onDropTargetChange,
  draggingType,
  onDragComplete,
}: {
  node: UINode;
  tree: TreeContext;
  selectedId: string | null;
  dropTargetId: string | null;
  isRoot?: boolean;
  language: Language;
  onSelect: (id: string | null) => void;
  onDeleteNode: (id: string) => void;
  onDropType: (type: ComponentType, parentId: string) => void;
  onDropTargetChange: (id: string | null) => void;
  draggingType: ComponentType | null;
  onDragComplete: () => void;
}) {
  const children = tree.childrenById.get(node.id) ?? [];
  const canContain = isContainerNode(node);
  const renderAsLeaf = canContain && shouldRenderContainerAsControl(node, children);
  const selected = selectedId === node.id;
  const isDropTarget = dropTargetId === node.id;
  const style = nodeStyle(node, children.length > 0);
  const childrenStyle = canContain && !renderAsLeaf ? childrenLayoutStyle(node, children.length > 0) : undefined;
  const shellChildren = node.type === 'app_shell' ? partitionAppShellChildren(children) : null;
  const parentNode = node.parent_id ? tree.byId.get(node.parent_id) ?? null : null;
  const isAppSidebar = node.type === 'sidebar' && parentNode?.type === 'app_shell';
  const isRowLayout = node.layout?.display === 'flex' && node.layout.direction === 'row';

  function handleDragOver(e: React.DragEvent) {
    if (!canContain) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    onDropTargetChange(node.id);
  }

  function handleDrop(e: React.DragEvent) {
    if (!canContain) return;
    e.preventDefault();
    e.stopPropagation();
    const type = readDropType(e, draggingType);
    if (type) onDropType(type, node.id);
    onDropTargetChange(null);
    onDragComplete();
  }

  function renderChild(child: UINode): JSX.Element {
    return (
      <PreviewNode
        key={child.id}
        node={child}
        tree={tree}
        selectedId={selectedId}
        dropTargetId={dropTargetId}
        language={language}
        onSelect={onSelect}
        onDeleteNode={onDeleteNode}
        onDropType={onDropType}
        onDropTargetChange={onDropTargetChange}
        draggingType={draggingType}
        onDragComplete={onDragComplete}
      />
    );
  }

  return (
    <div
      className={[
        'preview-node',
        `preview-${node.type}`,
        selected ? 'selected' : '',
        isRoot ? 'is-root' : '',
        canContain ? 'can-contain' : 'is-leaf',
        isDropTarget ? 'drop-target' : '',
        node.type === 'sidebar' ? (isAppSidebar ? 'app-sidebar' : 'page-sidebar') : '',
      ].filter(Boolean).join(' ')}
      data-type={node.type}
      data-node-id={node.id}
      data-name={node.name}
      style={style}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) onDropTargetChange(null);
      }}
      onDrop={handleDrop}
      title={`${node.name} (${node.type})`}
    >
      {!isRoot && node.parent_id !== null && (
        <button
          type="button"
          className="preview-delete-button"
          aria-label={`${t(language, 'delete')} ${node.name}`}
          title={t(language, 'deleteComponent')}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteNode(node.id);
          }}
        >
          {t(language, 'delete')}
        </button>
      )}

      {canContain && !renderAsLeaf ? (
        <>
          {containerHeader(node, language, isAppSidebar)}
          <div className={`preview-children${isRowLayout ? ' layout-row' : ''}`} style={childrenStyle}>
            {children.length > 0 ? (
              shellChildren ? (
                <>
                  {shellChildren.slotted.map(renderChild)}
                  {shellChildren.loose.length > 0 && (
                    <div
                      className={[
                        'preview-app-main-fallback',
                        shellChildren.hasMainSlot ? 'has-main-slot' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="preview-app-main-label">{t(language, 'mainDropArea')}</div>
                      <div className="preview-app-main-items">
                        {shellChildren.loose.map(renderChild)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                children.map(renderChild)
              )
            ) : (
              emptyContainer(node, language, isAppSidebar)
            )}
          </div>
        </>
      ) : (
        leafPreview(node, language)
      )}
    </div>
  );
}

function buildTree(blueprint: Blueprint): TreeContext {
  const byId = new Map(blueprint.nodes.map((node) => [node.id, node]));
  const root = blueprint.nodes.find((node) => node.parent_id === null) ?? null;
  const childrenById = new Map<string, UINode[]>();

  for (const node of blueprint.nodes) {
    if (!node.parent_id) continue;
    const list = childrenById.get(node.parent_id) ?? [];
    list.push(node);
    childrenById.set(node.parent_id, list);
  }

  for (const node of blueprint.nodes) {
    const declared = (node.children ?? [])
      .map((id) => byId.get(id))
      .filter((child): child is UINode => Boolean(child));
    const actual = childrenById.get(node.id) ?? [];
    const declaredIds = new Set(declared.map((child) => child.id));
    childrenById.set(node.id, [
      ...declared,
      ...actual.filter((child) => !declaredIds.has(child.id)),
    ]);
  }

  return { byId, childrenById, root };
}

function readDropType(e: React.DragEvent, fallback: ComponentType | null): ComponentType | null {
  const rawType = e.dataTransfer.getData('application/aub-component-type')
    || e.dataTransfer.getData('text/plain')
    || fallback
    || '';
  const type = rawType as ComponentType;
  return getTypeMeta(type) ? type : null;
}

function isContainerNode(node: UINode): boolean {
  return isContainerType(node.type);
}

function shouldRenderContainerAsControl(node: UINode, children: UINode[]): boolean {
  return node.type === 'menu' && children.length === 0;
}

function partitionAppShellChildren(children: UINode[]): { slotted: UINode[]; loose: UINode[]; hasMainSlot: boolean } {
  const mainSlotTypes = new Set<ComponentType>(['page', 'section', 'scroll_area']);
  const shellSlotTypes = new Set<ComponentType>(['sidebar', 'top_bar', 'header', 'bottom_nav', ...mainSlotTypes]);
  const slotted = children.filter((child) => shellSlotTypes.has(child.type));
  const loose = children.filter((child) => !shellSlotTypes.has(child.type));
  return {
    slotted,
    loose,
    hasMainSlot: slotted.some((child) => mainSlotTypes.has(child.type)),
  };
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

function getArtboardMetrics(viewport: Viewport): { width: number; height: number } {
  const width = viewport.id === 'mobile' ? 390 : viewport.id === 'tablet' ? 820 : 1120;
  return {
    width,
    height: Math.round(width * (viewport.height / viewport.width)),
  };
}

function nodeStyle(node: UINode, hasChildren: boolean): CSSProperties {
  const layout = node.layout;
  const style: CSSProperties = {};

  if (layout?.width) style.width = sizeToCss(layout.width);
  if (layout?.height) style.height = sizeToCss(layout.height);
  if (layout?.min_width) style.minWidth = sizeToCss(layout.min_width);
  if (layout?.max_width) style.maxWidth = sizeToCss(layout.max_width);

  return style;
}

function childrenLayoutStyle(node: UINode, hasChildren: boolean): CSSProperties {
  if (node.type === 'app_shell') return {};
  return layoutToStyle(node.layout, node.type, hasChildren);
}

function layoutToStyle(layout: Layout | undefined, type: ComponentType, hasChildren: boolean): CSSProperties {
  const style: CSSProperties = {};
  const display = layout?.display;

  if (display === 'grid') {
    style.display = 'grid';
    style.gridTemplateColumns = layout?.grid?.template ?? `repeat(${layout?.grid?.columns ?? 2}, minmax(0, 1fr))`;
    if (layout?.grid?.rows) style.gridTemplateRows = `repeat(${layout.grid.rows}, minmax(0, auto))`;
  } else if (
    display === 'flex' ||
    type === 'stack' ||
    type === 'top_bar' ||
    type === 'header' ||
    type === 'bottom_nav' ||
    type === 'toolbar' ||
    type === 'button_group' ||
    type === 'menu'
  ) {
    style.display = 'flex';
    style.flexDirection = layout?.direction ?? (type === 'stack' ? 'column' : 'row');
    style.flexWrap = layout?.wrap ? 'wrap' : undefined;
  } else if (type === 'grid') {
    style.display = 'grid';
    style.gridTemplateColumns = `repeat(${layout?.grid?.columns ?? 3}, minmax(0, 1fr))`;
  } else if (hasChildren) {
    style.display = 'flex';
    style.flexDirection = 'column';
  }

  if (layout?.align) style.alignItems = alignToCss(layout.align);
  if (layout?.justify) style.justifyContent = justifyToCss(layout.justify);
  if (layout?.gap) style.gap = `${layout.gap.y ?? layout.gap.x ?? 12}px ${layout.gap.x ?? layout.gap.y ?? 12}px`;
  if (layout?.padding) {
    style.padding = `${layout.padding.top ?? 0}px ${layout.padding.right ?? 0}px ${layout.padding.bottom ?? 0}px ${layout.padding.left ?? 0}px`;
  }

  return style;
}

function alignToCss(value: NonNullable<Layout['align']>): CSSProperties['alignItems'] {
  const map = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' } as const;
  return map[value];
}

function justifyToCss(value: NonNullable<Layout['justify']>): CSSProperties['justifyContent'] {
  const map = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    'space-between': 'space-between',
    'space-around': 'space-around',
    'space-evenly': 'space-evenly',
  } as const;
  return map[value];
}

function sizeToCss(size: Size): string {
  return `${size.value}${size.unit}`;
}

function containerHeader(node: UINode, language: Language, isAppSidebar: boolean): JSX.Element | null {
  if (node.type === 'page' || node.type === 'app_shell' || node.type === 'stack' || node.type === 'grid') return null;
  if (node.type === 'sidebar') {
    return (
      <div className="preview-container-title preview-sidebar-title">
        <span>{node.content?.label ?? node.name}</span>
        <small>{t(language, isAppSidebar ? 'appSidebarLabel' : 'pageSidebarLabel')}</small>
      </div>
    );
  }
  if (node.type === 'top_bar' || node.type === 'header') return <div className="preview-container-title">{node.name}</div>;
  if (node.content?.text || node.content?.label) {
    return <div className="preview-container-title">{node.content.text ?? node.content.label}</div>;
  }
  return <div className="preview-container-title">{node.name}</div>;
}

function emptyContainer(node: UINode, language: Language, isAppSidebar: boolean): JSX.Element {
  const text = node.type === 'sidebar'
    ? t(language, isAppSidebar ? 'navigationItems' : 'pageSidebarItems')
    : node.type === 'top_bar'
      ? t(language, 'toolbarItems')
      : t(language, 'dropComponents');
  return <div className="preview-empty-slot">{text}</div>;
}

function leafPreview(node: UINode, language: Language): JSX.Element {
  switch (node.type) {
    case 'metric_card':
      return (
        <div className="mock metric-card">
          <span>{node.content?.label ?? node.name}</span>
          <strong>{node.content?.data_binding ? formatBinding(node.content.data_binding) : '$42.8k'}</strong>
          <small>+12.4%</small>
        </div>
      );
    case 'data_table':
      return <DataTablePreview node={node} language={language} />;
    case 'chart_placeholder':
      return (
        <div className="mock chart">
          <span>{node.content?.label ?? node.name}</span>
          <div className="chart-bars">
            {[42, 64, 48, 78, 58, 86, 68, 92, 72, 84].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      );
    case 'text_input':
    case 'date_picker':
    case 'file_upload':
      return (
        <label className="mock input">
          <span>{node.content?.label ?? node.name}</span>
          <em>{node.content?.placeholder ?? node.content?.text ?? t(language, 'enterValue')}</em>
        </label>
      );
    case 'select':
      return (
        <label className="mock input select">
          <span>{node.content?.label ?? node.name}</span>
          <em>{node.content?.placeholder ?? t(language, 'chooseOption')}</em>
        </label>
      );
    case 'checkbox':
    case 'toggle':
    case 'radio_group':
      return <div className={`mock choice ${node.type}`}><i /><span>{node.content?.label ?? node.name}</span></div>;
    case 'button':
    case 'icon_button':
      return <div className="mock button">{node.content?.label ?? node.content?.text ?? node.name}</div>;
    case 'menu':
      return <div className="mock menu-button">{node.content?.label ?? node.name}<span>v</span></div>;
    case 'nav_item':
      return <div className="mock nav-item">{node.content?.label ?? node.name}</div>;
    case 'breadcrumb':
      return <div className="mock breadcrumb">{t(language, 'home')} / {node.content?.label ?? node.name}</div>;
    case 'pagination':
      return <div className="mock pagination"><span>1</span><span>2</span><span>3</span></div>;
    case 'alert':
    case 'toast':
    case 'empty_state':
    case 'loading_state':
    case 'error_state':
      return <div className={`mock state ${node.type}`}>{node.content?.text ?? node.content?.label ?? node.name}</div>;
    default:
      return <div className="mock generic">{node.content?.text ?? node.content?.label ?? node.name}</div>;
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
        {Array.from({ length: Math.min(columns.length * 4, 20) }, (_, index) => (
          <span key={index}>{index % columns.length === 0 ? `${t(language, 'row')} ${Math.floor(index / columns.length) + 1}` : '-'}</span>
        ))}
      </div>
    </div>
  );
}

function formatBinding(binding: string): string {
  const last = binding.split('.').at(-1) ?? binding;
  return last.replace(/_/g, ' ');
}
