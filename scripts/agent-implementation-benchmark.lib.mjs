import { verifyImplementationReport } from './implementation-report.lib.mjs';

const STYLE_KEYS = [
  'position',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'backgroundColor',
  'color',
  'borderRadius',
  'boxShadow',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
];

const AUTO_LAYOUT_STYLE_KEYS = [
  'display',
  'flexDirection',
  'rowGap',
  'columnGap',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
];

export function scoreImplementationBenchmark(blueprint, candidate, reference, implementationReport) {
  const checks = [];
  const nodeIds = blueprint.nodes.map((node) => node.id);
  const root = blueprint.nodes.find((node) => node.parent_id === null);

  for (const viewport of blueprint.viewports) {
    const candidateView = candidate.viewports[viewport.id];
    const referenceView = reference.viewports[viewport.id];
    add(checks, `${viewport.id}.screenshot`, Boolean(candidateView?.screenshot_bytes > 5000), '> 5000 bytes', candidateView?.screenshot_bytes ?? 0);
    add(checks, `${viewport.id}.horizontal_overflow`, candidateView?.horizontal_overflow === false, false, candidateView?.horizontal_overflow);
    add(checks, `${viewport.id}.root_children`, equal(candidateView?.root_children, root?.children ?? []), root?.children ?? [], candidateView?.root_children);

    for (const nodeId of nodeIds) {
      add(checks, `${viewport.id}.node.${nodeId}`, Boolean(candidateView?.nodes?.[nodeId]), true, Boolean(candidateView?.nodes?.[nodeId]));
    }

    for (const node of blueprint.nodes) {
      const actualNode = candidateView?.nodes?.[node.id];
      const referenceNode = referenceView?.nodes?.[node.id];
      add(
        checks,
        `${viewport.id}.parent.${node.id}`,
        actualNode?.parent_node_id === node.parent_id,
        node.parent_id,
        actualNode?.parent_node_id
      );
      const styleKeys = node.layout?.mode === 'auto'
        ? [...STYLE_KEYS, ...AUTO_LAYOUT_STYLE_KEYS]
        : STYLE_KEYS;
      for (const key of styleKeys) {
        if (referenceNode?.styles?.[key] === undefined) continue;
        const actualValue = actualNode?.styles?.[key];
        const expectedValue = referenceNode.styles[key];
        const isRootBackground = node.id === 'root' && key === 'backgroundColor';
        const passes = isRootBackground
          ? isEquivalentRootBackgroundColor({
              expected: expectedValue,
              actual: actualValue,
              candidateBody: candidateView?.document_styles?.body?.backgroundColor,
              referenceBody: referenceView?.document_styles?.body?.backgroundColor,
            })
          : actualValue === expectedValue;
        add(
          checks,
          `${viewport.id}.style.${node.id}.${key}`,
          passes,
          expectedValue,
          actualValue
        );
      }

      const placement = node.placements?.[viewport.id];
      if (!placement) continue;
      const actual = actualNode?.rect;
      for (const key of ['x', 'y', 'width', 'height']) {
        const pass = Number.isFinite(actual?.[key]) && Math.abs(actual[key] - placement[key]) <= 2;
        add(checks, `${viewport.id}.geometry.${node.id}.${key}`, pass, placement[key], actual?.[key]);
      }
      add(checks, `${viewport.id}.geometry.${node.id}.z_index`, Number(actual?.z_index) === placement.z_index, placement.z_index, actual?.z_index);
    }

    const primary = candidateView?.nodes?.primary_cta?.rect;
    const secondary = candidateView?.nodes?.secondary_cta?.rect;
    add(checks, `${viewport.id}.cta_side_by_side`, Boolean(
      primary && secondary && Math.abs(primary.y - secondary.y) <= 2 && primary.x + primary.width <= secondary.x
    ), true, { primary, secondary });
  }

  for (const node of blueprint.nodes) {
    const expectedText = node.content?.text ?? node.content?.label;
    if (!expectedText) continue;
    const actualText = candidate.viewports.desktop?.nodes?.[node.id]?.text?.trim();
    add(checks, `content.${node.id}`, actualText === expectedText, expectedText, actualText);
  }

  for (const interaction of blueprint.interactions) {
    add(
      checks,
      `interaction.${interaction.id}`,
      candidate.interactions?.[interaction.source_node_id] === interaction.action,
      interaction.action,
      candidate.interactions?.[interaction.source_node_id]
    );
  }

  add(checks, 'accessibility.focus_visible', candidate.has_focus_visible === true, true, candidate.has_focus_visible);
  const reportVerification = verifyImplementationReport(blueprint, implementationReport);
  add(checks, 'implementation_report.ready', reportVerification.ready, true, reportVerification);

  const passed = checks.filter((check) => check.pass).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    passed,
    total: checks.length,
    ready: passed === checks.length,
    checks,
    report_verification: reportVerification,
  };
}

function add(checks, path, pass, expected, actual) {
  checks.push({ path, pass, expected, actual });
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isEquivalentRootBackgroundColor({ expected, actual, candidateBody, referenceBody }) {
  const normalize = (value) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  };
  const normalizedExpected = normalize(expected);
  const normalizedActual = normalize(actual);
  if (normalizedExpected === normalizedActual) return true;

  const isTransparent = (value) => {
    const normalized = normalize(value);
    return normalized === 'transparent' || normalized === 'rgba(0, 0, 0, 0)' || normalized === 'rgba(0,0,0,0)';
  };

  if (!isTransparent(normalizedActual)) return false;

  const normalizedCandidateBody = normalize(candidateBody);
  const normalizedReferenceBody = normalize(referenceBody);

  return normalizedExpected === normalizedCandidateBody || normalizedExpected === normalizedReferenceBody;
}
