// Auto-layout: position React Flow nodes from a Blueprint's parent/child tree.
// Uses a simple tidy-tree algorithm: children of a node are laid out horizontally
// below it, with each subtree sized to fit its widest descendant.

import type { Blueprint, UINode } from '../types';

const NODE_W = 220;
const NODE_H = 90;
const H_GAP = 24;
const V_GAP = 64;

export interface LaidOut {
  nodes: { id: string; position: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string }[];
}

/** Compute positions for every node in the blueprint, plus edges. */
export function layoutTree(blueprint: Blueprint): LaidOut {
  const byId = new Map(blueprint.nodes.map((n) => [n.id, n]));
  const root = blueprint.nodes.find((n) => n.parent_id === null);
  if (!root) return { nodes: [], edges: [] };

  // Build adjacency from parent.children (the canonical structure)
  const childrenOf = new Map<string, string[]>();
  for (const n of blueprint.nodes) {
    if (Array.isArray(n.children)) {
      childrenOf.set(n.id, n.children.filter((c) => byId.has(c)));
    }
  }

  const subtreeWidth = new Map<string, number>();
  function measure(id: string): number {
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) {
      subtreeWidth.set(id, NODE_W);
      return NODE_W;
    }
    const kidsWidth = kids.reduce((sum, k) => sum + measure(k), 0) + H_GAP * (kids.length - 1);
    const w = Math.max(NODE_W, kidsWidth);
    subtreeWidth.set(id, w);
    return w;
  }
  measure(root.id);

  const positions: { id: string; position: { x: number; y: number } }[] = [];
  function place(id: string, leftEdge: number, depth: number) {
    const w = subtreeWidth.get(id) ?? NODE_W;
    const x = leftEdge + w / 2;
    const y = depth * (NODE_H + V_GAP);
    positions.push({ id, position: { x, y } });
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) return;
    const totalKidsWidth = kids.reduce((sum, k) => sum + (subtreeWidth.get(k) ?? NODE_W), 0) + H_GAP * (kids.length - 1);
    let cursor = leftEdge + (w - totalKidsWidth) / 2;
    for (const k of kids) {
      const kw = subtreeWidth.get(k) ?? NODE_W;
      place(k, cursor, depth + 1);
      cursor += kw + H_GAP;
    }
  }
  place(root.id, 0, 0);

  const edges: LaidOut['edges'] = [];
  for (const [parentId, kids] of childrenOf) {
    for (const childId of kids) {
      edges.push({
        id: `e-${parentId}-${childId}`,
        source: parentId,
        target: childId,
      });
    }
  }

  return { nodes: positions, edges };
}

export const LAYOUT = { NODE_W, NODE_H, H_GAP, V_GAP };
