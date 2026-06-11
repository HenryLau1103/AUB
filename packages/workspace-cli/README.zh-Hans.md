# aub-workspace

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

在既有项目中启动 AUB workspace-connected mode，不需要先 clone AUB。

```bash
cd /path/to/your-existing-app
npx aub-workspace init
npx aub-workspace
```

`init` 会创建 AUB 配置、GitHub issue templates、Copilot instructions 和 PR workflow。`aub-workspace` 会启动本机 AUB MCP HTTP server、提供 bundled AUB editor、把 editor 连接到 MCP endpoint，并打开浏览器。

成功时会看到类似输出：

```text
AUB Workspace is running
Workspace: /path/to/your-existing-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

进入 editor 后按 workspace loop：

1. 扫描既有 app。
2. 从 route 生成 candidate template。
3. 审核自定义组件候选。
4. 保存 Blueprint/session。
5. 复制给 Copilot、Codex 或其他 coding agent 的指令。

AUB 可能会在既有项目创建：

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
.aub/ci.json
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

- Node.js 24 或更新版本
- 一个要作为 AUB workspace 的本机项目目录
