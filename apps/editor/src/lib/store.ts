// In-memory state for the editor. Kept simple: useState in App.tsx is enough for the MVP.
// This file holds the immutable operations (add node, delete node, update node) so the
// App component stays focused on layout.

import type {
  Blueprint,
  UINode,
  ComponentType,
  Layout,
  Placement,
  Viewport,
  ViewportId,
} from '../types';
import { isContainerType } from './registry';

// Viewport dimension bounds mirror schema/ui-blueprint.schema.json ($defs.viewport).
export const VIEWPORT_MIN_WIDTH = 320;
export const VIEWPORT_MAX_WIDTH = 7680;
export const VIEWPORT_MIN_HEIGHT = 320;
export const VIEWPORT_MAX_HEIGHT = 4320;

export interface ResolutionPreset {
  id: string;
  group: 'desktop' | 'tablet' | 'mobile';
  width: number;
  height: number;
}

// Common device resolutions offered as one-click presets. Free numeric input
// remains available for anything not listed here.
export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: 'desktop-1440', group: 'desktop', width: 1440, height: 900 },
  { id: 'desktop-fhd', group: 'desktop', width: 1920, height: 1080 },
  { id: 'desktop-1366', group: 'desktop', width: 1366, height: 768 },
  { id: 'desktop-1280', group: 'desktop', width: 1280, height: 800 },
  { id: 'desktop-macbook', group: 'desktop', width: 1512, height: 982 },
  { id: 'tablet-ipad', group: 'tablet', width: 1024, height: 768 },
  { id: 'tablet-ipad-portrait', group: 'tablet', width: 834, height: 1112 },
  { id: 'tablet-surface', group: 'tablet', width: 1368, height: 912 },
  { id: 'mobile-iphone', group: 'mobile', width: 390, height: 844 },
  { id: 'mobile-iphone-max', group: 'mobile', width: 430, height: 932 },
  { id: 'mobile-android', group: 'mobile', width: 360, height: 800 },
  { id: 'mobile-pixel', group: 'mobile', width: 412, height: 915 },
];

export function clampViewportWidth(value: number): number {
  if (!Number.isFinite(value)) return VIEWPORT_MIN_WIDTH;
  return Math.round(Math.max(VIEWPORT_MIN_WIDTH, Math.min(VIEWPORT_MAX_WIDTH, value)));
}

export function clampViewportHeight(value: number): number {
  if (!Number.isFinite(value)) return VIEWPORT_MIN_HEIGHT;
  return Math.round(Math.max(VIEWPORT_MIN_HEIGHT, Math.min(VIEWPORT_MAX_HEIGHT, value)));
}

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** Create a new node with sensible defaults based on its component type. */
export function createNode(type: ComponentType, roleHint?: string, nameHint?: string): UINode {
  const id = genId(type);
  const layout = defaultEditorLayoutForType(type);
  const base: UINode = {
    id,
    type,
    name: nameHint ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role: roleHint ?? `${type} added by editor`,
    parent_id: null,
    children: [],
    ...(layout ? { layout } : {}),
    ...defaultContentForType(type),
  };
  return base;
}

function defaultEditorLayoutForType(type: ComponentType): Layout | undefined {
  if (type === 'page' || type === 'section' || type === 'card') {
    return { mode: 'freeform' };
  }
  return defaultLayoutForType(type);
}

