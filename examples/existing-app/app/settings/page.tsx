import { BillingCard } from '../../components/BillingCard';
import { PlanStatusBadge } from '../../components/PlanStatusBadge';
import { UserTable } from '../../components/UserTable';

const users = [
  { name: 'Ada Chen', role: 'Owner', status: 'Active' },
  { name: 'Leo Wang', role: 'Billing admin', status: 'Invited' },
  { name: 'Mina Park', role: 'Viewer', status: 'Active' },
];

export default function SettingsPage() {
  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Workspace settings</p>
          <h1>Billing and access</h1>
          <p>Manage subscription status, payment ownership, and workspace user access.</p>
        </div>
        <PlanStatusBadge status="Active plan" tone="success" />
      </header>

      <section className="settings-grid">
        <BillingCard
          plan="Team"
          price="$49 / month"
          renewal="Renews on July 1"
          ctaLabel="Manage billing"
        />
        <BillingCard
          plan="Usage"
          price="82% used"
          renewal="18 seats available"
          ctaLabel="Review usage"
        />
      </section>

      <UserTable title="Workspace users" users={users} />
    </main>
  );
}
