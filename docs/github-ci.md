# GitHub CI acceptance gate

AUB can make a pull request fail when its UI contract or implementation evidence is incomplete.
The same verifier runs locally and in the bundled GitHub Action.

## Configure the contract set

Create `.aub/ci.json` in the repository that implements the UI:

```json
{
  "$schema": "https://henrylau1103.github.io/AUB/schema/aub-ci.schema.json",
  "version": "1.0.0",
  "discover": true,
  "blueprints": ["design/dashboard.ui.json"],
  "projects": ["design/app.aub.project.json"],
  "reports": [
    {
      "blueprint": "design/dashboard.ui.json",
      "report": ".aub/reports/dashboard.implementation-report.json"
    }
  ],
  "min_safety_score": 70
}
```

Each configured report must pass the implementation-report schema, map every Blueprint node to
a source file, mark every acceptance id as `pass`, attach evidence, and contain no unresolved
items.

Use `npx aub-workspace init` in an existing app to create the baseline `.aub/ci.json`,
GitHub issue templates, Copilot instructions, and pull-request workflow without editing app
source files.

## Run locally

```bash
pnpm ci:verify -- --workspace /path/to/target/repo --require-reports
pnpm ci:verify -- --workspace /path/to/target/repo --require-reports --require-evidence
pnpm ci:verify -- --workspace /path/to/target/repo --require-reports --require-evidence --min-safety-score 70
```

Omit `--require-reports` while authoring the Blueprint before implementation begins. If the
configuration file is absent, the verifier discovers `*.ui.json`, `*.ui.yaml`, and
`*.aub.project.json` files automatically and validates their contracts.

`--require-evidence` upgrades the report check from narrative pass/fail text to machine-checkable
evidence. A passing report needs evidence such as screenshot bytes, DOM query results, computed
style checks, viewport overflow checks, component reuse proof, interaction proof, or code-diff
references.

To capture local preview evidence before opening a PR:

```bash
pnpm report:capture -- --workspace /path/to/app --blueprint screens/settings.ui.json --url http://localhost:3000/settings
pnpm report:verify screens/settings.ui.json .aub/reports/workspace.settings.implementation-report.json --require-evidence
pnpm report:score screens/settings.ui.json .aub/reports/workspace.settings.implementation-report.json
```

## Add the GitHub Action

```yaml
name: AUB contract

on:
  pull_request:

jobs:
  aub:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: HenryLau1103/AUB@main
        with:
          config: .aub/ci.json
          require-reports: "true"
          require-evidence: "false"
          min-safety-score: "70"
```

Keep `require-evidence: "false"` while adopting the workflow if existing reports are still
narrative-only. Set it to `"true"` once the project can capture screenshot, DOM, overflow, and
component-reuse evidence in CI or before PR submission.

Use `min-safety-score` only after the team agrees on a rollout threshold. The score is not a
substitute for review; it exposes risk across source coverage, acceptance evidence, viewport
coverage, overflow safety, component reuse, unresolved mappings, and lookalike prevention.

The Action writes a check table to the GitHub job summary and emits file-level error
annotations for invalid schemas, semantic errors, missing reports, failed acceptance items,
low safety scores, or unresolved implementation work.