/** Default child arrangement for every registered container type. */
export function defaultLayoutForType(type: ComponentType): Layout | undefined {
  switch (type) {
    case 'grid':
      return {
        mode: 'auto',
        display: 'grid',
        grid: { columns: 3 },
        align: 'stretch',
        gap: { x: 12, y: 12 },
      };
    case 'split_pane':
      return {
        mode: 'auto',
        display: 'grid',
        grid: { columns: 2 },
        align: 'stretch',
        gap: { x: 16, y: 16 },
      };
    case 'header':
    case 'top_bar':
    case 'bottom_nav':
    case 'toolbar':
    case 'button_group':
    case 'tabs':
    case 'stepper':
      return {
        mode: 'auto',
        display: 'flex',
        direction: 'row',
        wrap: true,
        align: 'center',
        gap: { x: 8, y: 8 },
      };
    case 'app_shell':
      return {
        mode: 'freeform',
      };
    case 'page':
    case 'section':
    case 'sidebar':
    case 'stack':
    case 'scroll_area':
    case 'list':
    case 'detail_panel':
    case 'timeline':
    case 'activity_feed':
    case 'form':
    case 'field_group':
    case 'menu':
    case 'command_palette':
    case 'modal':
    case 'drawer':
    case 'card':
    case 'kanban_board':
    case 'kanban_column':
    case 'rich_text_editor':
      return {
        mode: 'auto',
        display: 'flex',
        direction: 'column',
        align: 'stretch',
        gap: { x: 12, y: 12 },
      };
    default:
      return undefined;
  }
}

export function defaultPlacementForType(
  type: ComponentType,
  position: { x: number; y: number } = { x: 32, y: 32 }
): Placement {
  const sizes: Partial<Record<ComponentType, { width: number; height: number }>> = {
    sidebar: { width: 240, height: 640 },
    top_bar: { width: 720, height: 64 },
    bottom_nav: { width: 390, height: 64 },
    section: { width: 520, height: 240 },
    card: { width: 280, height: 180 },
    metric_card: { width: 220, height: 120 },
    data_table: { width: 560, height: 300 },
    chart_placeholder: { width: 420, height: 240 },
    form: { width: 420, height: 440 },
    text_input: { width: 240, height: 64 },
    search_input: { width: 280, height: 44 },
    textarea: { width: 280, height: 120 },
    button: { width: 120, height: 44 },
    icon_button: { width: 44, height: 44 },
    heading: { width: 360, height: 48 },
    text: { width: 360, height: 72 },
    image: { width: 320, height: 200 },
    avatar: { width: 48, height: 48 },
    badge: { width: 80, height: 28 },
    tag: { width: 88, height: 30 },
    divider: { width: 320, height: 1 },
    calendar: { width: 560, height: 420 },
    kanban_board: { width: 840, height: 520 },
    kanban_column: { width: 260, height: 460 },
    rich_text_editor: { width: 620, height: 480 },
  };
  const size = sizes[type] ?? { width: 240, height: 120 };
  return { ...position, ...size, z_index: 1 };
}

/** Find a node by id in a blueprint (depth-first). */
export function findNode(blueprint: Blueprint, id: string): UINode | undefined {
  return blueprint.nodes.find((n) => n.id === id);
}

/** Find the root node (parent_id === null). */
export function findRoot(blueprint: Blueprint): UINode | undefined {
  return blueprint.nodes.find((n) => n.parent_id === null);
}

/** Add a node to the blueprint. If parentId is null, append to root. */
export function addNode(blueprint: Blueprint, node: UINode, parentId: string | null = null): Blueprint {
  const root = findRoot(blueprint);
  if (!root) {
    return { ...blueprint, nodes: [{ ...node, parent_id: null }] };
  }
  const target = parentId ?? root.id;
  const updated: Blueprint = {
    ...blueprint,
    nodes: [...blueprint.nodes, { ...node, parent_id: target }],
  };
  const newTarget = blueprint.nodes.find((n) => n.id === target);
  if (newTarget && !newTarget.children?.includes(node.id)) {
    const next = { ...newTarget, children: [...(newTarget.children ?? []), node.id] };
    updated.nodes = updated.nodes.map((n) => (n.id === target ? next : n));
  }
  return updated;
}

/** Wrap an existing root in an app shell and place a semantic shell slot beside it. */
export function wrapRootInAppShell(blueprint: Blueprint, shell: UINode, slot: UINode): Blueprint {
  const root = findRoot(blueprint);
  if (!root) {
    return {
      ...blueprint,
      nodes: [
        { ...shell, parent_id: null, children: [slot.id] },
        { ...slot, parent_id: shell.id },
      ],
    };
  }

  return {
    ...blueprint,
    nodes: [
      {
        ...shell,
        parent_id: null,
        children: [slot.id, root.id],
      },
      ...blueprint.nodes.map((node) => (
        node.id === root.id ? { ...node, parent_id: shell.id } : node
      )),
      {
        ...slot,
        parent_id: shell.id,
      },
    ],
  };
}

