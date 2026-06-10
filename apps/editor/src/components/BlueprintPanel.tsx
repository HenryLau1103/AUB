import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  Acceptance,
  AcceptancePriority,
  AcceptanceType,
  Blueprint,
  Interaction,
  InteractionTrigger,
  Platform,
  Responsive,
  ResponsiveRule,
  ResponsiveViewport,
  ScreenType,
  VerificationMethod,
} from '../types';
import { componentLabel, type Language } from '../lib/i18n';
import type { ViewportQualityIssue, ViewportQualityReport } from '../lib/viewport-quality';
import { workflowReadiness, type WorkflowStage } from './WorkflowBar';
import { Tooltip } from './Tooltip';

interface Props {
  blueprint: Blueprint;
  language: Language;
  stage: Exclude<WorkflowStage, 'layout'>;
  errorCount: number;
  viewportQuality: ViewportQualityReport | null;
  onChange: (patch: Partial<Blueprint>) => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportAgentPrompt: () => void;
  onExportPackage: () => void;
}

export function BlueprintPanel({
  blueprint,
  language,
  stage,
  errorCount,
  viewportQuality,
  onChange,
  onExportJson,
  onExportMarkdown,
  onExportAgentPrompt,
  onExportPackage,
}: Props) {
  const copy = COPY[language];

  return (
    <aside className="blueprint-panel">
      <header>
        <div>
          <span>{copy.workflow}</span>
          <h2>{copy.stageTitles[stage]}</h2>
        </div>
        <small>{copy.stageDescriptions[stage]}</small>
      </header>

      <div className="blueprint-panel-content">
        {stage === 'brief' && (
          <ScreenEditor blueprint={blueprint} language={language} onChange={onChange} />
        )}
        {stage === 'interactions' && (
          <InteractionEditor blueprint={blueprint} language={language} onChange={onChange} />
        )}
        {stage === 'responsive' && (
          <ResponsiveEditor
            blueprint={blueprint}
            language={language}
            viewportQuality={viewportQuality}
            onChange={onChange}
          />
        )}
        {stage === 'acceptance' && (
          <AcceptanceEditor blueprint={blueprint} language={language} onChange={onChange} />
        )}
        {stage === 'handoff' && (
          <HandoffPanel
            blueprint={blueprint}
            language={language}
            errorCount={errorCount}
            viewportQuality={viewportQuality}
            onExportJson={onExportJson}
            onExportMarkdown={onExportMarkdown}
            onExportAgentPrompt={onExportAgentPrompt}
            onExportPackage={onExportPackage}
          />
        )}
      </div>
    </aside>
  );
}

