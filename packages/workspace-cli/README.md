# aub-workspace

Languages: **English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

Run AUB workspace-connected mode from an existing project without cloning AUB.

```bash
cd /path/to/your-existing-app
npx aub-workspace init
npx aub-workspace
```

`init` creates AUB config, `.aubignore`, `AGENTS.md`, GitHub issue templates, Copilot instructions, and a PR workflow. `aub-workspace` starts a local AUB MCP HTTP server, serves the bundled AUB editor, connects the editor to the MCP endpoint, and opens the browser.

Success looks like this:

```text
AUB Workspace is running
Workspace: /path/to/your-existing-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

In the editor, follow the workspace loop:

1. Scan existing app.
2. Generate a candidate template from a route.
3. Review component candidates.
4. Save the Blueprint/session.
5. Copy the agent instruction for Copilot, Codex, or another coding agent.

AUB may create these files in the existing project:

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
.aub/ci.json
.aubignore
AGENTS.md
.github/workflows/aub-contracts.yml
aub.registry.json
screens/*.ui.json
```

Options:

```bash
npx aub-workspace init
npx aub-workspace init --force
npx aub-workspace init --no-github
npx aub-workspace init --ci-only
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 or newer
- A local project directory to use as the AUB workspace
