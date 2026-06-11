interface RiskSummaryCardProps {
  title: string;
  value: string;
  trend: string;
}

export function RiskSummaryCard({ title, value, trend }: RiskSummaryCardProps) {
  return (
    <article className="risk-summary-card">
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{trend}</span>
    </article>
  );
}
