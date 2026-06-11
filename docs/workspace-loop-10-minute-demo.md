# 10-minute Workspace Loop Demo

This demo proves the AUB workflow against synthetic existing-app fixtures. It does
not use private project code.

The fastest proof path is the bundled synthetic workspace:

```bash
npx aub-workspace demo
```

It creates a demo app, `.aub/scan-report.json`, a candidate template, a generated
Blueprint, a failing low-evidence report, and a passing evidence-shaped report.
Use it before trying AUB against a private or large codebase.

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

After `scan_project_ui`, AUB writes `.aub/scan-report.json`. That file records
the scanner trust score, routes found, component candidates, Storybook metadata,
ignored files, and warnings such as scan limits.

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
the PR review is subjective. Reviewers still need to inspect whether the agent
reused real components, preserved responsive behavior, avoided horizontal
overflow, and kept existing interactions intact.

With AUB, the issue points at a Blueprint, approved component mappings, preview
URL, acceptance criteria, implementation evidence, and a PR Safety Score. The PR
is reviewed against verifiable risk instead of visual opinion.

Use the longer product proof in [No AUB vs AUB](./demo-no-aub-vs-aub.md) when
explaining why this is different from an app builder.
