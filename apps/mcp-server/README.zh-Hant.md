# AUB MCP Server

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

這是 [Model Context Protocol](https://modelcontextprotocol.io) server，透過 **stdio 或 Streamable HTTP** 把 UI Blueprint tools 提供給 coding agents。Agent 可以直接呼叫 AUB tools，不需要在 repo 之間手動搬 `.ui.json`、prompt 與 report files。

Server 是 repo 既有 pure-function libraries 的薄包裝，核心邏輯仍在 [`scripts/`](../../scripts)。

## Tools

主要工具包含：

- Blueprint discovery：`list_blueprints`、`get_blueprint`
- Validation and writes：`validate_blueprint`、`write_blueprint`
- Handoff and prompts：`export_prompt`、`export_handoff`
- Reports：`submit_report`
- Projects：`list_projects`、`get_project`、`validate_project`
- Components：`resolve_component`
- Diff/migrate/lock：`diff_blueprints`、`migrate_blueprint`、`lock_blueprint`
- Workspace loop：`get_aub_session`、`update_aub_session`、`get_workspace_status`
- Project scanning：`scan_project_ui`、`generate_template_from_source`、`approve_component_candidate`
- Agent authoring contract：`export_template_authoring_prompt`

## Build

一般使用者不需要直接啟動這個 package。請在既有 app 根目錄執行：

```bash
cd /path/to/existing-app
npx aub-workspace
```

這會啟動 MCP server、提供 AUB editor，並開啟已連到 workspace 的 editor。

只有在開發 AUB 或註冊特定 MCP client 時，才使用手動指令：

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

MCP endpoint 是 `http://127.0.0.1:3100/mcp`。同一個 HTTP process 也提供 `POST /rpc`，讓 AUB editor 的 workspace-connected mode 可以呼叫相同 tool implementations。

## Register with an agent

把 built entry 指到 target repository 作為 workspace root。

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
