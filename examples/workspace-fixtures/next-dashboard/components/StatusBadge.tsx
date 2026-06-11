interface StatusBadgeProps {
  status: string;
  tone: "success" | "warning" | "neutral";
}

export function StatusBadge({ status, tone }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}>{status}</span>;
}
