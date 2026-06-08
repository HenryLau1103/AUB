import Ajv2020 from 'ajv/dist/2020.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { downloadBlob } from './lib/io';
import { componentLabel, t, type Language } from './lib/i18n';
import { isContainerType } from './lib/registry';
import {
  addNode,
  createNode,
  defaultLayoutForType,
  deleteNode,
  updateNode,
  wrapRootInAppShell,
} from './lib/store';
import { createTemplateBlueprint, templateLabel, type TemplateId } from './lib/templates';
import type { Blueprint, ComponentType, UINode } from './types';
import schemaJson from '../../../schema/ui-blueprint.schema.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schemaJson as object);

async function exportMarkdown(blueprint: Blueprint): Promise<string> {
  const mod = await import('../../../scripts/export-md.lib.mjs');
  return mod.exportMarkdown(blueprint);
}

const STARTER: Blueprint = {
  version: '0.1.0',
  screen: {
    id: 'demo.screen',
    name: 'New Screen',
    type: 'landing',
    platform: 'web',
    primary_user_goal: 'Describe what the user accomplishes here.',
  },
  viewports: [
    { id: 'desktop', width: 1440, height: 900 },
    { id: 'mobile', width: 390, height: 844 },
  ],
  nodes: [
    {
      id: 'root',
      type: 'page',
      name: 'Page',
      role: 'Root container. Children added from the palette appear here.',
      parent_id: null,
      children: [],
    },
  ],
  interactions: [],
  responsive: [],
  acceptance: [
    {
      id: 'acc_starter_layout',
      type: 'layout',
      statement: 'Root page keeps all dropped components inside a single scrollable screen area.',
      target: 'root',
      priority: 'must',
      verification_method: 'manual_visual',
    },
    {
      id: 'acc_starter_interaction',
      type: 'interaction',
      statement: 'Every declared button or menu has an explicit action intent before handoff.',
      target: '*',
      priority: 'must',
      verification_method: 'manual_ia_review',
    },
    {
      id: 'acc_starter_responsive',
      type: 'responsive',
      statement: 'The screen remains readable in both desktop and mobile viewports.',
      target: 'desktop,mobile',
      priority: 'must',
      verification_method: 'manual_visual',
    },
    {
      id: 'acc_starter_a11y',
      type: 'a11y',
      statement: 'All interactive elements are keyboard-reachable.',
      target: '*',
      priority: 'must',
      verification_method: 'manual_visual',
    },
    {
      id: 'acc_starter_content',
      type: 'content',
      statement: 'Each visible component has a clear name or label.',
      target: '*',
      priority: 'should',
      verification_method: 'manual_ia_review',
    },
  ],
};

function createStarterBlueprint(language: Language): Blueprint {
  return {
    ...STARTER,
    screen: {
      ...STARTER.screen,
      name: t(language, 'starterScreenName'),
      primary_user_goal: t(language, 'starterPrimaryGoal'),
    },
    viewports: STARTER.viewports.map((viewport) => ({ ...viewport })),
    nodes: STARTER.nodes.map((node) => ({
      ...node,
      name: node.id === 'root' ? t(language, 'starterRootName') : node.name,
      role: node.id === 'root' ? t(language, 'starterRootRole') : node.role,
      children: [...(node.children ?? [])],
      layout: node.layout ?? defaultLayoutForType(node.type),
    })),
    interactions: [],
    responsive: [],
    acceptance: STARTER.acceptance.map((item) => ({ ...item })),
  };
}

function createAppStarterBlueprint(language: Language): Blueprint {
  const base = createStarterBlueprint(language);
  const nodes: UINode[] = [
    {
      id: 'app_shell',
      type: 'app_shell',
      name: t(language, 'starterAppShellName'),
      role: t(language, 'starterAppShellRole'),
      parent_id: null,
      children: ['starter_sidebar', 'starter_top_bar', 'starter_main_page'],
    },
    {
      id: 'starter_sidebar',
      type: 'sidebar',
      name: t(language, 'starterSidebarName'),
      role: t(language, 'starterSidebarRole'),
      parent_id: 'app_shell',
      children: [],
      layout: defaultLayoutForType('sidebar'),
    },
    {
      id: 'starter_top_bar',
      type: 'top_bar',
      name: t(language, 'starterTopBarName'),
      role: t(language, 'starterTopBarRole'),
      parent_id: 'app_shell',
      children: [],
      layout: defaultLayoutForType('top_bar'),
    },
    {
      id: 'starter_main_page',
      type: 'page',
      name: t(language, 'starterMainPageName'),
      role: t(language, 'starterMainPageRole'),
      parent_id: 'app_shell',
      children: [],
      layout: defaultLayoutForType('page'),
    },
  ];

  return {
    ...base,
    screen: {
      ...base.screen,
      id: 'starter.app',
      name: t(language, 'starterAppScreenName'),
      type: 'dashboard',
      primary_user_goal: t(language, 'starterAppGoal'),
    },
    nodes,
  };
}

