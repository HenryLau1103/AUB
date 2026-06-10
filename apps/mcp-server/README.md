# AUB MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes UI Blueprint
tools to coding agents (Codex, Claude Code, MCP-capable IDEs) over **stdio**. Agents call AUB
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
| `export_prompt` | `ref`, `adapter?` (`generic` \| `codex` \| `claude-code` \| `copilot`), `task?` (`author` \| `plan` \| `implement` \| `review`) | An agent-ready prompt with embedded Blueprint context. |
| `submit_report` | `ref`, `report`, `persist?` | Verifies an implementation report (schema + node mappings + acceptance evidence). Accepted reports are written to `<root>/.aub/reports/`. |

`ref` is either a file path (relative to the workspace root) or a Blueprint `screen.id`.

## Build

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

## Scope

stdio transport, five core tools. HTTP/SSE transport, `.aub.zip` packaging over MCP, and
`diff` / `migrate` / `lock` tools are intentionally out of scope for this version.