/** Delete a node and all its descendants. Promotes nothing — just removes. */
export function deleteNode(blueprint: Blueprint, id: string): Blueprint {
  const toRemove = new Set<string>();
  const walk = (nid: string) => {
    toRemove.add(nid);
    const n = blueprint.nodes.find((nn) => nn.id === nid);
    if (n?.children) for (const cid of n.children) walk(cid);
  };
  walk(id);
  // Also remove from any parent's children array
  const nodes = blueprint.nodes
    .filter((n) => !toRemove.has(n.id))
    .map((n) =>
      n.children ? { ...n, children: n.children.filter((c) => !toRemove.has(c)) } : n
    );
  return { ...blueprint, nodes };
}

/** Patch a node's editable scalar fields. */
export function updateNode(blueprint: Blueprint, id: string, patch: Partial<UINode>): Blueprint {
  return {
    ...blueprint,
    nodes: blueprint.nodes.map((n) => (n.id === id ? { ...n, ...patch, id: n.id } : n)),
  };
}

export function updateNodePlacement(
  blueprint: Blueprint,
  id: string,
  viewportId: ViewportId,
  patch: Partial<Placement>
): Blueprint {
  const node = findNode(blueprint, id);
  if (!node) return blueprint;
  const current = node.placements?.[viewportId]
    ?? node.placements?.desktop
    ?? defaultPlacementForType(node.type);
  const viewport = blueprint.viewports.find((candidate) => candidate.id === viewportId);
  const width = Math.max(1, Math.min(
    patch.width ?? current.width,
    viewport?.width ?? Number.POSITIVE_INFINITY
  ));
  const height = Math.max(1, patch.height ?? current.height);
  const x = Math.max(0, Math.min(
    patch.x ?? current.x,
    viewport ? Math.max(0, viewport.width - width) : Number.POSITIVE_INFINITY
  ));
  const y = Math.max(0, patch.y ?? current.y);
  return updateNode(blueprint, id, {
    placements: {
      ...node.placements,
      [viewportId]: {
        ...current,
        ...patch,
        x,
        y,
        width,
        height,
      },
    },
  });
}

export function updateManyPlacements(
  blueprint: Blueprint,
  updates: Array<{ id: string; viewportId: ViewportId; patch: Partial<Placement> }>
): Blueprint {
  return updates.reduce(
    (current, update) => updateNodePlacement(current, update.id, update.viewportId, update.patch),
    blueprint
  );
}

// Resize a viewport (canvas resolution). Width/height are clamped to the schema
// bounds. Any placement that would overflow the new width is pulled back in so
// the blueprint stays valid.
export function setViewportSize(
  blueprint: Blueprint,
  viewportId: ViewportId,
  size: { width?: number; height?: number }
): Blueprint {
  const existing = blueprint.viewports.find((candidate) => candidate.id === viewportId);
  if (!existing) return blueprint;

  const width = size.width != null ? clampViewportWidth(size.width) : existing.width;
  const height = size.height != null ? clampViewportHeight(size.height) : existing.height;
  if (width === existing.width && height === existing.height) return blueprint;

  const viewports = blueprint.viewports.map((candidate) =>
    candidate.id === viewportId ? { ...candidate, width, height } : candidate
  );

  const nodes = blueprint.nodes.map((node) => {
    const placement = node.placements?.[viewportId];
    if (!placement) return node;
    const clampedWidth = Math.max(1, Math.min(placement.width, width));
    const clampedX = Math.max(0, Math.min(placement.x, Math.max(0, width - clampedWidth)));
    if (clampedWidth === placement.width && clampedX === placement.x) return node;
    return {
      ...node,
      placements: {
        ...node.placements,
        [viewportId]: { ...placement, width: clampedWidth, x: clampedX },
      },
    };
  });

  return { ...blueprint, viewports, nodes };
}

