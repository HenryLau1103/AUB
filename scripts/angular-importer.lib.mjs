import { parse, parseFragment } from 'parse5';
import postcss from 'postcss';
import scssSyntax from 'postcss-scss';
import { defaultDesignSystem } from './migrate-blueprint.mjs';

export const ANGULAR_IMPORTER_VERSION = '1.0.0';
const MAX_TEMPLATE_NESTING_DEPTH = 200;

const CONTAINER_TYPES = new Set([
  'app_shell', 'page', 'section', 'header', 'sidebar', 'top_bar', 'bottom_nav',
  'stack', 'grid', 'split_pane', 'scroll_area', 'list', 'detail_panel',
  'timeline', 'activity_feed', 'form', 'field_group', 'menu', 'toolbar',
  'button_group', 'command_palette', 'modal', 'drawer', 'tabs', 'stepper',
  'card', 'kanban_board', 'kanban_column', 'rich_text_editor',
]);

const ANGULAR_EVENT_TO_TRIGGER = {
  click: 'click',
  change: 'change',
  submit: 'submit',
  focus: 'focus',
  blur: 'blur',
  mouseenter: 'hover',
  keyup: 'change',
};

export function normalizeAngularBundle(input) {
  const files = Array.isArray(input) ? input : input?.files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Angular import requires at least one source file.');
  }
  const seen = new Set();
  return files.map((file) => {
    const path = sanitizeSourcePath(file.path ?? file.name ?? '');
    if (!path) throw new Error('Every Angular source file requires a relative path.');
    if (seen.has(path)) throw new Error(`Duplicate source path: ${path}`);
    seen.add(path);
    return { path, content: String(file.content ?? '') };
  });
}

export function discoverAngularComponents(input) {
  const files = normalizeAngularBundle(input);
  const components = [];
  for (const file of files.filter((candidate) => candidate.path.endsWith('.ts'))) {
    const metadata = readComponentMetadata(file);
    if (!metadata) continue;
    const templatePath = metadata.templateUrl
      ? resolveRelativeSource(file.path, metadata.templateUrl)
      : null;
    components.push({
      selector: metadata.selector,
      className: metadata.className,
      tsPath: file.path,
      templatePath,
      stylePaths: metadata.styleUrls.map((stylePath) => resolveRelativeSource(file.path, stylePath)),
      label: metadata.selector || metadata.className || file.path,
    });
  }
  if (components.length === 0) {
    for (const file of files.filter((candidate) => candidate.path.endsWith('.html'))) {
      components.push({
        selector: null,
        className: null,
        tsPath: null,
        templatePath: file.path,
        stylePaths: [],
        label: file.path.replace(/\.component\.html$|\.html$/i, ''),
      });
    }
  }
  return components;
}

export async function importAngularComponent(input, options = {}) {
  const files = normalizeAngularBundle(input);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const components = discoverAngularComponents(files);
  if (components.length === 0) throw new Error('No Angular component or HTML template was found.');
  const entry = selectEntry(components, options.entry);
  const diagnostics = [];
  const sourceMap = {};
  const componentBySelector = new Map(
    components.filter((component) => component.selector).map((component) => [component.selector, component])
  );
  const forms = collectForms(files);
  const styleResult = collectDesignSystem(files, diagnostics);
  const templateFile = entry.templatePath ? byPath.get(entry.templatePath) : null;
  if (!templateFile) throw new Error(`Template file not found for ${entry.label}.`);

  const builder = createBuilder({
    files,
    byPath,
    components,
    componentBySelector,
    forms,
    diagnostics,
    sourceMap,
    styleResult,
    language: options.language ?? 'zh-Hant',
  });
  const rootName = inferScreenName(templateFile.content, entry.label);
  const root = builder.addNode({
    idHint: 'root',
    type: 'page',
    name: rootName,
    role: 'Imported Angular screen root.',
    parentId: null,
    file: templateFile.path,
    line: 1,
    layout: {
      mode: 'auto',
      display: 'flex',
      direction: 'column',
      align: 'stretch',
      gap: { x: 12, y: 12 },
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
    },
  });

  builder.parseTemplate(templateFile, root.id, entry, []);
  builder.finalizeChildren();
  const screenId = slug(entry.selector || entry.className || rootName || 'angular-screen');
  const tableNodes = builder.nodes.filter((node) => node.type === 'data_table');
  const blueprint = {
    version: '0.3.0',
    screen: {
      id: screenId,
      name: rootName,
      type: tableNodes.length > 0 ? 'admin_table' : 'form',
      platform: 'web',
      primary_user_goal: `Use the imported ${rootName} Angular screen.`,
      notes: 'Imported from Angular source. Review diagnostics before treating inferred behavior as authoritative.',
    },
    viewports: [
      { id: 'desktop', width: 1440, height: 900 },
      { id: 'tablet', width: 1024, height: 768 },
      { id: 'mobile', width: 390, height: 844 },
    ],
    provenance: {
      source_kind: 'angular-component',
      framework: 'Angular',
      importer_version: ANGULAR_IMPORTER_VERSION,
      entry_file: templateFile.path,
      source_files: files.map((file) => file.path).sort(),
    },
    design_system: styleResult.designSystem,
    nodes: builder.nodes,
    interactions: builder.interactions,
    responsive: [
      { viewport: 'tablet', rule: 'keep', target_node_id: root.id, changes: { layout: 'auto' } },
      { viewport: 'mobile', rule: 'stack', target_node_id: root.id, changes: { direction: 'column' } },
      ...tableNodes.map((node) => ({
        viewport: 'mobile',
        rule: 'scroll',
        target_node_id: node.id,
        changes: { overflow_x: 'auto' },
      })),
    ],
    acceptance: importedAcceptance(root.id, tableNodes.map((node) => node.id)),
  };

  for (const diagnostic of builder.postDiagnostics()) diagnostics.push(diagnostic);
  return {
    blueprint,
    diagnostics,
    sourceMap,
    components,
    entry: {
      selector: entry.selector,
      label: entry.label,
      templatePath: templateFile.path,
    },
    confidenceSummary: summarizeDiagnostics(diagnostics, builder.nodes.length),
    unresolvedComponents: diagnostics
      .filter((diagnostic) => diagnostic.code === 'unknown-custom-component')
      .map((diagnostic) => diagnostic.detail)
      .filter(Boolean),
  };
}

