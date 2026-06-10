// Pure, deterministic scaffolding for the three specification sections that are
// often left empty when a blueprint does not come from a built-in template
// (blank starts, custom trees, Angular imports): interactions, responsive rules,
// and acceptance criteria.
//
// Every function is NON-DESTRUCTIVE: it only appends derived items for things not
// already covered and never rewrites or reorders existing user content. Output is
// deterministic so the editor, the CLI, and the MCP server all produce the same
// result for the same blueprint.

export const SCAFFOLD_SECTIONS = ['interactions', 'responsive', 'acceptance'];

const MAX_GENERATED_INTERACTIONS = 12;

// Component types that imply a user interaction worth declaring.
const ACTIONABLE_TYPES = new Set([
  'button',
  'icon_button',
  'button_group',
  'nav_item',
  'link',
  'menu',
  'command_palette',
  'form',
  'search_input',
  'text_input',
  'textarea',
  'select',
  'checkbox',
  'radio_group',
  'toggle',
  'slider',
  'date_picker',
  'file_upload',
  'tabs',
  'stepper',
]);

const CHANGE_TYPES = new Set([
  'select',
  'checkbox',
  'radio_group',
  'toggle',
  'slider',
  'date_picker',
  'file_upload',
  'text_input',
  'textarea',
]);

const SUBMIT_TYPES = new Set(['form', 'search_input']);

function pick(language, en, zh) {
  return language === 'zh-Hant' ? zh : en;
}

