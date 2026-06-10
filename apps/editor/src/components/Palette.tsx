import { useMemo, useState } from 'react';
import { Boxes, Download, Layers3, LayoutTemplate, Save, Trash2 } from 'lucide-react';
import { categoryDescription, categoryLabel, componentDescription, componentLabel, t, type Language } from '../lib/i18n';
import { getCategories, isContainerType } from '../lib/registry';
import { TEMPLATE_GROUPS, templateDescription, templateLabel, type TemplateId } from '../lib/templates';
import type { Blueprint, ComponentType, UINode } from '../types';
import type { PersonalTemplate } from '../lib/personal-templates';

interface Props {
  blueprint: Blueprint | null;
  selectedIds: string[];
  language: Language;
  onAdd: (type: ComponentType) => void;
  onSelect: (ids: string[]) => void;
  onReparent: (id: string, parentId: string) => void;
  onTemplateSelect: (id: TemplateId) => void;
  draggingType: ComponentType | null;
  onDraggingTypeChange: (type: ComponentType | null) => void;
  personalTemplates: PersonalTemplate[];
  onSavePersonalTemplate: (name: string) => void;
  onLoadPersonalTemplate: (template: PersonalTemplate) => void;
  onExportPersonalTemplate: (template: PersonalTemplate) => void;
  onDeletePersonalTemplate: (template: PersonalTemplate) => void;
}

type PaletteTab = 'components' | 'templates' | 'layers';