export function findViewport(blueprint: Blueprint, viewportId: ViewportId): Viewport | undefined {
  return blueprint.viewports.find((candidate) => candidate.id === viewportId);
}

export function reparentNode(
  blueprint: Blueprint,
  id: string,
  parentId: string,
  index?: number
): Blueprint {
  const node = findNode(blueprint, id);
  const parent = findNode(blueprint, parentId);
  if (!node || !parent || !isContainerType(parent.type) || node.parent_id === null || id === parentId) {
    return blueprint;
  }
  if (isDescendant(blueprint, parentId, id)) return blueprint;

  const nextNodes = blueprint.nodes.map((candidate) => {
    if (candidate.id === node.parent_id) {
      return {
        ...candidate,
        children: (candidate.children ?? []).filter((childId) => childId !== id),
      };
    }
    if (candidate.id === parentId) {
      const children = (candidate.children ?? []).filter((childId) => childId !== id);
      children.splice(Math.max(0, Math.min(index ?? children.length, children.length)), 0, id);
      return { ...candidate, children };
    }
    if (candidate.id === id) {
      return {
        ...candidate,
        parent_id: parentId,
        ...(parent.layout?.mode === 'freeform'
          ? { placements: completePlacements(blueprint, candidate) }
          : {}),
      };
    }
    return candidate;
  });
  return { ...blueprint, nodes: nextNodes };
}

export function reorderChild(
  blueprint: Blueprint,
  parentId: string,
  id: string,
  nextIndex: number
): Blueprint {
  const parent = findNode(blueprint, parentId);
  if (!parent?.children?.includes(id)) return blueprint;
  const children = parent.children.filter((childId) => childId !== id);
  children.splice(Math.max(0, Math.min(nextIndex, children.length)), 0, id);
  return updateNode(blueprint, parentId, { children });
}

export function duplicateNodes(
  blueprint: Blueprint,
  ids: string[],
  duplicateName: (name: string) => string = (name) => `${name} Copy`
): { blueprint: Blueprint; ids: string[] } {
  const duplicableIds = ids.filter((id) => findNode(blueprint, id)?.parent_id !== null);
  const selected = new Set(duplicableIds);
  const roots = duplicableIds.filter((id) => {
    const node = findNode(blueprint, id);
    return node && !selected.has(node.parent_id ?? '');
  });
  const idMap = new Map<string, string>();
  const clonedNodes: UINode[] = [];

  function cloneSubtree(id: string, parentOverride?: string) {
    const source = findNode(blueprint, id);
    if (!source) return;
    const nextId = genId(source.type);
    idMap.set(id, nextId);
    const children = source.children ?? [];
    const clone: UINode = {
      ...structuredClone(source),
      id: nextId,
      name: duplicateName(source.name),
      parent_id: parentOverride ?? source.parent_id,
      children: [],
      placements: offsetPlacements(source.placements),
    };
    clonedNodes.push(clone);
    for (const childId of children) cloneSubtree(childId, nextId);
    clone.children = children.map((childId) => idMap.get(childId)).filter((childId): childId is string => Boolean(childId));
  }

  for (const id of roots) cloneSubtree(id);
  let next = { ...blueprint, nodes: [...blueprint.nodes, ...clonedNodes] };
  for (const rootId of roots) {
    const source = findNode(blueprint, rootId);
    const cloneId = idMap.get(rootId);
    if (!source?.parent_id || !cloneId) continue;
    const parent = findNode(next, source.parent_id);
    next = updateNode(next, source.parent_id, {
      children: [...(parent?.children ?? []), cloneId],
    });
  }
  return {
    blueprint: next,
    ids: roots.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)),
  };
}

