export function createImplementationReportTemplate(blueprint) {
  const report = {
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
  report.safety_score = scoreImplementationSafety(blueprint, report);
  return report;
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
  const safetyScore = scoreImplementationSafety(blueprint, report);
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
      if (isMachineEvidenceType(evidence?.type) && evidence.pass === false) {
        errors.push(`Machine evidence failed: ${acceptanceId} (${evidence.reference ?? evidence.type})`);
      }
      if (
        isMachineEvidenceType(evidence?.type)
        && Object.hasOwn(evidence, 'expected')
        && Object.hasOwn(evidence, 'actual')
        && !Object.is(evidence.expected, evidence.actual)
      ) {
        errors.push(`Machine evidence mismatch: ${acceptanceId} (${evidence.reference ?? evidence.type})`);
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
      safety_score: safetyScore,
    },
  };
}

export function scoreImplementationSafety(blueprint, report) {
  const nodes = Array.isArray(blueprint?.nodes) ? blueprint.nodes : [];
  const viewports = Array.isArray(blueprint?.viewports) ? blueprint.viewports : [];
  const acceptance = Array.isArray(blueprint?.acceptance) ? blueprint.acceptance : [];
  const mappings = Array.isArray(report?.node_mappings) ? report.node_mappings : [];
  const results = Array.isArray(report?.acceptance_results) ? report.acceptance_results : [];
  const unresolved = Array.isArray(report?.unresolved) ? report.unresolved : [];
  const evidenceItems = results.flatMap((result) => Array.isArray(result.evidence) ? result.evidence : []);
  const mappingByNode = new Map(mappings.map((mapping) => [mapping.node_id, mapping]));
  const requiredNodeCount = Math.max(1, nodes.length);
  const mappedNodeCount = nodes.filter((node) => {
    const mapping = mappingByNode.get(node.id);
    return mapping?.status === 'mapped' && Boolean(String(mapping.file ?? '').trim());
  }).length;
  const unresolvedMappingCount = unresolved.length + nodes.filter((node) => {
    const mapping = mappingByNode.get(node.id);
    return !mapping || mapping.status !== 'mapped' || !String(mapping.file ?? '').trim();
  }).length;

  const acceptanceResultById = new Map(results.map((result) => [result.acceptance_id, result]));
  const acceptanceWithMachineEvidence = acceptance.filter((item) => {
    const result = acceptanceResultById.get(item.id);
    return result?.status === 'pass' && Array.isArray(result.evidence) && result.evidence.some((evidence) => isMachineEvidence(evidence));
  }).length;

  const screenshotViewports = new Set(
    evidenceItems
      .filter((evidence) => evidence?.type === 'screenshot' && Number(evidence.bytes) > 0 && evidence.viewport)
      .map((evidence) => evidence.viewport)
  );
  const overflowEvidence = evidenceItems.filter((evidence) => evidence?.type === 'overflow');
  const overflowFailures = overflowEvidence.filter((evidence) => evidence.pass === false).length;
  const overflowPassingViewports = new Set(
    overflowEvidence
      .filter((evidence) => evidence.pass === true && evidence.viewport)
      .map((evidence) => evidence.viewport)
  );
  const expectedViewportIds = viewports.map((viewport) => viewport.id).filter(Boolean);
  const expectedViewportCount = Math.max(1, expectedViewportIds.length);
  const viewportCovered = new Set([...screenshotViewports, ...overflowPassingViewports]);

  const customNodes = nodes.filter((node) => isCustomOrRegistryType(node.type));
  const customMappings = customNodes.filter((node) => {
    const mapping = mappingByNode.get(node.id);
    return mapping?.status === 'mapped' && Boolean(String(mapping.file ?? '').trim());
  });
  const componentReuseEvidence = evidenceItems.filter((evidence) => evidence?.type === 'component_reuse' && Boolean(evidence.reference));
  const componentReuseScore = customNodes.length === 0
    ? 100
    : percent(Math.min(customMappings.length + componentReuseEvidence.length, customNodes.length), customNodes.length);
  const sourceCoverageScore = percent(mappedNodeCount, requiredNodeCount);
  const acceptanceEvidenceScore = percent(acceptanceWithMachineEvidence, Math.max(1, acceptance.length));
  const viewportEvidenceScore = percent(viewportCovered.size, expectedViewportCount);
  const overflowSafety = overflowFailures > 0
    ? 0
    : overflowEvidence.length === 0
      ? 40
      : percent(Math.min(overflowPassingViewports.size || overflowEvidence.length, expectedViewportCount), expectedViewportCount);
  const lookalikePreventionCount = componentReuseEvidence.length + customMappings.length;
  const penalty = Math.min(20, unresolvedMappingCount * 4);
  const overall = clampScore(
    Math.round(
      sourceCoverageScore * 0.2
      + acceptanceEvidenceScore * 0.3
      + viewportEvidenceScore * 0.2
      + componentReuseScore * 0.15
      + overflowSafety * 0.15
      - penalty
    )
  );

  return {
    overall,
    grade: gradeForScore(overall),
    sourceCoverageScore,
    acceptanceEvidenceScore,
    viewportEvidenceScore,
    overflowSafety,
    componentReuseScore,
    unresolvedMappingCount,
    lookalikePreventionCount,
    evidenceItems: evidenceItems.length,
    expectedViewports: expectedViewportIds,
  };
}

function isMachineEvidence(evidence) {
  if (!evidence || !MACHINE_EVIDENCE_TYPES.has(evidence.type)) return false;
  if (evidence.type === 'screenshot') return Boolean(evidence.reference) && Number(evidence.bytes) > 0;
  if (evidence.type === 'overflow') return evidence.pass === true;
  return Boolean(evidence.reference);
}

function isMachineEvidenceType(type) {
  return MACHINE_EVIDENCE_TYPES.has(type);
}

function isCustomOrRegistryType(type) {
  return typeof type === 'string' && type.includes(':');
}

function percent(value, total) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return clampScore(Math.round((value / total) * 100));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function gradeForScore(score) {
  if (score >= 85) return 'pass';
  if (score >= 70) return 'review';
  if (score >= 50) return 'risk';
  return 'fail';
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
