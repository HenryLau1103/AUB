# Existing App Fixture

This fixture is a small Next-style product app used to demonstrate the AUB workspace loop against an existing route.

Use it from the repository root during development:

```bash
pnpm workspace:start -- --workspace examples/existing-app
```

Then in AUB Editor:

1. Scan existing app.
2. Select `app/settings/page.tsx`.
3. Generate a candidate template.
4. Review component candidates such as `BillingCard`, `UserTable`, and `PlanStatusBadge`.
5. Save the Blueprint/session and copy the agent instruction.

The fixture is intentionally small. It exists to prove the contract flow, not to be a production Next.js app.
