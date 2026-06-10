import {
  Boxes,
  CheckSquare,
  FileCheck2,
  Goal,
  MousePointerClick,
  Smartphone,
} from 'lucide-react';
import type { Blueprint } from '../types';
import type { Language } from '../lib/i18n';
import type { ViewportQualityReport } from '../lib/viewport-quality';

export type WorkflowStage =
  | 'brief'
  | 'layout'
  | 'interactions'
  | 'responsive'
  | 'acceptance'
  | 'handoff';

interface Props {
  blueprint: Blueprint | null;
  language: Language;
  stage: WorkflowStage;
  savedAt: string | null;
  errorCount: number;
  viewportQuality: ViewportQualityReport | null;
  onChange: (stage: WorkflowStage) => void;
}

const STAGES: Array<{
  id: WorkflowStage;
  icon: React.ReactNode;
  en: string;
  zh: string;
}> = [
  { id: 'brief', icon: <Goal />, en: 'Goal', zh: '畫面目標' },
  { id: 'layout', icon: <Boxes />, en: 'Layout', zh: '畫面佈局' },
  { id: 'interactions', icon: <MousePointerClick />, en: 'Interactions', zh: '互動行為' },
  { id: 'responsive', icon: <Smartphone />, en: 'Responsive', zh: '響應式' },
  { id: 'acceptance', icon: <CheckSquare />, en: 'Acceptance', zh: '驗收條件' },
  { id: 'handoff', icon: <FileCheck2 />, en: 'Handoff', zh: 'AI 交付' },
];

export function WorkflowBar({
  blueprint,
  language,
  stage,
  savedAt,
  errorCount,
  viewportQuality,
  onChange,
}: Props) {
  const readiness = blueprint ? workflowReadiness(blueprint, viewportQuality) : null;
  const savedLabel = savedAt
    ? language === 'zh-Hant'
      ? `已自動儲存 ${new Date(savedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
      : `Autosaved ${new Date(savedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`
    : language === 'zh-Hant'
      ? '尚未建立草稿'
      : 'No draft yet';

  return (
    <nav className="workflow-bar" aria-label={language === 'zh-Hant' ? 'UI 藍圖工作流程' : 'UI Blueprint workflow'}>
      <div className="workflow-steps">
        {STAGES.map((item, index) => {
          const complete = readiness?.[item.id] ?? false;
          return (
            <button
              key={item.id}
              type="button"
              className={`${stage === item.id ? 'active' : ''}${complete ? ' complete' : ''}`}
              disabled={!blueprint && item.id !== 'layout'}
              onClick={() => onChange(item.id)}
            >
              <span className="workflow-index">{complete ? '✓' : index + 1}</span>
              {item.icon}
              <span>{language === 'zh-Hant' ? item.zh : item.en}</span>
            </button>
          );
        })}
      </div>
      <div className={`autosave-status${errorCount ? ' has-errors' : ''}`}>
        <span className="autosave-dot" />
        <span>{errorCount ? (language === 'zh-Hant' ? `${errorCount} 個問題待修正` : `${errorCount} issues`) : savedLabel}</span>
      </div>
    </nav>
  );
}

export function workflowReadiness(
  blueprint: Blueprint,
  viewportQuality: ViewportQualityReport | null | undefined = undefined
): Record<WorkflowStage, boolean> {
  const acceptanceTypes = new Set<string>(blueprint.acceptance.map((item) => item.type));
  const brief = Boolean(
    blueprint.screen.name.trim()
    && blueprint.screen.primary_user_goal.trim()
    && !blueprint.screen.primary_user_goal.toLowerCase().startsWith('describe ')
    && !blueprint.screen.primary_user_goal.startsWith('描述')
  );
  const layout = blueprint.nodes.length > 1;
  const interactions = blueprint.interactions.length > 0;
  const viewportQualityPasses = viewportQuality === undefined
    ? true
    : viewportQuality !== null && viewportQuality.issues.length === 0;
  const responsive = blueprint.responsive.length > 0 && viewportQualityPasses;
  const acceptance = blueprint.acceptance.length >= 5
    && ['layout', 'interaction', 'responsive', 'a11y'].every((type) => acceptanceTypes.has(type));

  return {
    brief,
    layout,
    interactions,
    responsive,
    acceptance,
    handoff: brief && layout && interactions && responsive && acceptance,
  };
}
