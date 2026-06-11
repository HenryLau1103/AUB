export const DESIGN_BRIDGE_VERSION = '1.0.0';

export function importDesignBridge(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Design Bridge input must be an object.');
  }
  if (input.format !== 'aub-design-bridge' || input.version !== DESIGN_BRIDGE_VERSION) {
    throw new Error(`Design Bridge must declare format "aub-design-bridge" and version "${DESIGN_BRIDGE_VERSION}".`);
  }
  if (!['figma', 'penpot'].includes(input.source?.kind)) {
    throw new Error('Design Bridge source.kind must be "figma" or "penpot".');
  }
  if (!input.blueprint || typeof input.blueprint !== 'object' || Array.isArray(input.blueprint)) {
    throw new Error('Design Bridge must contain a complete blueprint object.');
  }
  if (!input.node_map || typeof input.node_map !== 'object' || Array.isArray(input.node_map)) {
    throw new Error('Design Bridge must contain a node_map object.');
  }

  const blueprint = structuredClone(input.blueprint);
  const nodes = Array.isArray(blueprint.nodes) ? blueprint.nodes : [];
  const nodeIds = new Set(nodes.map((node) => node?.id).filter(Boolean));
  const mappedIds = new Set(Object.keys(input.node_map));
  const missing = [...nodeIds].filter((id) => !mappedIds.has(id));
  const unknown = [...mappedIds].filter((id) => !nodeIds.has(id));
  if (missing.length > 0 || unknown.length > 0) {
    const details = [
      missing.length > 0 ? `missing node mappings: ${missing.join(', ')}` : '',
      unknown.length > 0 ? `unknown mapped nodes: ${unknown.join(', ')}` : '',
    ].filter(Boolean);
    throw new Error(`Design Bridge node_map must exactly cover blueprint nodes (${details.join('; ')}).`);
  }

  const sourceFile =
    input.source.url ??
    `${input.source.kind}://${input.source.document_id}/${input.source.page_id ?? 'page'}/${input.source.frame_id}`;
  const sourceMap = {};
  blueprint.nodes = nodes.map((node) => {
    const mapping = input.node_map[node.id];
    if (!mapping?.source_id) {
      throw new Error(`Design Bridge node_map.${node.id}.source_id is required.`);
    }
    sourceMap[node.id] = {
      source_id: mapping.source_id,
      ...(mapping.source_name ? { source_name: mapping.source_name } : {}),
      ...(mapping.component_key ? { component_key: mapping.component_key } : {}),
    };
    return {
      ...node,
      source: {
        file: sourceFile,
        selector: mapping.source_id,
      },
    };
  });
  blueprint.provenance = {
    source_kind: input.source.kind,
    framework: input.source.kind === 'figma' ? 'Figma' : 'Penpot',
    importer_version: DESIGN_BRIDGE_VERSION,
    entry_file: input.source.frame_id,
    source_files: [sourceFile],
  };

  return {
    blueprint,
    source: structuredClone(input.source),
    sourceMap,
  };
}