function createBuilder(context) {
  const nodes = [];
  const interactions = [];
  const children = new Map();
  const ids = new Map();
  const signatures = new Map();
  const parsedComponents = new Set();

  function addNode(input) {
    const id = uniqueId(input.idHint || input.name || input.type, ids);
    const signature = input.parentId && input.action
      ? `${input.parentId}|${input.type}|${input.name}|${input.action}`
      : null;
    if (signature && signatures.has(signature)) return signatures.get(signature);
    const node = {
      id,
      type: input.type,
      name: clamp(input.name || humanize(input.type), 128),
      role: clamp(input.role || `Imported ${humanize(input.type)}.`, 280),
      parent_id: input.parentId,
      ...(CONTAINER_TYPES.has(input.type) ? { children: [] } : {}),
      ...(input.layout ? { layout: input.layout } : {}),
      ...(input.content && Object.keys(input.content).length ? { content: input.content } : {}),
      ...(input.style && Object.keys(input.style).length ? { style: input.style } : {}),
      ...(input.states?.length ? { states: [...new Set(input.states)] } : {}),
      ...(input.constraints && Object.keys(input.constraints).length ? { constraints: input.constraints } : {}),
      ...(input.bindings && Object.keys(input.bindings).length ? { bindings: input.bindings } : {}),
      ...(input.validation && Object.keys(input.validation).length ? { validation: input.validation } : {}),
      ...(input.initialState && Object.keys(input.initialState).length ? { initial_state: input.initialState } : {}),
      source: {
        file: sanitizeSourcePath(input.file),
        ...(input.line ? { line: input.line } : {}),
        ...(input.column ? { column: input.column } : {}),
        ...(input.selector ? { selector: input.selector } : {}),
      },
    };
    nodes.push(node);
    context.sourceMap[id] = node.source;
    if (input.parentId) {
      const list = children.get(input.parentId) ?? [];
      list.push(id);
      children.set(input.parentId, list);
    }
    if (signature) signatures.set(signature, node);
    if (input.action) {
      const trigger = input.trigger ?? 'click';
      interactions.push({
        id: uniqueId(`interaction_${id}_${trigger}`, ids),
        trigger,
        source_node_id: id,
        action: normalizeAction(input.action),
        result_state: `The ${node.name} ${trigger} action is observable.`,
      });
    }
    return node;
  }

  function parseTemplate(file, parentId, component, ancestors) {
    const cycleKey = component?.selector || file.path;
    if (ancestors.includes(cycleKey)) {
      context.diagnostics.push(diagnostic('warning', 'component-cycle', `Skipped cyclic component ${cycleKey}.`, file.path, 1, parentId, 0.4, cycleKey));
      return;
    }
    parsedComponents.add(cycleKey);
    const document = parseFragment(file.content, { sourceCodeLocationInfo: true });
    walkChildren(document.childNodes ?? [], parentId, file, [...ancestors, cycleKey]);
  }

  function walkChildren(astNodes, parentId, file, ancestors) {
    for (const astNode of astNodes) walk(astNode, parentId, file, ancestors);
  }

  function walk(astNode, parentId, file, ancestors) {
    if (!astNode || astNode.nodeName === '#comment') return;
    if (astNode.nodeName === '#text') return;
    const tag = astNode.tagName || astNode.nodeName;
    const attrs = attributes(astNode);
    const classes = new Set((attrs.class ?? '').split(/\s+/).filter(Boolean));
    const line = astNode.sourceCodeLocation?.startLine ?? 1;
    const column = astNode.sourceCodeLocation?.startCol ?? 1;
    const text = visibleText(astNode);
    const custom = context.componentBySelector.get(tag);
    const semantic = classifyElement({ tag, attrs, classes, text, astNode, file, forms: context.forms });

    if (custom) {
      const customNode = addNode({
        idHint: attrs.id || custom.selector,
        type: 'section',
        name: text || humanize(custom.selector),
        role: `Imported child Angular component ${custom.selector}.`,
        parentId,
        file: file.path,
        line,
        column,
        selector: custom.selector,
        layout: columnLayout(),
        bindings: bindingsFromAttrs(attrs),
        initialState: initialStateFromAttrs(attrs, classes),
      });
      const childTemplate = custom.templatePath ? context.byPath.get(custom.templatePath) : null;
      if (childTemplate) parseTemplate(childTemplate, customNode.id, custom, ancestors);
      else context.diagnostics.push(diagnostic('warning', 'missing-child-template', `Template for ${custom.selector} was not provided.`, file.path, line, customNode.id, 0.45, custom.selector));
      return;
    }

    if (tag.includes('-') && !isKnownCustomTag(tag)) {
      const unknownNode = addNode({
        idHint: attrs.id || tag,
        type: customType(tag),
        name: text || humanize(tag),
        role: `Unresolved custom Angular component ${tag}.`,
        parentId,
        file: file.path,
        line,
        column,
        selector: tag,
        layout: columnLayout(),
        content: { label: text || tag, variant: 'unresolved-component' },
        bindings: bindingsFromAttrs(attrs),
        initialState: initialStateFromAttrs(attrs, classes),
      });
      context.diagnostics.push(diagnostic('warning', 'unknown-custom-component', `Custom component ${tag} requires a mapping or its source files.`, file.path, line, unknownNode.id, 0.35, tag));
      return;
    }

    if (!semantic) {
      walkChildren(astNode.childNodes ?? [], parentId, file, ancestors);
      return;
    }

    const controlName = stripExpression(attrs.formcontrolname);
    const formInfo = controlName ? context.forms.controls.get(controlName) : null;
    const label = semantic.label || nearestLabel(astNode) || controlName || text || humanize(semantic.type);
    const event = eventFromAttrs(attrs);
    const content = {
      ...semantic.content,
      ...(['text_input', 'select', 'checkbox', 'radio_group', 'toggle', 'slider', 'date_picker', 'file_upload', 'button', 'icon_button'].includes(semantic.type)
        && !semantic.content?.label ? { label } : {}),
      ...(controlName ? { data_binding: controlName } : {}),
    };
    const node = addNode({
      idHint: attrs.id || controlName || semantic.idHint || label,
      type: semantic.type,
      name: label,
      role: semantic.role,
      parentId,
      file: file.path,
      line,
      column,
      selector: selectorFor(tag, attrs, classes),
      layout: semantic.layout,
      content,
      style: semantic.style,
      constraints: semantic.constraints,
      bindings: {
        ...semantic.bindings,
        ...bindingsFromAttrs(attrs),
        ...(controlName ? { value: controlName } : {}),
        ...(formInfo?.disabled ? { enabled: 'false' } : {}),
      },
      validation: {
        ...validationFromAttrs(attrs),
        ...formInfo?.validation,
      },
      initialState: initialStateFromAttrs(attrs, classes),
      states: formInfo?.disabled || attrs.disabled !== undefined ? ['default', 'disabled'] : undefined,
      action: event?.handler || semantic.action,
      trigger: event?.trigger,
    });
    if (semantic.type === 'data_table') return;
    if (CONTAINER_TYPES.has(semantic.type)) {
      walkChildren(astNode.childNodes ?? [], node.id, file, ancestors);
    }
  }

  function finalizeChildren() {
    for (const node of nodes) {
      if (!CONTAINER_TYPES.has(node.type)) continue;
      node.children = children.get(node.id) ?? [];
    }
  }

  function postDiagnostics() {
    const result = [];
    for (const node of nodes) {
      if (['text_input', 'select', 'checkbox', 'radio_group', 'date_picker', 'button', 'icon_button'].includes(node.type)) {
        if (!node.content?.label && !node.content?.text) {
          result.push(diagnostic('warning', 'missing-label', `${node.name} has no reliable accessible label.`, node.source.file, node.source.line, node.id, 0.6));
        }
      }
    }
    return result;
  }

  return { nodes, interactions, addNode, parseTemplate, finalizeChildren, postDiagnostics };
}

