# aub-workspace

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

AUB を clone せず、既存 project から AUB workspace-connected mode を起動します。

```bash
cd /path/to/your-existing-app
npx aub-workspace
```

この command は local AUB MCP HTTP server を起動し、bundled AUB editor を serve し、editor を MCP endpoint に接続して browser を開きます。

成功すると次のような出力になります。

```text
AUB Workspace is running
Workspace: /path/to/your-existing-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

Editor では workspace loop に沿って進めます。

1. 既存 app を scan する。
2. route から candidate template を生成する。
3. component candidates を確認する。
4. Blueprint/session を保存する。
5. Copilot、Codex、または他の coding agent 向けの指示をコピーする。

AUB は既存 project に次の files を作成する場合があります。

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
aub.registry.json
screens/*.ui.json
```

Options:

```bash
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 以降
- AUB workspace として使う local project directory
