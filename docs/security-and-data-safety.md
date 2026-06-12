# Security and Data Safety

AUB workspace mode is designed for existing private codebases. The default path
is local-first: the editor talks to the local `aub-workspace` launcher and MCP
HTTP server on `127.0.0.1`.

## What Stays Local

- Source scanning runs against the workspace path on the user's machine.
- `.aub/session.json`, `.aub/scan-report.json`, workspace templates,
  component candidates, and implementation reports are written inside the target
  repository.
- The browser demo on GitHub Pages does not connect to a local workspace unless
  the user explicitly opens workspace settings and supplies a local MCP endpoint.

## What AUB Writes During `npx aub-workspace init`

By default `init` writes configuration and review workflow files only:

- `.aub/ci.json`
- `.aubignore`
- `.aub/README.md`
- `AGENTS.md`
- `.github/workflows/aub-contracts.yml`
- `.github/ISSUE_TEMPLATE/aub-ui-change.yml`
- `.github/ISSUE_TEMPLATE/aub-scan-route.yml`
- `.github/copilot-instructions.md`

It does not modify application source files. Existing files are not overwritten
unless `--force` is used.

## Scanner Safety Rules

- `.aubignore` is respected before scanner output is generated.
- Default ignores include secrets, environment files, logs, databases,
  dependency folders, build output, and coverage output.
- Custom components discovered by scanning are written to
  `.aub/component-candidates.json` first.
- A candidate does not become an approved `aub.registry.json` mapping until the
  user explicitly approves it in the editor or through the MCP review tool.

## Path Confinement

Workspace reads and writes must resolve inside the configured workspace root.
Paths that escape the workspace are rejected before file access.

## Fixture and Demo Data

Committed workspace fixtures use synthetic names such as `risk-dashboard-demo`,
`enterprise-portal`, and `billing-console`. Real local test project paths,
routes, domain terms, field names, or customer data must not be committed.

The repository includes denylist tests for known local/private paths and project
identifiers. Add new entries when a private validation project is used locally.

## Recommended Team Policy

1. Start with `npx aub-workspace demo` before scanning a private app.
2. Add private folders and generated output to `.aubignore`.
3. Keep `require-evidence: "false"` only during initial rollout.
4. Enable `require-evidence: "true"` and `min-safety-score` once the team can
   capture screenshots, DOM checks, overflow checks, and component reuse proof.
5. Do not merge agent UI PRs from narrative reports alone.
