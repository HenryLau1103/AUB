interface BillingCardProps {
  plan: string;
  price: string;
  renewal: string;
  ctaLabel: string;
}

export function BillingCard({ plan, price, renewal, ctaLabel }: BillingCardProps) {
  return (
    <article className="billing-card">
      <div>
        <p className="eyebrow">{plan}</p>
        <h2>{price}</h2>
        <p>{renewal}</p>
      </div>
      <button type="button">{ctaLabel}</button>
    </article>
  );
}
