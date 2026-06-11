export function createImplementationReportTemplate(blueprint) {
  return {
    format: 'aub-implementation-report',
    format_version: '1.0.0',
    blueprint: {
      screen_id: blueprint.screen.id,
      version: blueprint.version,
    },
    implementation: {
      framework: '',
      route: '',
      files: [],
    },
    node_mappings: blueprint.nodes.map((node) => ({
      node_id: node.id,
      status: 'unmapped',
      component: node.type,
      file: '',
      selector: `[data-aub-node="${node.id}"]`,
      notes: '',
    })),
    acceptance_results: blueprint.acceptance.map((item) => ({
      acceptance_id: item.id,
      status: 'needs-review',
      evidence: [],
      notes: '',
    })),
    unresolved: [],
  };
}

const MACHINE_EVIDENCE_TYPES = new Set([
  'screenshot',
  'dom_query',
  'computed_style',
  'overflow',
  'component_reuse',
  'interaction',
  'code_diff',
  'command',
]);

export function verifyImplementationReport(blueprint, report, options = {}) {
  const errors = [];
  const warnings = [];
  if (report.blueprint?.screen_id !== blueprint.screen.id) {
    errors.push(`Report screen_id "${report.blueprint?.screen_id ?? ''}" does not match "${blueprint.screen.id}".`);
  }
  if (report.blueprint?.version !== blueprint.version) {
    errors.push(`Report Blueprint version "${report.blueprint?.version ?? ''}" does not match "${blueprint.version}".`);
  }

  const nodeIds = new Set(blueprint.nodes.map((node) => node.id));
  const mappingById = uniqueById(report.node_mappings ?? [], 'node_id', errors);
  for (const nodeId of nodeIds) {
    const mapping = mappingById.get(nodeId);
    if (!mapping) errors.push(`Missing node mapping: ${nodeId}`);
    else if (mapping.status !== 'mapped' || !mapping.file?.trim()) {
      errors.push(`Node is not mapped to a file: ${nodeId}`);
    }
  }
  for (const nodeId of mappingById.keys()) {
    if (!nodeIds.has(nodeId)) errors.push(`Unknown node mapping: ${nodeId}`);
  }

  const acceptanceById = new Map(blueprint.acceptance.map((item) => [item.id, item]));
  const resultById = uniqueById(report.acceptance_results ?? [], 'acceptance_id', errors);
  for (const [acceptanceId, acceptance] of acceptanceById) {
    const result = resultById.get(acceptanceId);
    if (!result) {
      errors.push(`Missing acceptance result: ${acceptanceId}`);
      continue;
    }
    if (result.status !== 'pass') {
      errors.push(`${acceptance.priority} acceptance is not passing: ${acceptanceId} (${result.status})`);
    }
    if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
      errors.push(`Acceptance result has no evidence: ${acceptanceId}`);
    } else if (options.requireEvidence && !result.evidence.some((item) => isMachineEvidence(item))) {
      errors.push(`Acceptance result has no machine-checkable evidence: ${acceptanceId}`);
    }
    for (const evidence of result.evidence ?? []) {
      if (evidence.type === 'screenshot' && !(Number(evidence.bytes) > 0)) {
        const message = `Screenshot evidence should include positive bytes: ${acceptanceId}`;
        if (options.requireEvidence) errors.push(message);
        else warnings.push(message);
      }
      if (evidence.type === 'overflow' && evidence.pass === false) {
        errors.push(`Overflow evidence failed: ${acceptanceId} (${evidence.reference})`);
      }
    }
  }
  for (const acceptanceId of resultById.keys()) {
    if (!acceptanceById.has(acceptanceId)) errors.push(`Unknown acceptance result: ${acceptanceId}`);
  }
  if ((report.unresolved ?? []).length > 0) {
    errors.push(`Report has ${report.unresolved.length} unresolved item(s).`);
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    summary: {
      nodes_total: blueprint.nodes.length,
      nodes_mapped: [...mappingById.values()].filter((item) => item.status === 'mapped' && item.file?.trim()).length,
      acceptance_total: blueprint.acceptance.length,
      acceptance_passed: [...resultById.values()].filter((item) => item.status === 'pass').length,
      evidence_items: [...resultById.values()].reduce((count, item) => count + (item.evidence?.length ?? 0), 0),
      unresolved: report.unresolved?.length ?? 0,
    },
  };
}

function isMachineEvidence(evidence) {
  if (!evidence || !MACHINE_EVIDENCE_TYPES.has(evidence.type)) return false;
  if (evidence.type === 'screenshot') return Boolean(evidence.reference) && Number(evidence.bytes) > 0;
  if (evidence.type === 'overflow') return evidence.pass === true;
  return Boolean(evidence.reference);
}

function uniqueById(items, field, errors) {
  const map = new Map();
  for (const item of items) {
    const id = item?.[field];
    if (map.has(id)) errors.push(`Duplicate ${field}: ${id}`);
    else map.set(id, item);
  }
  return map;
}