function uniqueId(prefix, existing) {
  const used = new Set(existing);
  let index = existing.length + 1;
  let candidate = `${prefix}_${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  return candidate;
}

function nodeList(blueprint) {
  return Array.isArray(blueprint?.nodes) ? blueprint.nodes : [];
}

function triggerFor(type) {
  if (SUBMIT_TYPES.has(type)) return 'submit';
  if (CHANGE_TYPES.has(type)) return 'change';
  return 'click';
}

function actionFor(node) {
  const declared = node?.content?.action;
  if (typeof declared === 'string' && declared.trim()) return declared.trim();
  const type = node.type;
  if (SUBMIT_TYPES.has(type)) return `submit:${node.id}`;
  if (CHANGE_TYPES.has(type)) return `change:${node.id}`;
  if (type === 'link' || type === 'nav_item') return `navigate:${node.id}`;
  return `activate:${node.id}`;
}

/** Append interactions derived from actionable nodes not already wired. */
export function scaffoldInteractions(blueprint, { language = 'en' } = {}) {
  const existing = Array.isArray(blueprint?.interactions) ? blueprint.interactions : [];
  const wired = new Set(existing.map((item) => item?.source_node_id).filter(Boolean));
  const ids = existing.map((item) => item?.id).filter(Boolean);
  const added = [];

  for (const node of nodeList(blueprint)) {
    if (added.length >= MAX_GENERATED_INTERACTIONS) break;
    if (!node?.id || !ACTIONABLE_TYPES.has(node.type)) continue;
    if (wired.has(node.id)) continue;
    wired.add(node.id);

    const trigger = triggerFor(node.type);
    const id = uniqueId('interaction', [...ids, ...added.map((item) => item.id)]);
    const name = node.name ?? node.id;
    added.push({
      id,
      trigger,
      source_node_id: node.id,
      action: actionFor(node),
      result_state: pick(
        language,
        `The result of ${name} is visibly presented to the user.`,
        `${name} 的操作結果清楚呈現給使用者。`
      ),
    });
  }

  return { interactions: [...existing, ...added], added };
}

const SUB_DESKTOP_VIEWPORTS = new Set(['tablet', 'mobile']);

function isMultiColumnGrid(node) {
  const layout = node?.layout;
  if (!layout) return false;
  const columns = layout.grid?.columns ?? layout.columns;
  return (layout.display === 'grid' || layout.mode === 'grid') && Number(columns) > 1;
}

function responsiveTargetsFor(blueprint, viewportId) {
  const nodes = nodeList(blueprint);
  const targets = [];
  const seen = new Set();
  const push = (nodeId, rule, changes) => {
    if (!nodeId || seen.has(nodeId)) return;
    seen.add(nodeId);
    targets.push({ target_node_id: nodeId, rule, changes });
  };

  for (const node of nodes) {
    if (node.type === 'sidebar') push(node.id, 'drawer', {});
  }
  for (const node of nodes) {
    if (node.type === 'top_bar' || node.type === 'bottom_nav' || node.type === 'toolbar') {
      push(node.id, viewportId === 'mobile' ? 'bottom_nav' : 'icon_only', {});
    }
  }
  for (const node of nodes) {
    if (isMultiColumnGrid(node)) push(node.id, 'col_reduce', { columns: viewportId === 'mobile' ? 1 : 2 });
  }

  if (targets.length === 0) {
    const root = nodes.find((node) => node.parent_id == null) ?? nodes[0];
    if (root) push(root.id, 'stack', {});
  }
  return targets;
}

/** Append responsive rules for sub-desktop viewports not already covered. */
export function scaffoldResponsive(blueprint) {
  const existing = Array.isArray(blueprint?.responsive) ? blueprint.responsive : [];
  const covered = new Set(existing.map((item) => `${item?.viewport}::${item?.target_node_id}`));
  const viewports = Array.isArray(blueprint?.viewports) ? blueprint.viewports : [];
  const added = [];

  for (const viewport of viewports) {
    const viewportId = viewport?.id;
    if (!SUB_DESKTOP_VIEWPORTS.has(viewportId)) continue;
    for (const target of responsiveTargetsFor(blueprint, viewportId)) {
      const key = `${viewportId}::${target.target_node_id}`;
      if (covered.has(key)) continue;
      covered.add(key);
      added.push({
        viewport: viewportId,
        rule: target.rule,
        target_node_id: target.target_node_id,
        changes: target.changes,
      });
    }
  }

  return { responsive: [...existing, ...added], added };
}

const REQUIRED_ACCEPTANCE_TYPES = ['layout', 'interaction', 'responsive', 'a11y'];
const MIN_ACCEPTANCE = 5;

function acceptanceCriterion(type, blueprint, language) {
  const nodes = nodeList(blueprint);
  const root = nodes.find((node) => node.parent_id == null) ?? nodes[0];
  const subViewport =
    (blueprint?.viewports ?? []).map((viewport) => viewport?.id).find((id) => SUB_DESKTOP_VIEWPORTS.has(id)) ??
    'mobile';
  switch (type) {
    case 'layout':
      return {
        type: 'layout',
        statement: pick(
          language,
          'All major regions match their declared placements on desktop.',
          '桌面版所有主要區域的位置與尺寸符合 placement。'
        ),
        target: 'desktop',
        priority: 'blocker',
        verification_method: 'screenshot_diff',
      };
    case 'interaction':
      return {
        type: 'interaction',
        statement: pick(
          language,
          'Primary buttons and navigation controls declare and perform their actions.',
          '所有主要按鈕與導覽操作都有明確 action 並可執行。'
        ),
        target: '*',
        priority: 'must',
        verification_method: 'interaction_replay',
      };
    case 'responsive':
      return {
        type: 'responsive',
        statement: pick(
          language,
          `The ${subViewport} layout adapts without horizontal overflow.`,
          `${subViewport} 版面自適應且不水平溢出。`
        ),
        target: subViewport,
        priority: 'must',
        verification_method: 'screenshot_diff',
      };
    case 'a11y':
      return {
        type: 'a11y',
        statement: pick(
          language,
          'Interactive controls have understandable labels and visible focus states.',
          '互動元件具備可理解的文字標籤與可見的 focus 狀態。'
        ),
        target: '*',
        priority: 'must',
        verification_method: 'axe_audit',
      };
    case 'content':
    default:
      return {
        type: 'content',
        statement: pick(
          language,
          `Names and content explain the purpose of each major region${root ? ` starting at ${root.name ?? root.id}` : ''}.`,
          '每個主要區域的名稱與內容能說明其用途。'
        ),
        target: '*',
        priority: 'should',
        verification_method: 'manual_ia_review',
      };
  }
}

/** Append acceptance criteria so coverage spans the required types and totals >= 5. */
export function scaffoldAcceptance(blueprint, { language = 'en' } = {}) {
  const existing = Array.isArray(blueprint?.acceptance) ? blueprint.acceptance : [];
  const presentTypes = new Set(existing.map((item) => item?.type).filter(Boolean));
  const ids = existing.map((item) => item?.id).filter(Boolean);
  const added = [];

  const emit = (type) => {
    const criterion = acceptanceCriterion(type, blueprint, language);
    const id = uniqueId('acc', [...ids, ...added.map((item) => item.id)]);
    added.push({ id, ...criterion });
  };

  for (const type of REQUIRED_ACCEPTANCE_TYPES) {
    if (!presentTypes.has(type)) {
      presentTypes.add(type);
      emit(type);
    }
  }

  const padOrder = ['content', 'responsive', 'a11y', 'interaction', 'layout'];
  let padIndex = 0;
  while (existing.length + added.length < MIN_ACCEPTANCE) {
    emit(padOrder[padIndex % padOrder.length]);
    padIndex += 1;
  }

  return { acceptance: [...existing, ...added], added };
}

/**
 * Scaffold the requested sections of a blueprint. Returns a NEW blueprint plus a
 * per-section summary of how many items were added. Never mutates the input and
 * never overwrites existing entries.
 */
export function scaffoldBlueprint(blueprint, { sections = SCAFFOLD_SECTIONS, language = 'en' } = {}) {
  const requested = new Set(sections);
  const next = { ...blueprint };
  const summary = { interactions: 0, responsive: 0, acceptance: 0 };

  if (requested.has('interactions')) {
    const result = scaffoldInteractions(blueprint, { language });
    next.interactions = result.interactions;
    summary.interactions = result.added.length;
  }
  if (requested.has('responsive')) {
    const result = scaffoldResponsive(next, { language });
    next.responsive = result.responsive;
    summary.responsive = result.added.length;
  }
  if (requested.has('acceptance')) {
    const result = scaffoldAcceptance(next, { language });
    next.acceptance = result.acceptance;
    summary.acceptance = result.added.length;
  }

  summary.total = summary.interactions + summary.responsive + summary.acceptance;
  return { blueprint: next, summary };
}