function classifyElement({ tag, attrs, classes, text, astNode, forms }) {
  if (classes.has('txn-title')) {
    return { type: 'heading', label: text || 'Page title', role: 'Imported transaction title.', content: { text: text || 'Page title' } };
  }
  if (tag === 'form') {
    return { type: 'form', label: humanize(stripExpression(attrs['[formgroup]']) || 'Form'), role: 'Imported Angular form.', layout: columnLayout(), content: { action: 'submit:form' } };
  }
  if (tag === 'table') {
    return {
      type: 'data_table',
      label: attrs['aria-label'] || 'Data table',
      role: 'Imported data table with declared columns.',
      content: {
        label: attrs['aria-label'] || 'Imported data',
        data_binding: repeatExpression(astNode) || 'table.rows',
        columns: tableColumns(astNode),
      },
      constraints: { min_height: 160 },
    };
  }
  if (tag === 'input') {
    const inputType = (attrs.type || 'text').toLowerCase();
    if (inputType === 'checkbox') return { type: 'checkbox', label: '', role: 'Imported checkbox.', content: {} };
    if (inputType === 'radio') return { type: 'radio_group', label: '', role: 'Imported radio choice.', content: {} };
    if (inputType === 'file') return { type: 'file_upload', label: '', role: 'Imported file input.', content: {} };
    if (inputType === 'range') return { type: 'slider', label: '', role: 'Imported range control.', content: {} };
    return { type: 'text_input', label: '', role: 'Imported text input.', content: { placeholder: attrs.placeholder || '' } };
  }
  if (tag === 'textarea') return { type: 'textarea', label: '', role: 'Imported multiline input.', content: { placeholder: attrs.placeholder || '' } };
  if (tag === 'select') {
    const optionRepeat = findAttributeDeep(astNode, '*ngfor');
    return { type: 'select', label: '', role: 'Imported select control.', content: { placeholder: firstOptionText(astNode) || 'Choose option' }, bindings: optionRepeat ? { options: optionRepeat } : undefined };
  }
  if (tag === 'button' || tag === 'app-auth-button') {
    const label = attrs.title || text || humanize(tag);
    const iconOnly = !text && !attrs.title;
    return { type: iconOnly ? 'icon_button' : 'button', label, role: 'Imported action control.', content: { label, action: normalizeAction(eventFromAttrs(attrs)?.handler || label) } };
  }
  if (tag === 'sfap-datepicker') return { type: 'date_picker', label: '', role: 'Imported date picker.', content: {} };
  if (tag === 'a' && (text || eventFromAttrs(attrs))) {
    return { type: 'link', label: text || 'Link', role: 'Imported link.', content: { text: text || 'Link', action: normalizeAction(eventFromAttrs(attrs)?.handler || attrs.href || 'navigate') } };
  }
  if (tag === 'ul' && (classes.has('nav-tabs') || attrs.role === 'tablist')) return { type: 'tabs', label: 'Tabs', role: 'Imported tab selector.', layout: rowLayout() };
  if (tag === 'li' && classes.has('nav-item')) return { type: 'nav_item', label: text || 'Tab', role: 'Imported tab item.', content: { label: text || 'Tab', action: normalizeAction(eventFromAttrs(attrs)?.handler || `select:${slug(text)}`) } };
  if (classes.has('btn-area')) return { type: 'button_group', label: 'Actions', role: 'Imported action group.', layout: rowLayout() };
  if (classes.has('fix-table-container')) return { type: 'scroll_area', label: 'Scrollable table region', role: 'Imported horizontally scrollable region.', layout: columnLayout() };
  if (classes.has('txn-query-area')) return { type: 'section', label: 'Query area', role: 'Imported query and filter region.', layout: columnLayout() };
  if (classes.has('txn-edit-area')) return { type: 'toolbar', label: 'Table actions', role: 'Imported table action toolbar.', layout: rowLayout() };
  if (classes.has('collapse')) return { type: 'field_group', label: textHeading(astNode) || humanize(attrs.id || 'Collapsible group'), role: 'Imported collapsible field group.', layout: columnLayout() };
  if (classes.has('card') && classes.has('card-body')) return { type: 'section', label: textHeading(astNode) || 'Content section', role: 'Imported card body.', layout: columnLayout() };
  if ([...classes].some((className) => className.startsWith('txn-form-group'))) return { type: 'field_group', label: nearestLabel(astNode) || 'Field group', role: 'Imported labeled field group.', layout: rowLayout() };
  if (classes.has('row')) return { type: 'stack', label: 'Row', role: 'Imported Bootstrap row.', layout: rowLayout() };
  return null;
}

