import Ajv2020 from 'ajv/dist/2020.js';
import { useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Palette } from './components/Palette';
import { TreeView } from './components/TreeView';
import { PropertiesPanel } from './components/PropertiesPanel';
import { downloadBlob } from './lib/io';
import { addNode, createNode, deleteNode, updateNode } from './lib/store';
import type { Blueprint, ComponentType } from './types';
import schemaJson from '../../../schema/ui-blueprint.schema.json';

// Compile the schema once at module load.
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
      id: 'acc_demo_a11y',
      type: 'a11y',
      statement: 'All interactive elements are keyboard-reachable.',
      target: '*',
      priority: 'must',
      verification_method: 'manual_visual',
    },
  ],
};

export function App() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  }

  function handleAdd(type: ComponentType) {
    if (!blueprint) {
      // First-time use: load the starter so the user has a place to add to.
      setBlueprint({ ...STARTER, nodes: [{ ...STARTER.nodes[0]! }] });
      const node = createNode(type);
      setBlueprint((cur) => (cur ? addNode(cur, node) : cur));
      setSelectedId(node.id);
      return;
    }
    const node = createNode(type);
    setBlueprint((cur) => (cur ? addNode(cur, node) : cur));
    setSelectedId(node.id);
  }

  function handleUpdate(patch: Partial<import('./types').UINode>) {
    if (!blueprint || !selectedId) return;
    setBlueprint((cur) => (cur ? updateNode(cur, selectedId, patch) : cur));
  }

  function handleDelete() {
    if (!blueprint || !selectedId) return;
    setBlueprint((cur) => (cur ? deleteNode(cur, selectedId) : cur));
    setSelectedId(null);
  }

  async function handleExportMarkdown() {
    if (!blueprint) return;
    const md = await exportMarkdown(blueprint);
    downloadBlob(`${blueprint.screen.id}.ui.md`, md, 'text/markdown');
  }

  const selectedNode = blueprint?.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="app">
      <TopBar
        blueprint={blueprint}
        onImport={handleImport}
        onExportMarkdown={handleExportMarkdown}
        errorCount={errors.length}
        fileInputRef={fileInputRef}
      />
      <div className="body">
        <Palette onAdd={handleAdd} />
        <TreeView
          blueprint={blueprint}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <PropertiesPanel node={selectedNode} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
      <footer className="statusbar">
        {blueprint ? (
          <>
            <span>
              {blueprint.nodes.length} node{blueprint.nodes.length === 1 ? '' : 's'} ·{' '}
              {blueprint.interactions.length} interaction{blueprint.interactions.length === 1 ? '' : 's'} ·{' '}
              {blueprint.acceptance.length} acceptance
            </span>
            <span style={{ marginLeft: 'auto' }} className={errors.length > 0 ? 'err' : 'ok'}>
              {errors.length > 0 ? `${errors.length} schema error${errors.length === 1 ? '' : 's'}` : 'schema valid'}
            </span>
          </>
        ) : (
          <span>Click "Import JSON" or add a component from the palette to begin.</span>
        )}
      </footer>
    </div>
  );
}