function ScreenEditor({
  blueprint,
  language,
  onChange,
}: Pick<Props, 'blueprint' | 'language' | 'onChange'>) {
  const copy = COPY[language];
  const update = (patch: Partial<Blueprint['screen']>) => onChange({
    screen: { ...blueprint.screen, ...patch },
  });

  return (
    <div className="spec-form">
      <Field label={copy.screenName}>
        <input value={blueprint.screen.name} onChange={(event) => update({ name: event.target.value })} />
      </Field>
      <Field label={copy.screenId}>
        <input value={blueprint.screen.id} onChange={(event) => update({ id: normalizeId(event.target.value) })} />
      </Field>
      <div className="spec-two-columns">
        <Field label={copy.screenType}>
          <select value={blueprint.screen.type} onChange={(event) => update({ type: event.target.value as ScreenType })}>
            {SCREEN_TYPES.map((type) => <option key={type} value={type}>{screenTypeLabel(language, type)}</option>)}
          </select>
        </Field>
        <Field label={copy.platform}>
          <select value={blueprint.screen.platform} onChange={(event) => update({ platform: event.target.value as Platform })}>
            {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platformLabel(language, platform)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={copy.primaryGoal} hint={copy.primaryGoalHint}>
        <textarea
          value={blueprint.screen.primary_user_goal}
          onChange={(event) => update({ primary_user_goal: event.target.value })}
        />
      </Field>
      <Field label={copy.agentNotes} hint={copy.agentNotesHint}>
        <textarea value={blueprint.screen.notes ?? ''} onChange={(event) => update({ notes: event.target.value || undefined })} />
      </Field>
    </div>
  );
}

function InteractionEditor({
  blueprint,
  language,
  onChange,
}: Pick<Props, 'blueprint' | 'language' | 'onChange'>) {
  const copy = COPY[language];
  const update = (index: number, patch: Partial<Interaction>) => {
    const interactions = blueprint.interactions.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    onChange({ interactions });
  };
  const remove = (index: number) => onChange({
    interactions: blueprint.interactions.filter((_, itemIndex) => itemIndex !== index),
  });
  const add = () => {
    const source = blueprint.nodes.find((node) => node.parent_id !== null) ?? blueprint.nodes[0];
    onChange({
      interactions: [...blueprint.interactions, {
        id: uniqueId('interaction', blueprint.interactions.map((item) => item.id)),
        trigger: 'click',
        source_node_id: source?.id ?? 'root',
        action: 'navigate:/',
        target: '/',
        result_state: copy.defaultResult,
      }],
    });
  };

  return (
    <CollectionEditor
      title={copy.interactionsTitle}
      empty={copy.noInteractions}
      addLabel={copy.addInteraction}
      count={blueprint.interactions.length}
      onAdd={add}
    >
      {blueprint.interactions.map((interaction, index) => (
        <SpecCard
          key={interaction.id}
          title={`${index + 1}. ${interaction.id}`}
          deleteLabel={copy.deleteItem}
          onDelete={() => remove(index)}
        >
          <div className="spec-two-columns">
            <Field label={copy.trigger}>
              <select value={interaction.trigger} onChange={(event) => update(index, { trigger: event.target.value as InteractionTrigger })}>
                {INTERACTION_TRIGGERS.map((trigger) => <option key={trigger} value={trigger}>{triggerLabel(language, trigger)}</option>)}
              </select>
            </Field>
            <Field label={copy.sourceComponent}>
              <select value={interaction.source_node_id} onChange={(event) => update(index, { source_node_id: event.target.value })}>
                {blueprint.nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.name} · {componentLabel(language, node.type)}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={copy.actionIntent}>
            <input value={interaction.action} onChange={(event) => update(index, { action: event.target.value })} />
          </Field>
          <Field label={copy.target}>
            <input value={interaction.target ?? ''} onChange={(event) => update(index, { target: event.target.value || undefined })} />
          </Field>
          <Field label={copy.resultState} hint={copy.resultStateHint}>
            <textarea value={interaction.result_state} onChange={(event) => update(index, { result_state: event.target.value })} />
          </Field>
        </SpecCard>
      ))}
    </CollectionEditor>
  );
}

function ResponsiveEditor({
  blueprint,
  language,
  viewportQuality,
  onChange,
}: Pick<Props, 'blueprint' | 'language' | 'viewportQuality' | 'onChange'>) {
  const copy = COPY[language];
  const update = (index: number, patch: Partial<Responsive>) => onChange({
    responsive: blueprint.responsive.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )),
  });
  const add = () => onChange({
    responsive: [...blueprint.responsive, {
      viewport: 'mobile',
      rule: 'stack',
      target_node_id: blueprint.nodes[0]?.id ?? 'root',
      changes: {},
    }],
  });

  return (
    <div className="responsive-editor">
      <ViewportQualitySummary
        blueprint={blueprint}
        language={language}
        report={viewportQuality}
      />
      <CollectionEditor
        title={copy.responsiveTitle}
        empty={copy.noResponsive}
        addLabel={copy.addResponsive}
        count={blueprint.responsive.length}
        onAdd={add}
      >
        {blueprint.responsive.map((item, index) => (
          <SpecCard
            key={`${item.viewport}-${item.target_node_id}-${index}`}
            title={`${index + 1}. ${viewportLabelLocal(language, item.viewport)} · ${responsiveRuleLabel(language, item.rule)}`}
            deleteLabel={copy.deleteItem}
            onDelete={() => onChange({ responsive: blueprint.responsive.filter((_, itemIndex) => itemIndex !== index) })}
          >
            <div className="spec-two-columns">
              <Field label={copy.viewport}>
                <select value={item.viewport} onChange={(event) => update(index, { viewport: event.target.value as ResponsiveViewport })}>
                  {blueprint.viewports.map((viewport) => <option key={viewport.id} value={viewport.id}>{viewportLabelLocal(language, viewport.id)}</option>)}
                </select>
              </Field>
              <Field label={copy.rule}>
                <select value={item.rule} onChange={(event) => update(index, { rule: event.target.value as ResponsiveRule })}>
                  {RESPONSIVE_RULES.map((rule) => <option key={rule} value={rule}>{responsiveRuleLabel(language, rule)}</option>)}
                </select>
              </Field>
            </div>
            <Field label={copy.targetComponent}>
              <select value={item.target_node_id} onChange={(event) => update(index, { target_node_id: event.target.value })}>
                {blueprint.nodes.map((node) => <option key={node.id} value={node.id}>{node.name} · {componentLabel(language, node.type)}</option>)}
              </select>
            </Field>
            <JsonEditor
              label={copy.specificChanges}
              invalidLabel={copy.invalidJson}
              value={item.changes}
              onChange={(changes) => update(index, { changes })}
            />
          </SpecCard>
        ))}
      </CollectionEditor>
    </div>
  );
}

