export function directDragMode({ altKey, currentParentId, destinationId }) {
  return altKey && destinationId && destinationId !== currentParentId
    ? 'reparent'
    : 'move';
}
