export function validateBlueprintSemantics(blueprint, { knownTypes } = {}) {
  const errors = [];
  const nodes = Array.isArray(blueprint?.nodes) ? blueprint.nodes : [];
  const byId = new Map();
  const interactionSources = new Set();

  for (const node of nodes) {
    if (byId.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    byId.set(node.id, node);
    interactionSources.add(node.id);
    for (const item of node.content?.items ?? []) {
      if (item?.id) interactionSources.add(item.id);
    }
  }

  if (knownTypes) {
    for (const node of nodes) {
      const type = node?.type;
      if (typeof type !== 'string') continue;
      const isExtension = type.includes(':');
      const meta = knownTypes.get(type);
      if (!meta) {
        if (isExtension) {
          errors.push(
            `${node.id}: unknown component type "${type}" — declare it in aub.registry.json`
          );
        }
        // Core-looking unknown types are already rejected by the JSON Schema enum.
        continue;
      }
      if (isExtension && !meta.isContainer && (node.children ?? []).length > 0) {
        errors.push(
          `${node.id}: extension type "${type}" is a leaf (isContainer:false) but declares children`
        );
      }
    }
  }

  const roots = nodes.filter((node) => node.parent_id == null);
  if (roots.length !== 1) errors.push(`expected exactly one root node, found ${roots.length}`);

  for (const node of nodes) {
    if (node.parent_id != null && !byId.has(node.parent_id)) {
      errors.push(`${node.id}: parent_id references missing node ${node.parent_id}`);
    } else if (node.parent_id != null) {
      const parent = byId.get(node.parent_id);
      if (!(parent.children ?? []).includes(node.id)) {
        errors.push(`${node.id}: parent ${node.parent_id} does not declare it in children`);
      }
    }
    for (const childId of node.children ?? []) {
      const child = byId.get(childId);
      if (!child) {
        errors.push(`${node.id}: children references missing node ${childId}`);
      } else if (child.parent_id !== node.id) {
        errors.push(`${node.id}: child ${childId} has parent_id ${String(child.parent_id)}`);
      }
    }
    for (const stateKey of ['empty_state', 'loading_state', 'error_state']) {
      const stateId = node.content?.[stateKey];
      if (stateId && !byId.has(stateId)) {
        errors.push(`${node.id}: content.${stateKey} references missing node ${stateId}`);
      }
    }
    if (node.layout?.mode === 'freeform') {
      const children = (node.children ?? []).map((id) => byId.get(id)).filter(Boolean);
      const viewports = blueprint.viewports ?? [];
      for (const child of children) {
        for (const viewport of viewports) {
          const placement = child.placements?.[viewport.id];
          if (!placement) {
            errors.push(`${child.id}: missing placement for ${viewport.id} inside freeform parent ${node.id}`);
            continue;
          }
          if (placement.x < 0 || placement.y < 0) {
            errors.push(`${child.id}: placement for ${viewport.id} has negative coordinates`);
          }
          if (placement.width <= 0 || placement.height <= 0) {
            errors.push(`${child.id}: placement for ${viewport.id} must have positive size`);
          }
          if (placement.x + placement.width > viewport.width) {
            errors.push(`${child.id}: placement for ${viewport.id} overflows viewport width ${viewport.width}`);
          }
        }
      }
    }
  }

  if (roots.length === 1) {
    const visited = new Set();
    const active = new Set();
    const walk = (id) => {
      if (active.has(id)) {
        errors.push(`component tree contains a cycle at ${id}`);
        return;
      }
      if (visited.has(id)) return;
      visited.add(id);
      active.add(id);
      const node = byId.get(id);
      for (const childId of node?.children ?? []) {
        if (byId.has(childId)) walk(childId);
      }
      active.delete(id);
    };
    walk(roots[0].id);
    for (const node of nodes) {
      if (!visited.has(node.id)) errors.push(`${node.id}: node is not reachable from root ${roots[0].id}`);
    }
  }

  for (const interaction of blueprint?.interactions ?? []) {
    if (!interactionSources.has(interaction.source_node_id)) {
      errors.push(`${interaction.id}: source_node_id references missing node ${interaction.source_node_id}`);
    }
  }

  for (const responsive of blueprint?.responsive ?? []) {
    if (!byId.has(responsive.target_node_id)) {
      errors.push(`responsive ${responsive.viewport}/${responsive.rule}: missing target ${responsive.target_node_id}`);
    }
  }

  return errors;
}

export function resolvePlacement(node, viewportId) {
  const placements = node?.placements;
  if (!placements) return null;
  return placements[viewportId]
    ?? placements.desktop
    ?? placements.tablet
    ?? placements.mobile
    ?? placements.wide
    ?? null;
}