function AcceptanceEditor({
  blueprint,
  language,
  onChange,
}: Pick<Props, 'blueprint' | 'language' | 'onChange'>) {
  const copy = COPY[language];
  const update = (index: number, patch: Partial<Acceptance>) => onChange({
    acceptance: blueprint.acceptance.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )),
  });
  const add = () => onChange({
    acceptance: [...blueprint.acceptance, {
      id: uniqueId('acc', blueprint.acceptance.map((item) => item.id)),
      type: 'layout',
      statement: copy.defaultAcceptance,
      target: blueprint.nodes[0]?.id ?? 'root',
      priority: 'must',
      verification_method: 'screenshot_diff',
    }],
  });

  return (
    <CollectionEditor
      title={copy.acceptanceTitle}
      empty={copy.noAcceptance}
      addLabel={copy.addAcceptance}
      count={blueprint.acceptance.length}
      meta={copy.acceptanceMinimum}
      onAdd={add}
    >
      {blueprint.acceptance.map((item, index) => (
        <SpecCard
          key={item.id}
          title={`${index + 1}. ${acceptanceTypeLabel(language, item.type)}`}
          deleteLabel={copy.deleteItem}
          onDelete={blueprint.acceptance.length > 5
            ? () => onChange({ acceptance: blueprint.acceptance.filter((_, itemIndex) => itemIndex !== index) })
            : undefined}
        >
          <div className="spec-two-columns">
            <Field label={copy.acceptanceType}>
              <select value={item.type} onChange={(event) => update(index, { type: event.target.value as AcceptanceType })}>
                {ACCEPTANCE_TYPES.map((type) => <option key={type} value={type}>{acceptanceTypeLabel(language, type)}</option>)}
              </select>
            </Field>
            <Field label={copy.priority}>
              <select value={item.priority} onChange={(event) => update(index, { priority: event.target.value as AcceptancePriority })}>
                {ACCEPTANCE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabel(language, priority)}</option>)}
              </select>
            </Field>
          </div>
          <Field label={copy.statement} hint={copy.statementHint}>
            <textarea value={item.statement} maxLength={280} onChange={(event) => update(index, { statement: event.target.value })} />
          </Field>
          <Field label={copy.target}>
            <input value={item.target} onChange={(event) => update(index, { target: event.target.value })} />
          </Field>
          <Field label={copy.verificationMethod}>
            <select value={item.verification_method} onChange={(event) => update(index, { verification_method: event.target.value as VerificationMethod })}>
              {VERIFICATION_METHODS.map((method) => <option key={method} value={method}>{verificationMethodLabel(language, method)}</option>)}
            </select>
          </Field>
        </SpecCard>
      ))}
    </CollectionEditor>
  );
}

function ViewportQualitySummary({
  blueprint,
  language,
  report,
}: {
  blueprint: Blueprint;
  language: Language;
  report: ViewportQualityReport | null;
}) {
  const copy = COPY[language];
  if (!report) {
    return <div className="viewport-quality-summary pending"><strong>{copy.qualityChecking}</strong><span>{copy.qualityCheckingDescription}</span></div>;
  }
  if (report.issues.length === 0) {
    return <div className="viewport-quality-summary pass"><strong>{copy.qualityPassed}</strong><span>{copy.qualityPassedDescription}</span></div>;
  }
  const byId = new Map(blueprint.nodes.map((node) => [node.id, node]));
  return (
    <div className="viewport-quality-summary fail">
      <strong>{copy.qualityFailed.replace('{count}', String(report.issues.length))}</strong>
      <ul>
        {report.issues.slice(0, 8).map((issue, index) => (
          <li key={`${issue.viewportId}-${issue.type}-${issue.nodeIds.join('-')}-${index}`}>
            <span>{viewportLabelLocal(language, issue.viewportId)}</span>
            {qualityIssueLabel(language, issue)}
            {' · '}
            {issue.nodeIds.map((id) => byId.get(id)?.name ?? id).join(' / ')}
          </li>
        ))}
      </ul>
      {report.issues.length > 8 && <small>{copy.qualityMore.replace('{count}', String(report.issues.length - 8))}</small>}
    </div>
  );
}