export function setNodeZIndex(
  blueprint: Blueprint,
  ids: string[],
  viewportId: ViewportId,
  direction: 'front' | 'back'
): Blueprint {
  const selected = ids
    .map((id) => findNode(blueprint, id))
    .filter((node): node is UINode => Boolean(node));
  const groups = new Map<string | null, UINode[]>();

  for (const node of selected) {
    const group = groups.get(node.parent_id) ?? [];
    group.push(node);
    groups.set(node.parent_id, group);
  }

  let next = blueprint;
  for (const [parentId, group] of groups) {
    const siblings = blueprint.nodes.filter((node) => node.parent_id === parentId);
    const zValues = siblings.map((node) => node.placements?.[viewportId]?.z_index ?? 0);
    const ordered = [...group].sort(
      (a, b) => (a.placements?.[viewportId]?.z_index ?? 0) - (b.placements?.[viewportId]?.z_index ?? 0)
    );
    const base = direction === 'front'
      ? Math.max(0, ...zValues) + 1
      : Math.min(0, ...zValues) - ordered.length;
    next = ordered.reduce(
      (current, node, index) => updateNodePlacement(current, node.id, viewportId, { z_index: base + index }),
      next
    );
  }
  return next;
}

function isDescendant(blueprint: Blueprint, id: string, possibleAncestorId: string): boolean {
  let current = findNode(blueprint, id);
  while (current?.parent_id) {
    if (current.parent_id === possibleAncestorId) return true;
    current = findNode(blueprint, current.parent_id);
  }
  return false;
}

function offsetPlacements(
  placements: UINode['placements']
): UINode['placements'] {
  if (!placements) return undefined;
  return Object.fromEntries(
    Object.entries(placements).map(([viewportId, placement]) => [
      viewportId,
      { ...placement, x: placement.x + 16, y: placement.y + 16 },
    ])
  ) as UINode['placements'];
}

function completePlacements(blueprint: Blueprint, node: UINode): UINode['placements'] {
  const fallback = node.placements?.desktop
    ?? node.placements?.tablet
    ?? node.placements?.mobile
    ?? node.placements?.wide
    ?? defaultPlacementForType(node.type);

  return Object.fromEntries(blueprint.viewports.map((viewport) => {
    const placement = node.placements?.[viewport.id] ?? fallback;
    const width = Math.max(1, Math.min(placement.width, viewport.width));
    const height = Math.max(1, Math.min(placement.height, viewport.height));
    return [
      viewport.id,
      {
        ...placement,
        width,
        height,
        x: Math.max(0, Math.min(placement.x, viewport.width - width)),
        y: Math.max(0, Math.min(placement.y, viewport.height - height)),
      },
    ];
  })) as UINode['placements'];
}

function defaultContentForType(type: ComponentType): Pick<UINode, 'content' | 'style'> {
  const contentByType: Partial<Record<ComponentType, UINode['content']>> = {
    heading: { text: 'Heading' },
    text: { text: 'Text content' },
    image: { src: '', alt: 'Image' },
    icon: { icon: 'circle', label: 'Icon' },
    avatar: { alt: 'Avatar' },
    badge: { text: 'Status', variant: 'success' },
    tag: { text: 'Tag' },
    link: { text: 'Link', action: 'navigate:/' },
    textarea: { label: 'Notes', placeholder: 'Enter details' },
    search_input: { label: 'Search', placeholder: 'Search...', action: 'search' },
    button: { label: 'Button', action: 'click' },
  };
  const styleByType: Partial<Record<ComponentType, UINode['style']>> = {
    heading: { typography: 'heading.section', foreground: 'text.primary' },
    text: { typography: 'body.default', foreground: 'text.secondary' },
    card: { background: 'surface.panel', border: 'border.default', radius: 'radius.panel', shadow: 'shadow.panel' },
    button: { background: 'action.primary', foreground: 'action.primary.text', radius: 'radius.control', variant: 'primary' },
  };
  return {
    ...(contentByType[type] ? { content: contentByType[type] } : {}),
    ...(styleByType[type] ? { style: styleByType[type] } : {}),
  };
}
