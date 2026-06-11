# 10-minute Workspace Loop Demo

This demo proves the AUB workflow against synthetic existing-app fixtures. It does
not use private project code.

## 1. Initialize AUB in an Existing App

From a target app root:

```bash
npx aub-workspace init
npx aub-workspace
```

`init` creates AUB config, GitHub issue templates, Copilot instructions, and a
PR workflow. `aub-workspace` starts the local MCP server and editor.

## 2. Scan and Generate a Candidate Template

Use **Scan existing app**, select a route, then **Generate candidate template**.

Expected product signals:

- scanned routes count
- mapped component count
- unresolved candidate count
- source references per Blueprint node
- missing registry mappings

Synthetic fixtures for local validation:

```bash
pnpm workspace:start -- --workspace examples/workspace-fixtures/next-dashboard
pnpm workspace:start -- --workspace examples/workspace-fixtures/angular-enterprise
```

## 3. Review Custom Components

Use **Component candidates** to approve high-confidence core mappings, create
namespaced extension types, ignore noise, or keep unresolved items as candidates.

Rules:

- scanned custom components stay in `.aub/component-candidates.json`
- only explicit `create extension` writes `aub.registry.json`
- agent implementation must reuse approved mappings

## 4. Hand Off to an Agent

After saving the Blueprint/session, copy the AUB agent instruction. The agent
should call:

```text
get_aub_session
get_blueprint
resolve_component
submit_report
```

The implementation PR should include component reuse evidence and acceptance
results.

## 5. Capture Evidence

After the app runs locally:

```bash
pnpm report:capture -- --workspace /path/to/app --blueprint screens/settings.ui.json --url http://localhost:3000/settings
pnpm report:verify screens/settings.ui.json .aub/reports/workspace.settings.implementation-report.json --require-evidence
```

Evidence should include:

- desktop/tablet/mobile screenshots
- horizontal overflow checks
- DOM query evidence where the implementation exposes AUB node selectors
- component reuse or code-diff references

## Before and After

Without AUB, a vague issue asks an agent to "make the settings page better" and
the PR review is subjective.

With AUB, the issue points at a Blueprint, approved component mappings, preview
URL, and acceptance criteria. The PR is reviewed against evidence instead of
visual opinion.
