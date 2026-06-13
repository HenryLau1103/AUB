# aub-workspace

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

在既有專案中啟動 AUB workspace-connected mode，不需要先 clone AUB。

```bash
cd /path/to/your-existing-app
npx aub-workspace init
npx aub-workspace
```

`init` 會建立 AUB 設定、`.aubignore`、`AGENTS.md`、GitHub issue templates、Copilot instructions 與 PR workflow。`aub-workspace` 會啟動本機 AUB MCP HTTP server、提供 bundled AUB editor、把 editor 連到 MCP endpoint，並開啟瀏覽器。

成功時會看到類似輸出：

```text
AUB Workspace is running
Workspace: /path/to/your-existing-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

進入 editor 後照 workspace loop：

1. 掃描既有 app。
2. 從 route 產生 candidate template。
3. 審核自訂元件候選。
4. 儲存 Blueprint/session。
5. 複製給 Copilot、Codex 或其他 coding agent 的指令。

AUB 可能會在既有專案建立：

```text
.aub/session.json
.aub/scan-report.json
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
npx aub-workspace demo
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
npx aub-workspace --no-open --print-auth-url
```

`--no-open` 不會開啟瀏覽器，而且只會印出遮蔽 token 的 editor URL。
如果你需要手動複製可連線的 URL，請在可信任的本機終端機使用
`--no-open --print-auth-url`。該 URL 會包含本機 RPC token，不要貼到
issue、PR、log 或聊天訊息。

`demo` 會建立一個合成 workspace，用來證明安全流程，不需要使用真實專案。它包含 scan report、generated template、Blueprint、會失敗的 implementation report、可通過的 implementation report，以及 fail/pass PR safety comment。

Requirements:

- Node.js 24 或更新版本
- 一個要作為 AUB workspace 的本機專案資料夾
