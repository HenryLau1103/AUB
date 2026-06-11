import { ExposureTable } from "../../components/ExposureTable";
import { RiskSummaryCard } from "../../components/RiskSummaryCard";
import { StatusBadge } from "../../components/StatusBadge";

const rows = [
  { name: "North Region", owner: "Mira", exposure: "Medium" },
  { name: "East Region", owner: "Jon", exposure: "Low" },
];

export default function RiskDashboardPage() {
  return (
    <main className="risk-page">
      <header className="risk-header">
        <div>
          <p className="eyebrow">Operations view</p>
          <h1>Risk dashboard</h1>
          <p>Review synthetic exposure levels and operational follow-up.</p>
        </div>
        <StatusBadge status="Healthy" tone="success" />
      </header>
      <section className="risk-grid">
        <RiskSummaryCard title="Open reviews" value="18" trend="Down 12%" />
        <RiskSummaryCard title="Blocked items" value="3" trend="Stable" />
      </section>
      <form className="risk-filter">
        <label htmlFor="region">Region</label>
        <input id="region" name="region" placeholder="Search region" />
        <button type="button">Apply filter</button>
      </form>
      <ExposureTable title="Regional exposure" rows={rows} />
    </main>
  );
}