function HandoffPanel({
  blueprint,
  language,
  errorCount,
  viewportQuality,
  onExportJson,
  onExportMarkdown,
  onExportAgentPrompt,
  onExportPackage,
}: Pick<Props, 'blueprint' | 'language' | 'errorCount' | 'viewportQuality' | 'onExportJson' | 'onExportMarkdown' | 'onExportAgentPrompt' | 'onExportPackage'>) {
  const copy = COPY[language];
  const readiness = workflowReadiness(blueprint, viewportQuality);
  const checks = [
    [copy.checkGoal, readiness.brief],
    [copy.checkLayout, readiness.layout],
    [copy.checkInteractions, readiness.interactions],
    [copy.checkResponsive, readiness.responsive],
    [copy.checkAcceptance, readiness.acceptance],
    [copy.checkSchema, errorCount === 0],
    [copy.checkViewportQuality, viewportQuality !== null && viewportQuality.issues.length === 0],
  ] as const;
  const ready = checks.every(([, complete]) => complete);

  return (
    <div className="handoff-panel">
      <div className={`handoff-summary${ready ? ' ready' : ''}`}>
        <strong>{ready ? copy.readyTitle : copy.notReadyTitle}</strong>
        <span>{ready ? copy.readyDescription : copy.notReadyDescription}</span>
      </div>
      <div className="handoff-checklist">
        {checks.map(([label, complete]) => (
          <div key={label} className={complete ? 'complete' : ''}>
            <span>{complete ? '✓' : '!'}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      <ViewportQualitySummary
        blueprint={blueprint}
        language={language}
        report={viewportQuality}
      />
      <div className="handoff-stats">
        <div><strong>{blueprint.nodes.length}</strong><span>{copy.nodes}</span></div>
        <div><strong>{blueprint.interactions.length}</strong><span>{copy.interactions}</span></div>
        <div><strong>{blueprint.responsive.length}</strong><span>{copy.rules}</span></div>
        <div><strong>{blueprint.acceptance.length}</strong><span>{copy.acceptance}</span></div>
      </div>
      <div className="handoff-actions">
        <button type="button" onClick={onExportJson}>{copy.exportJson}</button>
        <button type="button" onClick={onExportMarkdown}>{copy.exportMarkdown}</button>
        <button type="button" onClick={onExportAgentPrompt}>{copy.exportAgentPrompt}</button>
        <button type="button" className="primary" disabled={!ready} onClick={onExportPackage}>{copy.exportPackage}</button>
      </div>
    </div>
  );
}

function qualityIssueLabel(language: Language, issue: ViewportQualityIssue) {
  const labels: Record<ViewportQualityIssue['type'], [string, string]> = {
    'viewport-overflow': ['超出畫板', 'outside artboard'],
    'horizontal-overflow': ['內容水平溢出', 'horizontal content overflow'],
    undersized: ['元件寬度不足', 'component is too narrow'],
    overlap: ['元件重疊', 'component overlap'],
  };
  return language === 'zh-Hant' ? labels[issue.type][0] : labels[issue.type][1];
}

function CollectionEditor({
  title,
  empty,
  addLabel,
  count,
  meta,
  onAdd,
  children,
}: {
  title: string;
  empty: string;
  addLabel: string;
  count: number;
  meta?: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="collection-editor">
      <div className="collection-toolbar">
        <div><strong>{title}</strong><span>{meta ?? `${count}`}</span></div>
        <button type="button" onClick={onAdd}><Plus />{addLabel}</button>
      </div>
      {count === 0 ? <p className="spec-empty">{empty}</p> : children}
    </div>
  );
}

function SpecCard({
  title,
  deleteLabel,
  onDelete,
  children,
}: {
  title: string;
  deleteLabel: string;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="spec-card">
      <header>
        <strong>{title}</strong>
        {onDelete && (
          <Tooltip label={deleteLabel} align="end">
            <button type="button" aria-label={deleteLabel} onClick={onDelete}>
              <Trash2 />
            </button>
          </Tooltip>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return <label className="spec-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function JsonEditor({
  label,
  invalidLabel,
  value,
  onChange,
}: {
  label: string;
  invalidLabel: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const serialized = JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!invalid) setText(serialized);
  }, [invalid, serialized]);

  return (
    <Field label={label}>
      <textarea
        className={`spec-json${invalid ? ' invalid' : ''}`}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          try {
            onChange(JSON.parse(event.target.value) as Record<string, unknown>);
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && <small className="spec-error">{invalidLabel}</small>}
    </Field>
  );
}

function uniqueId(prefix: string, existing: string[]): string {
  const base = `${prefix}_${Date.now().toString(36)}`;
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+/, '');
}

const SCREEN_TYPES: ScreenType[] = ['dashboard', 'form', 'landing', 'settings', 'admin_table', 'detail', 'auth', 'error', 'empty', 'workspace', 'communication', 'content', 'commerce', 'calendar', 'files', 'onboarding'];
const PLATFORMS: Platform[] = ['web', 'mobile-web', 'ios', 'android', 'desktop'];
const INTERACTION_TRIGGERS: InteractionTrigger[] = ['click', 'double_click', 'hover', 'focus', 'blur', 'change', 'submit', 'key_enter', 'key_escape', 'swipe_left', 'swipe_right', 'load', 'scroll'];
const RESPONSIVE_RULES: ResponsiveRule[] = ['keep', 'hide', 'drawer', 'bottom_nav', 'stack', 'scroll', 'card_list', 'col_reduce', 'collapse', 'expand', 'icon_only', 'label_only'];
const ACCEPTANCE_TYPES: AcceptanceType[] = ['layout', 'interaction', 'responsive', 'a11y', 'content', 'performance'];
const ACCEPTANCE_PRIORITIES: AcceptancePriority[] = ['blocker', 'must', 'should', 'nice'];
const VERIFICATION_METHODS: VerificationMethod[] = ['manual_visual', 'manual_ia_review', 'dom_query', 'computed_style', 'axe_audit', 'screenshot_diff', 'interaction_replay', 'code_diff'];

function screenTypeLabel(language: Language, type: ScreenType) {
  const zh: Record<ScreenType, string> = {
    dashboard: '儀表板', form: '表單', landing: 'Landing 頁', settings: '設定',
    admin_table: '管理資料表', detail: '詳細頁', auth: '登入／驗證', error: '錯誤頁',
    empty: '空狀態', workspace: '工作區', communication: '通訊', content: '內容',
    commerce: '商務', calendar: '行事曆', files: '檔案', onboarding: '導覽流程',
  };
  return language === 'zh-Hant' ? zh[type] : type.replaceAll('_', ' ');
}

function platformLabel(language: Language, platform: Platform) {
  const zh: Record<Platform, string> = {
    web: '網頁', 'mobile-web': '行動網頁', ios: 'iOS', android: 'Android', desktop: '桌面應用',
  };
  return language === 'zh-Hant' ? zh[platform] : platform;
}

function triggerLabel(language: Language, trigger: InteractionTrigger) {
  const zh: Record<InteractionTrigger, string> = {
    click: '點擊', double_click: '雙擊', hover: '游標停留', focus: '聚焦', blur: '失焦',
    change: '值變更', submit: '送出', key_enter: '按 Enter', key_escape: '按 Escape',
    swipe_left: '向左滑', swipe_right: '向右滑', load: '載入', scroll: '捲動',
  };
  return language === 'zh-Hant' ? zh[trigger] : trigger.replaceAll('_', ' ');
}

function responsiveRuleLabel(language: Language, rule: ResponsiveRule) {
  const zh: Record<ResponsiveRule, string> = {
    keep: '維持', hide: '隱藏', drawer: '改為抽屜', bottom_nav: '改為底部導覽',
    stack: '改為堆疊', scroll: '允許捲動', card_list: '改為卡片清單', col_reduce: '減少欄數',
    collapse: '收合', expand: '展開', icon_only: '只顯示圖示', label_only: '只顯示文字',
  };
  return language === 'zh-Hant' ? zh[rule] : rule.replaceAll('_', ' ');
}

function viewportLabelLocal(language: Language, viewport: ResponsiveViewport) {
  const zh: Record<ResponsiveViewport, string> = { desktop: '桌面', tablet: '平板', mobile: '手機', wide: '寬螢幕' };
  return language === 'zh-Hant' ? zh[viewport] : viewport;
}

function acceptanceTypeLabel(language: Language, type: AcceptanceType) {
  const zh: Record<AcceptanceType, string> = {
    layout: '佈局', interaction: '互動', responsive: '響應式', a11y: '無障礙',
    content: '內容', performance: '效能',
  };
  return language === 'zh-Hant' ? zh[type] : type;
}

function priorityLabel(language: Language, priority: AcceptancePriority) {
  const zh: Record<AcceptancePriority, string> = {
    blocker: '阻擋交付', must: '必須', should: '應該', nice: '加分',
  };
  return language === 'zh-Hant' ? zh[priority] : priority;
}

function verificationMethodLabel(language: Language, method: VerificationMethod) {
  const zh: Record<VerificationMethod, string> = {
    manual_visual: '人工視覺檢查', manual_ia_review: '人工資訊架構檢查',
    dom_query: 'DOM 查詢', computed_style: '計算樣式', axe_audit: 'Axe 無障礙檢查',
    screenshot_diff: '截圖差異', interaction_replay: '互動重播', code_diff: '程式碼差異',
  };
  return language === 'zh-Hant' ? zh[method] : method.replaceAll('_', ' ');
}

const COPY = {
  en: {
    workflow: 'Blueprint specification',
    stageTitles: { brief: 'Screen goal', interactions: 'Interactions', responsive: 'Responsive rules', acceptance: 'Acceptance criteria', handoff: 'AI handoff' },
    stageDescriptions: {
      brief: 'Define what the user must accomplish before arranging details.',
      interactions: 'Describe observable behavior instead of leaving the agent to infer it.',
      responsive: 'State how important regions change between viewports.',
      acceptance: 'Write binary checks the implementation can pass or fail.',
      handoff: 'Review completeness and export agent-ready artifacts.',
    },
    screenName: 'Screen name', screenId: 'Screen ID', screenType: 'Screen type', platform: 'Platform',
    primaryGoal: 'Primary user goal', primaryGoalHint: 'One concrete outcome, written from the user perspective.',
    agentNotes: 'Implementation notes', agentNotesHint: 'Context for the agent. Keep layout rules in the layout and acceptance sections.',
    interactionsTitle: 'Declared interactions', noInteractions: 'No interaction has been declared. Add one for every meaningful action.',
    addInteraction: 'Add interaction', trigger: 'Trigger', sourceComponent: 'Source component',
    actionIntent: 'Action intent', target: 'Target', resultState: 'Observable result',
    resultStateHint: 'Describe what becomes visibly true after the action.', defaultResult: 'The intended result is visible.',
    responsiveTitle: 'Responsive transformations', noResponsive: 'No responsive behavior has been declared.',
    addResponsive: 'Add rule', viewport: 'Viewport', rule: 'Transformation', targetComponent: 'Target component',
    specificChanges: 'Specific overrides (JSON)',
    invalidJson: 'Enter a valid JSON object before continuing.',
    deleteItem: 'Delete item',
    acceptanceTitle: 'Acceptance checklist', noAcceptance: 'No acceptance item exists.',
    addAcceptance: 'Add criterion', acceptanceMinimum: 'At least 5, including layout, interaction, responsive, and accessibility.',
    acceptanceType: 'Category', priority: 'Priority', statement: 'Pass/fail statement',
    statementHint: 'Avoid subjective wording such as “looks good”.', verificationMethod: 'Verification method',
    defaultAcceptance: 'The implementation matches the declared UI intent.',
    readyTitle: 'Ready for AI handoff', readyDescription: 'The Blueprint contains the minimum context required for implementation.',
    notReadyTitle: 'Handoff is incomplete', notReadyDescription: 'Finish the missing specification sections before exporting the package.',
    checkGoal: 'Screen goal is specific', checkLayout: 'UI structure contains components',
    checkInteractions: 'Interactions are declared', checkResponsive: 'Responsive behavior is declared',
    checkAcceptance: 'Acceptance coverage is complete', checkSchema: 'Schema and semantics are valid',
    checkViewportQuality: 'Rendered viewports pass layout checks',
    qualityChecking: 'Checking rendered viewports',
    qualityCheckingDescription: 'Desktop, tablet, and mobile are being checked for overflow and overlap.',
    qualityPassed: 'Rendered viewport check passed',
    qualityPassedDescription: 'No blocking overflow or overlap was detected.',
    qualityFailed: '{count} rendered layout issue(s) block handoff',
    qualityMore: '{count} more issue(s) not shown.',
    nodes: 'nodes', interactions: 'interactions', rules: 'responsive rules', acceptance: 'criteria',
    exportJson: 'Export JSON', exportMarkdown: 'Export Markdown', exportPackage: 'Export complete package',
    exportAgentPrompt: 'Export Codex task',
  },
  'zh-Hant': {
    workflow: '藍圖規格',
    stageTitles: { brief: '畫面目標', interactions: '互動行為', responsive: '響應式規則', acceptance: '驗收條件', handoff: 'AI 交付' },
    stageDescriptions: {
      brief: '先定義使用者要完成什麼，再處理畫面細節。',
      interactions: '描述可觀察的行為，不讓 Agent 自行猜測。',
      responsive: '定義重要區域在不同裝置上的變化方式。',
      acceptance: '撰寫實作結果可以明確通過或失敗的條件。',
      handoff: '檢查完整度並匯出可直接交給 Agent 的產物。',
    },
    screenName: '畫面名稱', screenId: '畫面識別碼', screenType: '畫面類型', platform: '目標平台',
    primaryGoal: '主要使用者目標', primaryGoalHint: '用使用者角度寫一個具體、可完成的結果。',
    agentNotes: '實作補充說明', agentNotesHint: '提供背景脈絡；佈局規則請寫在佈局與驗收條件。',
    interactionsTitle: '已宣告互動', noInteractions: '尚未定義互動。每個重要操作都應有一筆可觀察結果。',
    addInteraction: '新增互動', trigger: '觸發方式', sourceComponent: '來源元件',
    actionIntent: '動作意圖', target: '目標', resultState: '可觀察結果',
    resultStateHint: '描述動作完成後，畫面上什麼事情會變成真的。', defaultResult: '預期的結果已顯示。',
    responsiveTitle: '響應式轉換', noResponsive: '尚未定義不同裝置的行為。',
    addResponsive: '新增規則', viewport: '裝置', rule: '轉換方式', targetComponent: '目標元件',
    specificChanges: '特定覆寫（JSON）',
    invalidJson: '請輸入有效的 JSON 物件後再繼續。',
    deleteItem: '刪除此項',
    acceptanceTitle: '驗收清單', noAcceptance: '尚未建立驗收條件。',
    addAcceptance: '新增條件', acceptanceMinimum: '至少 5 項，且必須涵蓋佈局、互動、響應式與無障礙。',
    acceptanceType: '類別', priority: '優先級', statement: '通過／失敗敘述',
    statementHint: '避免使用「看起來不錯」等主觀文字。', verificationMethod: '驗證方式',
    defaultAcceptance: '實作結果符合已宣告的 UI 意圖。',
    readyTitle: '可以交付給 AI Agent', readyDescription: '這份藍圖已包含實作所需的最低完整脈絡。',
    notReadyTitle: '交付規格尚未完整', notReadyDescription: '請先完成缺少的規格階段，再匯出完整交付包。',
    checkGoal: '畫面目標具體', checkLayout: '畫面已有元件結構',
    checkInteractions: '已定義互動行為', checkResponsive: '已定義響應式規則',
    checkAcceptance: '驗收條件涵蓋完整', checkSchema: 'Schema 與語意驗證通過',
    checkViewportQuality: '實際裝置畫面通過版面檢查',
    qualityChecking: '正在檢查實際裝置畫面',
    qualityCheckingDescription: '正在檢查桌面、平板與手機是否有溢出或重疊。',
    qualityPassed: '實際裝置畫面檢查通過',
    qualityPassedDescription: '沒有偵測到會阻擋交付的溢出或重疊。',
    qualityFailed: '偵測到 {count} 個版面問題，已阻擋交付',
    qualityMore: '另有 {count} 個問題未顯示。',
    nodes: '個節點', interactions: '個互動', rules: '個響應式規則', acceptance: '個驗收條件',
    exportJson: '匯出 JSON', exportMarkdown: '匯出 Markdown', exportPackage: '匯出完整交付包',
    exportAgentPrompt: '匯出 Codex 任務',
  },
} as const;