export function App() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [notice, setNotice] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<ComponentType | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => {
    if (!blueprint) return [];
    const ok = validateSchema(blueprint);
    if (ok) return [];
    return (validateSchema.errors ?? []).map((e) => {
      const path = e.instancePath || '(root)';
      return `${path} ${e.message}`;
    });
  }, [blueprint]);

  function handleImport(b: Blueprint) {
    setBlueprint(b);
    setSelectedId(b.nodes.find((n) => n.parent_id === null)?.id ?? null);
    setNotice(null);
  }

  function handleTemplateSelect(templateId: TemplateId) {
    const nextBlueprint = createTemplateBlueprint(templateId, language);
    setBlueprint(nextBlueprint);
    setSelectedId(nextBlueprint.nodes.find((node) => node.parent_id === null)?.id ?? null);
    setNotice(t(language, 'templateLoaded', { template: templateLabel(language, templateId) }));
  }

  function handleCreateStarter(kind: 'page' | 'app') {
    const nextBlueprint = kind === 'app'
      ? createAppStarterBlueprint(language)
      : createStarterBlueprint(language);
    const selectedNodeId = kind === 'app'
      ? 'starter_main_page'
      : nextBlueprint.nodes.find((node) => node.parent_id === null)?.id ?? null;
    setBlueprint(nextBlueprint);
    setSelectedId(selectedNodeId);
    setNotice(t(language, kind === 'app' ? 'starterAppCreated' : 'starterPageCreated'));
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (draggingType) setPropertiesOpen(false);
  }, [draggingType]);

  function handleAdd(type: ComponentType, parentId: string | null = null) {
    const localizedType = componentLabel(language, type);
    const createsRoot = !blueprint && (type === 'page' || type === 'app_shell');
    const isShellSlot = type === 'top_bar' || type === 'header' || type === 'bottom_nav';
    const node = createNode(
      type,
      t(language, 'addedByEditor', { type: localizedType }),
      localizedType
    );
    const currentRoot = blueprint?.nodes.find((candidate) => candidate.parent_id === null) ?? null;
    const routesToExistingShell = isShellSlot && currentRoot?.type === 'app_shell';
    const wrapsInShell = isShellSlot && currentRoot?.type !== 'app_shell';
    const shell = wrapsInShell
      ? createNode(
          'app_shell',
          t(language, 'starterAppShellRole'),
          t(language, 'starterAppShellName')
        )
      : null;
    const selectedNode = selectedId
      ? blueprint?.nodes.find((candidate) => candidate.id === selectedId)
      : null;
    const targetParent = routesToExistingShell
      ? currentRoot?.id ?? null
      : parentId ?? (
          selectedNode && isContainerType(selectedNode.type) ? selectedNode.id : selectedNode?.parent_id ?? null
        );
    const targetNode = targetParent
      ? blueprint?.nodes.find((candidate) => candidate.id === targetParent) ?? null
      : currentRoot;
    const isPageSidebar = type === 'sidebar' && targetNode?.type !== 'app_shell';
    const placedNode: UINode = isPageSidebar
      ? {
          ...node,
          layout: {
            ...node.layout,
            width: { value: 240, unit: 'px' },
          },
        }
      : node;
    const targetName = targetParent
      ? blueprint?.nodes.find((candidate) => candidate.id === targetParent)?.name ?? t(language, 'starterRootName')
      : blueprint?.nodes.find((candidate) => candidate.parent_id === null)?.name ?? t(language, 'starterRootName');

    setBlueprint((cur) => {
      const base = cur ?? createStarterBlueprint(language);
      const root = base.nodes.find((candidate) => candidate.parent_id === null);
      if (isShellSlot) {
        if (root?.type === 'app_shell') return addNode(base, placedNode, root.id);
        if (shell) return wrapRootInAppShell(base, shell, placedNode);
      }
      if (!cur && createsRoot) {
        return {
          ...base,
          nodes: [{ ...placedNode, parent_id: null }],
        };
      }
      const added = addNode(base, placedNode, targetParent);
      if (type !== 'sidebar') return added;

      const actualParentId = targetParent ?? root?.id ?? null;
      const actualParent = actualParentId
        ? added.nodes.find((candidate) => candidate.id === actualParentId) ?? null
        : null;
      if (!actualParent || actualParent.type === 'app_shell') return added;

      return updateNode(added, actualParent.id, {
        layout: {
          ...actualParent.layout,
          display: 'flex',
          direction: 'row',
          wrap: false,
          align: 'stretch',
          gap: actualParent.layout?.gap ?? { x: 16, y: 16 },
        },
      });
    });
    setSelectedId(node.id);
    setNotice(
      wrapsInShell
        ? t(language, 'shellSlotPlaced', { component: localizedType })
        : isPageSidebar
          ? t(language, 'pageSidebarPlaced', { container: targetName })
        : createsRoot
          ? t(language, 'createdRoot', { component: localizedType })
          : t(language, 'addedToContainer', { component: localizedType, container: targetName })
    );
  }

  function handleUpdate(id: string, patch: Partial<UINode>) {
    if (!blueprint) return;
    setBlueprint((cur) => (cur ? updateNode(cur, id, patch) : cur));
  }

  function handleDelete(id: string) {
    if (!blueprint) return;
    const node = blueprint.nodes.find((candidate) => candidate.id === id);
    if (!node || node.parent_id === null) return;
    setBlueprint((cur) => (cur ? deleteNode(cur, id) : cur));
    if (selectedId === id) setSelectedId(null);
  }

  async function handleExportMarkdown() {
    if (!blueprint) return;
    const md = await exportMarkdown(blueprint);
    downloadBlob(`${blueprint.screen.id}.ui.md`, md, 'text/markdown');
  }

  const selectedNode = blueprint?.nodes.find((n) => n.id === selectedId) ?? null;

  function handlePropertiesUpdate(patch: Partial<UINode>) {
    if (selectedId) handleUpdate(selectedId, patch);
  }

  function handlePropertiesDelete() {
    if (selectedId) handleDelete(selectedId);
  }

  return (
    <div className="app">
      <TopBar
        blueprint={blueprint}
        onImport={handleImport}
        onExportMarkdown={handleExportMarkdown}
        errorCount={errors.length}
        fileInputRef={fileInputRef}
        language={language}
        onLanguageChange={setLanguage}
        onTemplateSelect={handleTemplateSelect}
      />
      <div className={`body${propertiesOpen ? '' : ' properties-collapsed'}`}>
        <Palette
          language={language}
          onAdd={(type) => handleAdd(type)}
          draggingType={draggingType}
          onDraggingTypeChange={setDraggingType}
        />
        <Canvas
          blueprint={blueprint}
          selectedId={selectedId}
          language={language}
          onSelect={setSelectedId}
          onAddNode={handleAdd}
          onDeleteNode={handleDelete}
          onUpdateNode={handleUpdate}
          onCreateStarter={handleCreateStarter}
          onTemplateSelect={handleTemplateSelect}
          draggingType={draggingType}
          onDragComplete={() => setDraggingType(null)}
          propertiesOpen={propertiesOpen}
          onPropertiesOpen={() => setPropertiesOpen(true)}
        />
        {propertiesOpen && (
          <PropertiesPanel
            node={selectedNode}
            language={language}
            onUpdate={handlePropertiesUpdate}
            onDelete={handlePropertiesDelete}
            onCollapse={() => setPropertiesOpen(false)}
            onSelectParent={() => {
              if (selectedNode?.parent_id) setSelectedId(selectedNode.parent_id);
            }}
          />
        )}
      </div>
      {notice && (
        <div className="toast-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}
      <footer className="statusbar">
        {blueprint ? (
          <>
            <span>
              {blueprint.nodes.length} {t(language, blueprint.nodes.length === 1 ? 'node' : 'nodes')} ·{' '}
              {blueprint.interactions.length} {t(language, blueprint.interactions.length === 1 ? 'interaction' : 'interactions')} ·{' '}
              {blueprint.acceptance.length} {t(language, 'acceptance')}
            </span>
            <span style={{ marginLeft: 'auto' }} className={errors.length > 0 ? 'err' : 'ok'}>
              {errors.length > 0
                ? `${errors.length} ${t(language, errors.length === 1 ? 'schemaError' : 'schemaErrors')}`
                : t(language, 'schemaValid')}
            </span>
          </>
        ) : (
          <span>{t(language, 'startHint')}</span>
        )}
      </footer>
    </div>
  );
}
