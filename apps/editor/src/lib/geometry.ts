import type { Placement, UINode, ViewportId } from '../types';
import { defaultPlacementForType } from './store';

export function placementFor(node: UINode, viewportId: ViewportId): Placement {
  return node.placements?.[viewportId]
    ?? node.placements?.desktop
    ?? node.placements?.tablet
    ?? node.placements?.mobile
    ?? node.placements?.wide
    ?? defaultPlacementForType(node.type);
}

export function alignPlacements(
  nodes: UINode[],
  viewportId: ViewportId,
  mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): Array<{ id: string; patch: Partial<Placement> }> {
  if (nodes.length < 2) return [];
  const entries = nodes.map((node) => ({ node, placement: placementFor(node, viewportId) }));
  const left = Math.min(...entries.map(({ placement }) => placement.x));
  const right = Math.max(...entries.map(({ placement }) => placement.x + placement.width));
  const top = Math.min(...entries.map(({ placement }) => placement.y));
  const bottom = Math.max(...entries.map(({ placement }) => placement.y + placement.height));
  const center = (left + right) / 2;
  const middle = (top + bottom) / 2;

  return entries.map(({ node, placement }) => {
    switch (mode) {
      case 'left':
        return { id: node.id, patch: { x: left } };
      case 'center':
        return { id: node.id, patch: { x: center - placement.width / 2 } };
      case 'right':
        return { id: node.id, patch: { x: right - placement.width } };
      case 'top':
        return { id: node.id, patch: { y: top } };
      case 'middle':
        return { id: node.id, patch: { y: middle - placement.height / 2 } };
      case 'bottom':
        return { id: node.id, patch: { y: bottom - placement.height } };
    }
  });
}

export function distributePlacements(
  nodes: UINode[],
  viewportId: ViewportId,
  axis: 'horizontal' | 'vertical'
): Array<{ id: string; patch: Partial<Placement> }> {
  if (nodes.length < 3) return [];
  const entries = nodes
    .map((node) => ({ node, placement: placementFor(node, viewportId) }))
    .sort((a, b) => axis === 'horizontal'
      ? a.placement.x - b.placement.x
      : a.placement.y - b.placement.y);
  const first = entries[0]!.placement;
  const last = entries.at(-1)?.placement ?? first;
  const occupied = entries.reduce(
    (sum, entry) => sum + (axis === 'horizontal' ? entry.placement.width : entry.placement.height),
    0
  );
  const span = axis === 'horizontal'
    ? last.x + last.width - first.x
    : last.y + last.height - first.y;
  const gap = Math.max(0, (span - occupied) / (entries.length - 1));
  let cursor = axis === 'horizontal' ? first.x : first.y;

  return entries.map(({ node, placement }) => {
    const patch = axis === 'horizontal' ? { x: cursor } : { y: cursor };
    cursor += (axis === 'horizontal' ? placement.width : placement.height) + gap;
    return { id: node.id, patch };
  });
}

export function clampPlacement(placement: Placement, width: number, height: number): Placement {
  return {
    ...placement,
    width: Math.max(1, Math.min(placement.width, width)),
    height: Math.max(1, Math.min(placement.height, height)),
    x: Math.max(0, Math.min(placement.x, Math.max(0, width - placement.width))),
    y: Math.max(0, Math.min(placement.y, Math.max(0, height - placement.height))),
  };
}
