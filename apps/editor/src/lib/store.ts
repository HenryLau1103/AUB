// In-memory state for the editor. Kept simple: useState in App.tsx is enough for the MVP.
// This file holds the immutable operations (add node, delete node, update node) so the
// App component stays focused on layout.

import type { Blueprint, UINode, ComponentType } from '../types';

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** Create a new node with sensible defaults based on its component type. */
export function createNode(type: ComponentType, roleHint?: string): UINode {
  const id = genId(type);
  const base: UINode = {
    id,
    type,
    name: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role: roleHint ?? `${type} added by editor`,
    parent_id: null,
    children: [],
  };
  return base;
}

/** Find a node by id in a blueprint (depth-first). */
export function findNode(blueprint: Blueprint, id: string): UINode | undefined {
  return blueprint.nodes.find((n) => n.id === id);
}

/** Find the root node (parent_id === null). */
export function findRoot(blueprint: Blueprint): UINode | undefined {
  return blueprint.nodes.find((n) => n.parent_id === null);
}

/** Add a node to the blueprint. If no root exists, it becomes the root. Otherwise it's appended to the root. */
export function addNode(blueprint: Blueprint, node: UINode): Blueprint {
  const root = findRoot(blueprint);
  if (!root) {
    return { ...blueprint, nodes: [{ ...node, parent_id: null }] };
  }
  const updated: Blueprint = {
    ...blueprint,
    nodes: [...blueprint.nodes, { ...node, parent_id: root.id }],
  };
  if (!root.children?.includes(node.id)) {
    const newRoot = { ...root, children: [...(root.children ?? []), node.id] };
    updated.nodes = updated.nodes.map((n) => (n.id === root.id ? newRoot : n));
  }
  return updated;
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