function readComponentMetadata(file) {
  const className = readClassName(file.content);
  const selector = matchStringProperty(file.content, 'selector');
  const templateUrl = matchStringProperty(file.content, 'templateUrl');
  const styleUrlsBlock = file.content.match(/styleUrls\s*:\s*\[([\s\S]*?)\]/m)?.[1] ?? '';
  const styleUrls = [...styleUrlsBlock.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (!selector && !templateUrl && !/@Component\s*\(/.test(file.content)) return null;
  return { selector, templateUrl, styleUrls, className };
}

function collectForms(files) {
  const controls = new Map();
  for (const file of files.filter((candidate) => candidate.path.endsWith('.ts'))) {
    for (const objectBlock of findGroupObjectBlocks(file.content)) {
      for (const property of splitObjectProperties(objectBlock)) {
        const name = property.name.replace(/^['"]|['"]$/g, '');
        const raw = property.value;
        const pattern = raw.match(/Validators\.pattern\(\s*(['"`])([\s\S]*?)\1\s*\)/)?.[2];
        controls.set(name, {
          disabled: /disabled\s*:\s*true/.test(raw),
          validation: compactObject({
            required: /Validators\.required/.test(raw) || undefined,
            pattern: pattern || undefined,
          }),
        });
      }
    }
  }
  return { controls };
}

function collectDesignSystem(files, diagnostics) {
  const designSystem = defaultDesignSystem();
  designSystem.name = 'Imported Angular styles';
  const values = { colors: new Set(), radii: new Set(), shadows: new Set(), spacing: new Set(), typography: new Set() };
  for (const file of files.filter((candidate) => /\.(scss|css)$/i.test(candidate.path))) {
    try {
      const root = file.path.endsWith('.scss')
        ? scssSyntax.parse(file.content, { from: file.path })
        : postcss.parse(file.content, { from: file.path });
      root.walkDecls((decl) => {
        if (/color|background|border-color/i.test(decl.prop)) {
          for (const value of decl.value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)/gi) ?? []) values.colors.add(value);
        }
        if (/border-radius/i.test(decl.prop)) values.radii.add(decl.value);
        if (/box-shadow/i.test(decl.prop)) values.shadows.add(decl.value);
        if (/^(gap|padding|margin)/i.test(decl.prop) && /^\d+(?:\.\d+)?(?:px|rem)$/.test(decl.value)) values.spacing.add(decl.value);
        if (/^(font|font-size|font-weight|line-height)/i.test(decl.prop)) values.typography.add(`${decl.prop}: ${decl.value}`);
      });
    } catch (error) {
      diagnostics.push(diagnostic('warning', 'scss-parse-failed', `Could not fully parse ${file.path}: ${error.message}`, file.path, 1, null, 0.5));
    }
  }
  assignTokens(designSystem.colors, 'imported.color', values.colors);
  assignTokens(designSystem.radii, 'imported.radius', values.radii);
  assignTokens(designSystem.shadows, 'imported.shadow', values.shadows);
  assignTokens(designSystem.spacing, 'imported.space', values.spacing);
  assignTokens(designSystem.typography, 'imported.type', values.typography);
  return { designSystem };
}

function tableColumns(tableNode) {
  const headers = [];
  const cells = firstTableDataCells(tableNode);
  walkHtml(tableNode, (node) => {
    if (node.tagName !== 'th') return;
    const attrs = attributes(node);
    const cell = cells[headers.length];
    const semanticNode = cell ?? node;
    const semanticAttrs = collectAttributesDeep(semanticNode);
    const header = visibleText(node) || `Column ${headers.length + 1}`;
    const style = `${attrs.style || ''};${semanticAttrs.style || ''}`;
    const widthMatch = style.match(/width\s*:\s*([\d.]+)(px|%|rem)/i);
    const binding = attrs['mat-sort-header'];
    const event = eventFromAttrs(semanticAttrs) ?? eventFromAttrs(collectAttributesDeep(node));
    headers.push(compactObject({
      id: uniqueColumnId(binding || header, headers),
      header: clamp(header, 128),
      data_binding: binding || interpolationBinding(semanticNode) || undefined,
      sortable: attrs['mat-sort-header'] !== undefined || undefined,
      cell_kind: inferColumnKind(semanticNode, header),
      icon: inferIcon(semanticNode),
      action: event?.handler ? normalizeAction(event.handler) : undefined,
      sticky: /position\s*:\s*sticky/i.test(style) || undefined,
      align: /text-align\s*:\s*center/i.test(style) ? 'center' : /text-align\s*:\s*right/i.test(style) ? 'end' : undefined,
      visible_when: attrs['*ngif'] || semanticAttrs['*ngif'] || undefined,
      width: widthMatch ? { value: Number(widthMatch[1]), unit: widthMatch[2] } : undefined,
    }));
  });
  return headers.length > 0 ? headers : [{ id: 'column_1', header: 'Column 1' }];
}

function firstTableDataCells(tableNode) {
  let cells = [];
  walkHtml(tableNode, (node) => {
    if (cells.length > 0 || node.tagName !== 'tr') return;
    const rowCells = (node.childNodes ?? []).filter((child) => child.tagName === 'td');
    if (rowCells.length > 0) cells = rowCells;
  });
  return cells;
}

function interpolationBinding(node) {
  let source = '';
  walkHtml(node, (child) => {
    if (child.nodeName === '#text') source += ` ${child.value || ''}`;
  });
  return stripExpression(source.match(/\{\{\s*([^{}|]+?)(?:\|[^{}]+)?\s*\}\}/)?.[1]);
}

function importedAcceptance(rootId, tableIds) {
  return [
    { id: 'acc_import_layout', type: 'layout', statement: 'Imported groups preserve their source order and hierarchy.', target: rootId, priority: 'must', verification_method: 'manual_visual' },
    { id: 'acc_import_interactions', type: 'interaction', statement: 'Imported event bindings remain declared as interactions.', target: '*', priority: 'must', verification_method: 'manual_ia_review' },
    { id: 'acc_import_responsive', type: 'responsive', statement: 'The imported screen remains readable at desktop, tablet, and mobile widths.', target: 'desktop,tablet,mobile', priority: 'must', verification_method: 'screenshot_diff' },
    { id: 'acc_import_a11y', type: 'a11y', statement: 'Imported form and action controls have accessible labels.', target: '*', priority: 'must', verification_method: 'axe_audit' },
    { id: 'acc_import_content', type: 'content', statement: 'Visible source labels and table headers are represented in the Blueprint.', target: '*', priority: 'must', verification_method: 'code_diff' },
    { id: 'acc_import_tables', type: 'layout', statement: 'Wide imported tables remain horizontally scrollable.', target: tableIds.join(',') || rootId, priority: 'should', verification_method: 'computed_style' },
  ];
}

function bindingsFromAttrs(attrs) {
  return compactObject({
    value: stripExpression(attrs.formcontrolname || attrs['[(ngmodel)]'] || attrs['[value]']),
    options: stripExpression(attrs['*ngfor']),
    visibility: stripExpression(attrs['*ngif'] || attrs['[hidden]']),
    enabled: attrs['[disabled]'] ? `!(${stripExpression(attrs['[disabled]'])})` : undefined,
    repeat: stripExpression(attrs['*ngfor']),
    selected: stripExpression(attrs['[checked]'] || attrs['[(ngmodel)]']),
  });
}

function initialStateFromAttrs(attrs, classes) {
  const hidden = attrs.hidden !== undefined || attrs['[hidden]'] === 'true' || /display\s*:\s*none/i.test(attrs.style || '');
  const collapse = classes.has('collapse');
  return compactObject({
    visibility: hidden ? 'hidden' : undefined,
    expanded: collapse ? classes.has('show') : undefined,
  });
}

function validationFromAttrs(attrs) {
  return compactObject({
    required: attrs.required !== undefined || undefined,
    pattern: attrs.pattern,
    min_length: numeric(attrs.minlength),
    max_length: numeric(attrs.maxlength),
    min: numeric(attrs.min),
    max: numeric(attrs.max),
  });
}

function eventFromAttrs(attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    const match = name.match(/^\(([^)]+)\)$/);
    if (!match || !value) continue;
    return { trigger: ANGULAR_EVENT_TO_TRIGGER[match[1].toLowerCase()] ?? 'click', handler: value };
  }
  return null;
}

function attributes(node) {
  return Object.fromEntries((node.attrs ?? []).map((attr) => [attr.name.toLowerCase(), attr.value]));
}

function collectAttributesDeep(node) {
  const result = { ...attributes(node) };
  walkHtml(node, (child) => Object.assign(result, attributes(child)));
  return result;
}

function walkHtml(node, visitor) {
  const stack = [{ node, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current.depth > MAX_TEMPLATE_NESTING_DEPTH) {
      throw new Error(`Angular template exceeds maximum nesting depth of ${MAX_TEMPLATE_NESTING_DEPTH}.`);
    }
    visitor(current.node);
    const children = current.node.childNodes ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], depth: current.depth + 1 });
    }
  }
}

