# No AUB vs AUB: Existing UI Agent Safety Demo

This demo explains the product value AUB should prove first: making AI coding-agent UI changes safer in an existing codebase.

## Scenario

A team has an existing dashboard route with production cards, filters, a data table, responsive behavior, and established interaction logic. A user asks an agent to add a new summary area and adjust the table controls.

## Without AUB

The issue usually says something like:

> Improve the dashboard layout and add the new summary controls.

The agent can still produce code, but the pull request is hard to trust:

- The agent may create lookalike components instead of reusing production components.
- Reviewers cannot tell whether responsive behavior was verified.
- Existing route interactions may be changed accidentally.
- Screenshot evidence, if present, is disconnected from acceptance criteria.
- The PR review becomes subjective: "does this look right?"

Expected review outcome:

- High review time.
- Unclear component reuse.
- No machine-checkable evidence.
- Higher risk of subtle UI drift.

## With AUB

The workflow starts in the existing app root:

```bash
npx aub-workspace init
npx aub-workspace
```

Then AUB is used to:

1. Scan the real route.
2. Generate a candidate workspace template.
3. Keep custom components in `.aub/component-candidates.json`.
4. Let the user approve mappings before they enter `aub.registry.json`.
5. Save the edited Blueprint and `.aub/session.json`.
6. Hand the active Blueprint, route, preview URL, and component rules to the coding agent.
7. Capture implementation evidence and compute the PR Safety Score.

Expected review outcome:

- Every Blueprint node maps to a source file.
- Custom component reuse is explicit.
- Desktop, tablet, and mobile evidence can be attached.
- Horizontal overflow is checked.
- Acceptance ids are linked to evidence.
- PR Safety Score summarizes risk before merge.

## What The PR Should Show

An AUB-backed PR should include:

- The changed source files.
- The active `.ui.json` or workspace template.
- An implementation report under `.aub/reports/`.
- Evidence items such as screenshots, DOM queries, overflow checks, component reuse proof, interactions, or code-diff references.
- A PR Safety Score with clear weak spots when evidence is incomplete.

## Metrics To Track

- Scanned routes count.
- Mapped component count.
- Unresolved candidate count.
- Acceptance evidence coverage.
- Horizontal overflow pass/fail.
- Lookalike component prevention count.
- PR Safety Score.

## Success Bar

AUB wins this scenario only if it reduces review ambiguity. It does not need to replace app builders or design tools. It needs to make one thing obvious:

> When an agent changes existing product UI, the PR is safer because the contract, component reuse, and evidence are reviewable.
