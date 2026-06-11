# AUB MCP Server

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

[Model Context Protocol](https://modelcontextprotocol.io) server 입니다. **stdio 또는 Streamable HTTP** 로 UI Blueprint tools 를 coding agents 에 노출합니다. Agent 는 `.ui.json`, prompt, report files 를 repo 사이에서 수동으로 옮기지 않고 AUB tools 를 직접 호출할 수 있습니다.

Server 는 repo 의 existing pure-function libraries 를 얇게 wrap 합니다. Core logic 은 [`scripts/`](../../scripts) 에 있습니다.

## Tools

주요 tools:

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

일반 사용자는 이 package 를 직접 시작하지 않습니다. 기존 app root 에서 실행합니다.

```bash
cd /path/to/existing-app
npx aub-workspace
```

이 command 는 MCP server 를 시작하고, AUB editor 를 serve 하며, workspace 에 연결된 editor 를 엽니다.

AUB 를 개발하거나 특정 MCP client 에 등록할 때만 manual command 를 사용합니다.

```bash
cd apps/mcp-server
pnpm install
pnpm build
```

Stdio entry:

```bash
node dist/index.js /path/to/your/repo
```

Streamable HTTP:

```bash
node dist/http.js --workspace /path/to/your/repo --host 127.0.0.1 --port 3100
curl http://127.0.0.1:3100/health
```

MCP endpoint 는 `http://127.0.0.1:3100/mcp` 입니다. 같은 HTTP process 는 `POST /rpc` 도 제공해 AUB editor 의 workspace-connected mode 가 같은 tool implementations 를 호출할 수 있습니다.

## Register with an agent

Built entry 를 target repository 의 workspace root 로 전달합니다.

Claude Code:

```bash
claude mcp add aub -- node /abs/path/to/AUB/apps/mcp-server/dist/index.js /abs/path/to/your/repo
```

Codex `~/.codex/config.toml`:

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