function visibleText(node) {
  const parts = [];
  walkHtml(node, (child) => {
    if (child.nodeName === '#text') parts.push(child.value || '');
  });
  return clamp(parts.join(' ').replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/\s+/g, ' ').trim(), 160);
}

function nearestLabel(node) {
  let current = node;
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parentNode) {
    const direct = (current.childNodes ?? []).find((child) => child.tagName === 'label');
    if (direct) return visibleText(direct);
    let found = '';
    walkHtml(current, (child) => {
      if (!found && child.tagName === 'label') found = visibleText(child);
    });
    if (found) return found;
  }
  return '';
}

function textHeading(node) {
  let found = '';
  walkHtml(node, (child) => {
    if (!found && ['h1', 'h2', 'h3', 'h4', 'legend'].includes(child.tagName)) found = visibleText(child);
  });
  return found;
}

function firstOptionText(node) {
  let result = '';
  walkHtml(node, (child) => {
    if (!result && child.tagName === 'option') result = visibleText(child);
  });
  return result;
}

function findAttributeDeep(node, name) {
  let result;
  walkHtml(node, (child) => {
    result ??= attributes(child)[name];
  });
  return result;
}

function repeatExpression(node) {
  return stripExpression(findAttributeDeep(node, '*ngfor'));
}

