# AUB MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes UI Blueprint
tools to coding agents (Codex, Claude Code, MCP-capable IDEs) over **stdio or Streamable HTTP**. Agents call AUB
tools directly instead of manually moving `.ui.json`, prompt, and report files between repos.

The server is a thin wrapper over the repository's existing pure-function libraries in
[`scripts/`](../../scripts). It adds no UI Blueprint logic of its own.

## Tools

| Tool | Input | Result |
|---|---|---|
| `list_blueprints` | — | Every `.ui.json` / `.ui.yaml` under the workspace root with screen id, name, version. |
| `get_blueprint` | `ref`, `format?` (`json` \| `yaml` \| `markdown`) | The resolved Blueprint as JSON/YAML, or derived `.ui.md` agent context. |
| `validate_blueprint` | `ref?` or inline `blueprint?` | `{ valid, schemaErrors[], semanticErrors[] }` (JSON Schema + semantic rules). |
| `scaffold_blueprint` | `ref?` or inline `blueprint?`, `sections?` (`interactions` \| `responsive` \| `acceptance`), `language?` (`en` \| `zh-Hant`) | `{ source, summary, blueprint }`. Non-destructively derives missing interactions, responsive rules, and acceptance criteria from the node tree and viewports. |
| `import_design_bridge` | `path?` or inline `bridge?`, `registry?` | Imports an explicitly mapped Figma/Penpot Design Bridge and validates the resulting Blueprint without guessing component types. |
| `write_blueprint` | `path`, `blueprint`, `registry?`, `overwrite?` | Validates and atomically writes a Blueprint inside the workspace. Refuses overwrite and path traversal by default. |
| `export_prompt` | `ref`, `adapter?` (`generic` \| `codex` \| `claude-code` \| `copilot`), `task?` (`author` \| `plan` \| `implement` \| `review`) | An agent-ready prompt with embedded Blueprint context. |
| `export_handoff` | `ref`, `output?`, `registry?`, `overwrite?`, `viewportImages?` | Writes a complete `.aub.zip` handoff inside the workspace and returns its manifest and SHA-256. |
| `submit_report` | `ref`, `report`, `persist?` | Verifies an implementation report (schema + node mappings + acceptance evidence). Accepted reports are written to `<root>/.aub/reports/`. |
| `list_projects` | — | Every `*.aub.project.json` under the workspace root with id, name, and screen count. |
| `get_project` | `ref` (project path or id), `inlineScreens?` | The resolved project. With `inlineScreens: true`, each member screen includes its full Blueprint and merged design system. |
| `validate_project` | `ref` (project path or id) | `{ valid, schemaErrors[], semanticErrors[], screens[] }` — validates the project document, project semantics, and every member screen. |
| `resolve_component` | `type`, `registry?`, `implementation?` | Resolves core or custom component semantics and returns production module/export/prop mappings when declared. |
| `diff_blueprints` | `before`, `after` | Returns structural changes between two Blueprint revisions. |
| `migrate_blueprint` | `ref?` or inline `blueprint?` | Migrates v0.1/v0.2 to the current version without writing files. |
| `lock_blueprint` | `ref?` or inline `blueprint?` | Creates a deterministic acceptance lock snapshot without writing files. |
| `get_aub_session` | — | Reads `.aub/session.json` so agents know the active Blueprint, project, route, and preview target. |
| `update_aub_session` | `patch` | Merges editor/agent state into `.aub/session.json`. |
| `get_workspace_status` | — | Returns frameworks, routes, workspace templates, component candidates, and session state. |
| `scan_project_ui` | `namespace?`, `limit?` | Statically scans React/Next, Vue/Nuxt, and Angular sources; writes `.aub/component-candidates.json` without touching `aub.registry.json`. |
| `generate_template_from_source` | `sourcePath`, metadata | Writes `.aub/templates/<slug>.aub.template.json` with a candidate Blueprint and source references. |
| `approve_component_candidate` | `id`, `action`, metadata | Reviews a candidate. Only `create_extension` writes `aub.registry.json`; `map_core` and `ignore` stay in the candidates file. |
| `export_template_authoring_prompt` | — | Returns the contract other agents should follow when scanning apps into AUB templates. |

`ref` is either a file path (relative to the workspace root) or a Blueprint `screen.id`.

## Build

Most users should not start this package directly. From the existing app they
want AUB to inspect and edit, run:

```bash
cd /path/to/existing-app
npx aub-workspace
```

That command starts this MCP server, serves the AUB editor, and opens the editor
already connected to the workspace.

Use the manual commands below when developing AUB itself or registering the MCP
server with a specific client.

```bash
cd apps/mcp-server
pnpm install
pnpm build      # emits dist/
```

The server entry is `dist/index.js` (bin: `aub-mcp`). The workspace root is, in order of
precedence: the first CLI argument, the `AUB_WORKSPACE` environment variable, or the current
working directory.

```bash
node dist/index.js /path/to/your/repo
```

For Streamable HTTP, use the second entrypoint (bin: `aub-mcp-http`):

```bash
node dist/http.js --workspace /path/to/your/repo --host 127.0.0.1 --port 3100
curl http://127.0.0.1:3100/health
```

The MCP endpoint is `http://127.0.0.1:3100/mcp`. Localhost bindings include the
SDK's DNS rebinding protection. When exposing another host, put the endpoint
behind your normal authentication and network controls.

The same HTTP process also exposes `POST /rpc` for the AUB editor's
workspace-connected mode. `/rpc` calls the same registered tool implementations
as `/mcp`; it exists so browser UI code does not need to implement the full
Streamable HTTP MCP session protocol.

## Register with an agent

Point the agent at the built entry and pass the target repository as the workspace root.

### Claude Code

```bash
claude mcp add aub -- node /abs/path/to/AUB/apps/mcp-server/dist/index.js /abs/path/to/your/repo
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "aub": {
      "command": "node",
      "args": ["/abs/path/to/AUB/apps/mcp-server/dist/index.js", "/abs/path/to/your/repo"]
    }
  }
}
```

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.aub]
command = "node"
args = ["/abs/path/to/AUB/apps/mcp-server/dist/index.js", "/abs/path/to/your/repo"]
```

### Generic IDE / MCP client

```json
{
  "mcpServers": {
    "aub": {
      "command": "node",
      "args": ["/abs/path/to/AUB/apps/mcp-server/dist/index.js"],
      "env": { "AUB_WORKSPACE": "/abs/path/to/your/repo" }
    }
  }
}
```

## Test

```bash
pnpm test        # builds, then runs node:test against dist/
pnpm typecheck
```

Both transports register the same tool list from one server factory. Transport
integration tests initialize a real Streamable HTTP MCP client and call
`validate_blueprint`; tool tests cover workspace path confinement, atomic writes,
Design Bridge import, and `.aub.zip` package creation.