export function Palette({
  blueprint,
  selectedIds,
  language,
  onAdd,
  onSelect,
  onReparent,
  onTemplateSelect,
  draggingType,
  onDraggingTypeChange,
  personalTemplates,
  onSavePersonalTemplate,
  onLoadPersonalTemplate,
  onExportPersonalTemplate,
  onDeletePersonalTemplate,
}: Props) {
  const [tab, setTab] = useState<PaletteTab>('components');
  const [query, setQuery] = useState('');
  const [personalName, setPersonalName] = useState('');

  return (
    <aside className="panel palette">
      <div className="side-tabs">
        <TabButton active={tab === 'components'} icon={<Boxes />} label={t(language, 'components')} onClick={() => setTab('components')} />
        <TabButton active={tab === 'templates'} icon={<LayoutTemplate />} label={t(language, 'templates')} onClick={() => setTab('templates')} />
        <TabButton active={tab === 'layers'} icon={<Layers3 />} label={t(language, 'layers')} onClick={() => setTab('layers')} />
      </div>
      {tab === 'components' && (
        <>
          <input className="palette-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(language, 'searchComponents')} />
          <p className="palette-hint">{t(language, 'paletteHint')}</p>
          {getCategories().map((category) => {
            const types = category.types.filter((type) => {
              const text = `${type.name} ${componentLabel(language, type.name)} ${componentDescription(language, type.name, type.description)}`.toLowerCase();
              return text.includes(query.toLowerCase());
            });
            if (!types.length) return null;
            return (
              <section className="palette-category" key={category.id}>
                <h3 title={categoryDescription(language, category.id, category.description)}>{categoryLabel(language, category.id, category.name)}</h3>
                {types.map((type) => (
                  <div
                    key={type.name}
                    className={`palette-item${draggingType === type.name ? ' dragging' : ''}`}
                    draggable
                    title={componentDescription(language, type.name, type.description)}
                    onClick={() => onAdd(type.name)}
                    onPointerDown={() => onDraggingTypeChange(type.name)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy';
                      event.dataTransfer.setData('application/aub-component-type', type.name);
                      event.dataTransfer.setData('text/plain', type.name);
                      onDraggingTypeChange(type.name);
                    }}
                    onDragEnd={() => onDraggingTypeChange(null)}
                  >
                    <span>{componentLabel(language, type.name, type.displayName)}</span>
                    <span className="kind">{type.isContainer ? t(language, 'container') : t(language, 'leaf')}</span>
                  </div>
                ))}
              </section>
            );
          })}
        </>
      )}
      {tab === 'templates' && (
        <div className="template-browser">
          <section className="personal-template-section">
            <h3>{language === 'zh-Hant' ? '個人範本' : 'Personal templates'}</h3>
            <div className="personal-template-save">
              <input
                value={personalName}
                onChange={(event) => setPersonalName(event.target.value)}
                placeholder={language === 'zh-Hant' ? '範本名稱' : 'Template name'}
              />
              <button
                type="button"
                title={language === 'zh-Hant' ? '儲存目前畫面為個人範本' : 'Save current screen as a personal template'}
                disabled={!blueprint}
                onClick={() => {
                  onSavePersonalTemplate(personalName);
                  setPersonalName('');
                }}
              >
                <Save />
                {language === 'zh-Hant' ? '儲存' : 'Save'}
              </button>
            </div>
            {personalTemplates.length === 0 && (
              <p className="empty">{language === 'zh-Hant' ? '尚未儲存個人範本。' : 'No personal templates saved.'}</p>
            )}
            {personalTemplates.map((template) => (
              <div className="personal-template-item" key={template.id}>
                <button type="button" className="personal-template-load" onClick={() => onLoadPersonalTemplate(template)}>
                  {template.preview
                    ? <img src={template.preview} alt={language === 'zh-Hant' ? `${template.name} 預覽` : `${template.name} preview`} />
                    : <div className="template-preview-empty"><LayoutTemplate /></div>}
                  <span>
                    <strong>{template.name}</strong>
                    <small>{new Date(template.updatedAt).toLocaleDateString(language === 'zh-Hant' ? 'zh-TW' : 'en-US')}</small>
                  </span>
                </button>
                <div className="personal-template-actions">
                  <button
                    type="button"
                    aria-label={language === 'zh-Hant' ? `匯出範本「${template.name}」` : `Export template "${template.name}"`}
                    title={language === 'zh-Hant' ? '匯出範本' : 'Export template'}
                    onClick={() => onExportPersonalTemplate(template)}
                  >
                    <Download />
                  </button>
                  <button
                    type="button"
                    aria-label={language === 'zh-Hant' ? `刪除範本「${template.name}」` : `Delete template "${template.name}"`}
                    title={language === 'zh-Hant' ? '刪除範本' : 'Delete template'}
                    onClick={() => onDeletePersonalTemplate(template)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
          </section>
          {TEMPLATE_GROUPS.map((group) => (
            <section key={group.id}>
              <h3>{language === 'zh-Hant' ? group.labelZh : group.labelEn}</h3>
              {group.ids.map((id) => (
                <button key={id} type="button" onClick={() => onTemplateSelect(id)}>
                  <img
                    src={`/template-previews/${id}.png`}
                    alt={language === 'zh-Hant'
                      ? `${templateLabel(language, id)}範本預覽`
                      : `${templateLabel(language, id)} template preview`}
                    loading="lazy"
                  />
                  <span className="template-browser-copy">
                    <strong>{templateLabel(language, id)}</strong>
                    <span>{templateDescription(language, id)}</span>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      {tab === 'layers' && (
        <LayerTree
          blueprint={blueprint}
          selectedIds={selectedIds}
          language={language}
          onSelect={onSelect}
          onReparent={onReparent}
        />
      )}
    </aside>
  );
}

function LayerTree({
  blueprint,
  selectedIds,
  language,
  onSelect,
  onReparent,
}: {
  blueprint: Blueprint | null;
  selectedIds: string[];
  language: Language;
  onSelect: (ids: string[]) => void;
  onReparent: (id: string, parentId: string) => void;
}) {
  const tree = useMemo(() => buildLayerTree(blueprint), [blueprint]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  if (!tree.root) return <p className="empty">{t(language, 'noLayers')}</p>;

  function renderNode(node: UINode, depth = 0): JSX.Element {
    const children = tree.children.get(node.id) ?? [];
    return (
      <div key={node.id}>
        <button
          type="button"
          className={`layer-row${selectedIds.includes(node.id) ? ' selected' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          draggable={node.parent_id !== null}
          onDragStart={() => setDraggedId(node.id)}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => {
            if (draggedId && isContainerType(node.type) && draggedId !== node.id) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedId && isContainerType(node.type)) onReparent(draggedId, node.id);
            setDraggedId(null);
          }}
          onClick={(event) => onSelect(event.shiftKey ? [...selectedIds, node.id] : [node.id])}
        >
          <span>{isContainerType(node.type) ? '▾' : '•'}</span>
          <span>{node.name}</span>
          <small>{componentLabel(language, node.type)}</small>
        </button>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return <div className="layer-tree">{renderNode(tree.root)}</div>;
}

function buildLayerTree(blueprint: Blueprint | null) {
  const root = blueprint?.nodes.find((node) => node.parent_id === null) ?? null;
  const children = new Map<string, UINode[]>();
  for (const node of blueprint?.nodes ?? []) {
    if (!node.parent_id) continue;
    const list = children.get(node.parent_id) ?? [];
    list.push(node);
    children.set(node.parent_id, list);
  }
  return { root, children };
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return <button type="button" className={active ? 'active' : ''} onClick={onClick} title={label}>{icon}<span>{label}</span></button>;
}
