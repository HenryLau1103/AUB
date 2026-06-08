// In-memory state for the editor. Kept simple: useState in App.tsx is enough for the MVP.
// This file holds the immutable operations (add node, delete node, update node) so the
// App component stays focused on layout.

import type { Blueprint, UINode, ComponentType, Layout } from '../types';

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** Create a new node with sensible defaults based on its component type. */
export function createNode(type: ComponentType, roleHint?: string, nameHint?: string): UINode {
  const id = genId(type);
  const layout = defaultLayoutForType(type);
  const base: UINode = {
    id,
    type,
    name: nameHint ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role: roleHint ?? `${type} added by editor`,
    parent_id: null,
    children: [],
    ...(layout ? { layout } : {}),
  };
  return base;
}

/** Default child arrangement for every registered container type. */
export function defaultLayoutForType(type: ComponentType): Layout | undefined {
  switch (type) {
    case 'grid':
      return {
        display: 'grid',
        grid: { columns: 3 },
        align: 'stretch',
        gap: { x: 12, y: 12 },
      };
    case 'split_pane':
      return {
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
        display: 'flex',
        direction: 'row',
        wrap: true,
        align: 'center',
        gap: { x: 8, y: 8 },
      };
    case 'app_shell':
      return undefined;
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
      return {
        display: 'flex',
        direction: 'column',
        align: 'stretch',
        gap: { x: 12, y: 12 },
      };
    default:
      return undefined;
  }
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
