# GitHub CI acceptance gate

AUB can make a pull request fail when its UI contract or implementation evidence is incomplete.
The same verifier runs locally and in the bundled GitHub Action.

## Configure the contract set

Create `.aub/ci.json` in the repository that implements the UI:

```json
{
  "$schema": "https://henrylau1103.github.io/AUB/schema/aub-ci.schema.json",
  "version": "1.0.0",
  "blueprints": ["design/dashboard.ui.json"],
  "projects": ["design/app.aub.project.json"],
  "reports": [
    {
      "blueprint": "design/dashboard.ui.json",
      "report": ".aub/reports/dashboard.implementation-report.json"
    }
  ]
}
```

Each configured report must pass the implementation-report schema, map every Blueprint node to
a source file, mark every acceptance id as `pass`, attach evidence, and contain no unresolved
items.

## Run locally

```bash
pnpm ci:verify -- --workspace /path/to/target/repo --require-reports
```

Omit `--require-reports` while authoring the Blueprint before implementation begins. If the
configuration file is absent, the verifier discovers `*.ui.json`, `*.ui.yaml`, and
`*.aub.project.json` files automatically and validates their contracts.

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
```

The Action writes a check table to the GitHub job summary and emits file-level error
annotations for invalid schemas, semantic errors, missing reports, failed acceptance items,
or unresolved implementation work.
