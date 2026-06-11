# AUB MCP Server

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

[Model Context Protocol](https://modelcontextprotocol.io) server です。**stdio または Streamable HTTP** で UI Blueprint tools を coding agents に公開します。Agent は `.ui.json`、prompt、report files を repo 間で手動移動せず、AUB tools を直接呼び出せます。

Server は repo の existing pure-function libraries を薄く wrap しています。Core logic は [`scripts/`](../../scripts) にあります。

## Tools

主な tools：

- Blueprint discovery: `list_blueprints`, `get_blueprint`
- Validation and writes: `validate_blueprint`, `write_blueprint`
- Handoff and prompts: `export_prompt`, `export_handoff`
- Reports: `submit_report`
- Projects: `list_projects`, `get_project`, `validate_project`
- Components: `resolve_component`
- Diff/migrate/lock: `diff_blueprints`, `migrate_blueprint`, `lock_blueprint`
- Workspace loop: `get_aub_session`, `update_aub_session`, `get_workspace_status`
- Project scanning: `scan_project_ui`, `generate_template_from_source`, `approve_component_candidate`
- Agent authoring contract: `export_template_authoring_prompt`

## Build

通常のユーザーはこの package を直接起動しません。既存 app の root で実行します。

```bash
cd /path/to/existing-app
npx aub-workspace
```

これは MCP server を起動し、AUB editor を serve し、workspace に接続済みの editor を開きます。

AUB を開発する場合、または特定 MCP client に登録する場合だけ manual command を使います。

```bash
cd apps/mcp-server
pnpm install
pnpm build
```

Stdio entry：

```bash
node dist/index.js /path/to/your/repo
```

Streamable HTTP：

```bash
node dist/http.js --workspace /path/to/your/repo --host 127.0.0.1 --port 3100
curl http://127.0.0.1:3100/health
```

MCP endpoint は `http://127.0.0.1:3100/mcp` です。同じ HTTP process は `POST /rpc` も提供し、AUB editor の workspace-connected mode が同じ tool implementations を呼び出せます。

## Register with an agent

Built entry を target repository に workspace root として渡します。

Claude Code：

```bash
claude mcp add aub -- node /abs/path/to/AUB/apps/mcp-server/dist/index.js /abs/path/to/your/repo
```

Codex `~/.codex/config.toml`：

```toml
[mcp_servers.aub]
command = "node"
args = ["/abs/path/to/AUB/apps/mcp-server/dist/index.js", "/abs/path/to/your/repo"]
```

## Test

```bash
pnpm test
pnpm typecheck
```