function inferColumnKind(node, header) {
  const html = serializeNodeHint(node).toLowerCase();
  if (/checkbox/.test(html)) return 'checkbox';
  if (/glyphicon|fa\s/.test(html)) return /click/.test(html) ? 'action' : 'icon';
  if (/<a\b/.test(html)) return 'link';
  if (/date|日期|生日/.test(header)) return 'date';
  if (/amt|amount|balance|餘額|金額|點數|次數|月數/.test(`${header} ${html}`)) return 'number';
  return 'text';
}

function inferIcon(node) {
  let icon;
  walkHtml(node, (child) => {
    const className = attributes(child).class || '';
    const match = className.match(/(?:glyphicon|fa)-([a-z0-9-]+)/);
    if (!icon && match) icon = match[1];
  });
  return icon;
}

function serializeNodeHint(node) {
  const attrs = (node.attrs ?? []).map((attr) => `${attr.name}="${attr.value}"`).join(' ');
  return `<${node.tagName || node.nodeName} ${attrs}>`;
}

function selectorFor(tag, attrs, classes) {
  if (attrs.id) return `#${attrs.id}`;
  if (classes.size) return `${tag}.${[...classes].slice(0, 2).join('.')}`;
  return tag;
}

function customType(tag) {
  if (/button/.test(tag)) return 'button';
  if (/date/.test(tag)) return 'date_picker';
  if (/table|grid/.test(tag)) return 'data_table';
  return 'section';
}

