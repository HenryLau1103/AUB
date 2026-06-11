interface PlanStatusBadgeProps {
  status: string;
  tone: 'success' | 'warning' | 'neutral';
}

export function PlanStatusBadge({ status, tone }: PlanStatusBadgeProps) {
  return <span className={`plan-status plan-status-${tone}`}>{status}</span>;
}
