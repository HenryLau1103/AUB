# aub-workspace

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

AUB を clone せず、既存 project から AUB workspace-connected mode を起動します。

```bash
cd /path/to/your-existing-app
npx aub-workspace
```

この command は local AUB MCP HTTP server を起動し、bundled AUB editor を serve し、editor を MCP endpoint に接続して browser を開きます。

Options:

```bash
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 以降
- AUB workspace として使う local project directory