function isKnownCustomTag(tag) {
  return ['sfap-datepicker', 'app-auth-button'].includes(tag);
}

function selectEntry(components, requested) {
  if (!requested) return components[0];
  const entry = components.find((component) => (
    component.selector === requested
    || component.templatePath === sanitizeSourcePath(requested)
    || component.tsPath === sanitizeSourcePath(requested)
  ));
  if (!entry) throw new Error(`Angular entry component not found: ${requested}`);
  return entry;
}

function inferScreenName(html, fallback) {
  const fragment = parseFragment(html);
  let result = '';
  walkHtml(fragment, (node) => {
    const classes = new Set((attributes(node).class || '').split(/\s+/));
    if (!result && classes.has('txn-title')) result = visibleText(node);
  });
  return clamp(result || humanize(fallback), 128);
}

function summarizeDiagnostics(diagnostics, nodeCount) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const item of diagnostics) {
    if (item.confidence >= 0.8) counts.high += 1;
    else if (item.confidence >= 0.5) counts.medium += 1;
    else counts.low += 1;
  }
  const penalty = diagnostics.reduce((total, item) => total + (item.severity === 'error' ? 0.2 : item.severity === 'warning' ? 0.05 : 0.01), 0);
  return {
    score: Math.max(0, Math.min(1, 1 - penalty / Math.max(1, nodeCount))),
    nodeCount,
    diagnosticCount: diagnostics.length,
    ...counts,
  };
}

function diagnostic(severity, code, message, file, line, nodeId, confidence = 0.5, detail) {
  return compactObject({
    severity,
    code,
    message,
    file: sanitizeSourcePath(file),
    line,
    node_id: nodeId || undefined,
    confidence,
    detail,
  });
}

function assignTokens(target, prefix, values) {
  let index = 1;
  for (const value of values) {
    if (Object.values(target).includes(value)) continue;
    target[`${prefix}.${index}`] = value;
    index += 1;
  }
}

function matchStringProperty(source, property) {
  return source.match(new RegExp(`${property}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`))?.[1] ?? null;
}

function readClassName(source) {
  return source.match(/\bexport\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\b/)?.[1]
    ?? source.match(/\bclass\s+([A-Za-z_$][\w$]*)\b/)?.[1]
    ?? null;
}

