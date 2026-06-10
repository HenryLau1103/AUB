export function diffBlueprints(before, after) {
  const screenChanges = changedPaths(before.screen, after.screen);
  const nodes = diffByKey(before.nodes, after.nodes, (item) => item.id);
  const interactions = diffByKey(before.interactions, after.interactions, (item) => item.id);
  const responsive = diffByKey(
    before.responsive,
    after.responsive,
    (item, index) => `${item.viewport}:${item.target_node_id}:${index}`
  );
  const acceptance = diffByKey(before.acceptance, after.acceptance, (item) => item.id);
  const viewports = diffByKey(before.viewports, after.viewports, (item) => item.id);
  const designSystemChanges = changedPaths(before.design_system ?? {}, after.design_system ?? {});

  return {
    before: { version: before.version, screen_id: before.screen.id, screen_name: before.screen.name },
    after: { version: after.version, screen_id: after.screen.id, screen_name: after.screen.name },
    summary: {
      screen_fields_changed: screenChanges.length,
      nodes_added: nodes.added.length,
      nodes_removed: nodes.removed.length,
      nodes_changed: nodes.changed.length,
      interactions_changed: changeCount(interactions),
      responsive_rules_changed: changeCount(responsive),
      acceptance_items_changed: changeCount(acceptance),
      viewports_changed: changeCount(viewports),
      design_tokens_changed: designSystemChanges.length,
    },
    screen_changes: screenChanges,
    nodes,
    interactions,
    responsive,
    acceptance,
    viewports,
    design_system_changes: designSystemChanges,
  };
}

export function renderBlueprintDiff(diff) {
  const lines = [
    '# UI Blueprint Diff',
    '',
    `- Before: **${diff.before.screen_name}** (\`${diff.before.screen_id}\`, v${diff.before.version})`,
    `- After: **${diff.after.screen_name}** (\`${diff.after.screen_id}\`, v${diff.after.version})`,
    '',
    '## Summary',
    '',
    '| Area | Added | Removed | Changed |',
    '|---|---:|---:|---:|',
    `| Nodes | ${diff.nodes.added.length} | ${diff.nodes.removed.length} | ${diff.nodes.changed.length} |`,
    `| Interactions | ${diff.interactions.added.length} | ${diff.interactions.removed.length} | ${diff.interactions.changed.length} |`,
    `| Responsive rules | ${diff.responsive.added.length} | ${diff.responsive.removed.length} | ${diff.responsive.changed.length} |`,
    `| Acceptance items | ${diff.acceptance.added.length} | ${diff.acceptance.removed.length} | ${diff.acceptance.changed.length} |`,
    `| Viewports | ${diff.viewports.added.length} | ${diff.viewports.removed.length} | ${diff.viewports.changed.length} |`,
    '',
  ];

  renderPathSection(lines, 'Screen metadata', diff.screen_changes);
  renderEntitySection(lines, 'Nodes', diff.nodes);
  renderEntitySection(lines, 'Interactions', diff.interactions);
  renderEntitySection(lines, 'Responsive rules', diff.responsive);
  renderEntitySection(lines, 'Acceptance items', diff.acceptance);
  renderEntitySection(lines, 'Viewports', diff.viewports);
  renderPathSection(lines, 'Design system', diff.design_system_changes);

  return `${lines.join('\n').trim()}\n`;
}

function diffByKey(beforeItems = [], afterItems = [], keyOf) {
  const beforeMap = new Map(beforeItems.map((item, index) => [keyOf(item, index), item]));
  const afterMap = new Map(afterItems.map((item, index) => [keyOf(item, index), item]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, item] of afterMap) {
    if (!beforeMap.has(key)) added.push({ key, item });
  }
  for (const [key, item] of beforeMap) {
    if (!afterMap.has(key)) removed.push({ key, item });
  }
  for (const [key, beforeItem] of beforeMap) {
    const afterItem = afterMap.get(key);
    if (!afterItem) continue;
    const paths = changedPaths(beforeItem, afterItem);
    if (paths.length > 0) changed.push({ key, paths, before: beforeItem, after: afterItem });
  }

  return { added, removed, changed };
}

function changedPaths(before, after, prefix = '') {
  if (stableValue(before) === stableValue(after)) return [];
  if (!isPlainObject(before) || !isPlainObject(after)) return [prefix || '(value)'];

  const paths = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const beforeValue = before[key];
    const afterValue = after[key];
    if (stableValue(beforeValue) === stableValue(afterValue)) continue;
    if (isPlainObject(beforeValue) && isPlainObject(afterValue)) {
      paths.push(...changedPaths(beforeValue, afterValue, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function changeCount(section) {
  return section.added.length + section.removed.length + section.changed.length;
}

function renderPathSection(lines, title, paths) {
  lines.push(`## ${title}`, '');
  if (paths.length === 0) lines.push('_No changes._', '');
  else {
    for (const path of paths) lines.push(`- \`${path}\``);
    lines.push('');
  }
}

function renderEntitySection(lines, title, section) {
  lines.push(`## ${title}`, '');
  if (changeCount(section) === 0) {
    lines.push('_No changes._', '');
    return;
  }
  for (const entry of section.added) lines.push(`- Added \`${entry.key}\``);
  for (const entry of section.removed) lines.push(`- Removed \`${entry.key}\``);
  for (const entry of section.changed) {
    lines.push(`- Changed \`${entry.key}\`: ${entry.paths.map((path) => `\`${path}\``).join(', ')}`);
  }
  lines.push('');
}
