# AUB MCP Server

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

这是 [Model Context Protocol](https://modelcontextprotocol.io) server，通过 **stdio 或 Streamable HTTP** 把 UI Blueprint tools 提供给 coding agents。Agent 可以直接调用 AUB tools，不需要在 repo 之间手动搬 `.ui.json`、prompt 与 report files。

Server 是 repo 既有 pure-function libraries 的薄包装，核心逻辑仍在 [`scripts/`](../../scripts)。

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

一般用户不需要直接启动这个 package。请在既有 app 根目录执行：

```bash
cd /path/to/existing-app
npx aub-workspace
```

这会启动 MCP server、提供 AUB editor，并打开已连接 workspace 的 editor。

只有在开发 AUB 或注册特定 MCP client 时，才使用手动指令：

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

MCP endpoint 是 `http://127.0.0.1:3100/mcp`。同一个 HTTP process 也提供 `POST /rpc`，让 AUB editor 的 workspace-connected mode 可以调用相同 tool implementations。

## Register with an agent

把 built entry 指到 target repository 作为 workspace root。

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