function findGroupObjectBlocks(source) {
  const blocks = [];
  const pattern = /\b(?:[A-Za-z_$][\w$]*\.)*group\s*\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    const openParen = source.indexOf('(', match.index);
    const firstArgument = nextNonWhitespace(source, openParen + 1);
    if (source[firstArgument] !== '{') continue;
    const closeBrace = findMatchingDelimiter(source, firstArgument, '{', '}');
    if (closeBrace === -1) continue;
    blocks.push(source.slice(firstArgument + 1, closeBrace));
    pattern.lastIndex = closeBrace + 1;
  }
  return blocks;
}

function splitObjectProperties(source) {
  const properties = [];
  let index = 0;
  while (index < source.length) {
    index = nextNonWhitespace(source, index);
    if (index >= source.length) break;
    const key = readObjectKey(source, index);
    if (!key) break;
    let cursor = nextNonWhitespace(source, key.end);
    if (source[cursor] !== ':') {
      index = nextPropertyBoundary(source, cursor) + 1;
      continue;
    }
    cursor = nextNonWhitespace(source, cursor + 1);
    const valueEnd = nextPropertyBoundary(source, cursor);
    properties.push({
      name: key.name,
      value: source.slice(cursor, valueEnd).trim(),
    });
    index = valueEnd + 1;
  }
  return properties;
}

function readObjectKey(source, index) {
  const quote = source[index];
  if (quote === '\'' || quote === '"' || quote === '`') {
    const end = readQuotedEnd(source, index);
    if (end === -1) return null;
    return { name: source.slice(index + 1, end), end: end + 1 };
  }
  const match = source.slice(index).match(/^([A-Za-z_$][\w$-]*)/);
  return match ? { name: match[1], end: index + match[0].length } : null;
}

function nextPropertyBoundary(source, index) {
  let cursor = index;
  let depth = 0;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '\'' || char === '"' || char === '`') {
      const end = readQuotedEnd(source, cursor);
      cursor = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('//', cursor)) {
      const end = source.indexOf('\n', cursor + 2);
      cursor = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      const end = source.indexOf('*/', cursor + 2);
      cursor = end === -1 ? source.length : end + 2;
      continue;
    }
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) return cursor;
    cursor += 1;
  }
  return source.length;
}

function findMatchingDelimiter(source, openIndex, open, close) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\'' || char === '"' || char === '`') {
      const end = readQuotedEnd(source, index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function readQuotedEnd(source, start) {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === quote) return index;
  }
  return -1;
}

function nextNonWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function resolveRelativeSource(fromPath, relativePath) {
  const base = fromPath.split('/').slice(0, -1);
  for (const part of relativePath.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return sanitizeSourcePath(base.join('/'));
}

function sanitizeSourcePath(path) {
  const parts = String(path).replace(/\\/g, '/').split('/');
  const safe = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') safe.pop();
    else safe.push(part);
  }
  return safe.join('/');
}

function normalizeAction(action) {
  const value = String(action || 'action').trim();
  if (/^[a-z][a-z0-9_-]*:/.test(value)) return value;
  const call = value.match(/^([a-zA-Z_$][\w$]*)\s*\(([\s\S]*)\)$/);
  return call ? `invoke:${call[1]}` : `invoke:${slug(value) || 'action'}`;
}

function stripExpression(value) {
  if (value == null) return undefined;
  return String(value).trim().replace(/^{{\s*|\s*}}$/g, '') || undefined;
}

function humanize(value) {
  return String(value || '')
    .replace(/^app-|^sfap-/, '')
    .replace(/\.component\.(html|ts)$/i, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function slug(value) {
  const ascii = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'imported-screen';
}

function uniqueId(hint, ids) {
  const base = slug(hint).replace(/\./g, '_').slice(0, 96) || 'node';
  const count = (ids.get(base) ?? 0) + 1;
  ids.set(base, count);
  return count === 1 ? base : `${base}_${count}`;
}

function uniqueColumnId(hint, columns) {
  const base = slug(hint).replace(/\./g, '_').slice(0, 96) || `column_${columns.length + 1}`;
  let id = base;
  let index = 2;
  while (columns.some((column) => column.id === id)) id = `${base}_${index++}`;
  return id;
}

function rowLayout() {
  return { mode: 'auto', display: 'flex', direction: 'row', wrap: true, align: 'center', gap: { x: 12, y: 12 } };
}

function columnLayout() {
  return { mode: 'auto', display: 'flex', direction: 'column', align: 'stretch', gap: { x: 12, y: 12 } };
}

function compactObject(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function numeric(value) {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function clamp(value, max) {
  return String(value || '').slice(0, max);
}
