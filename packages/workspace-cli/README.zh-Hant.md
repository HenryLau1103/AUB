# aub-workspace

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

在既有專案中啟動 AUB workspace-connected mode，不需要先 clone AUB。

```bash
cd /path/to/your-existing-app
npx aub-workspace
```

這個指令會啟動本機 AUB MCP HTTP server、提供 bundled AUB editor、把 editor 連到 MCP endpoint，並開啟瀏覽器。

Options:

```bash
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 或更新版本
- 一個要作為 AUB workspace 的本機專案資料夾
