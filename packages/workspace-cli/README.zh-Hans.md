# aub-workspace

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

在既有项目中启动 AUB workspace-connected mode，不需要先 clone AUB。

```bash
cd /path/to/your-existing-app
npx aub-workspace
```

这个指令会启动本机 AUB MCP HTTP server、提供 bundled AUB editor、把 editor 连接到 MCP endpoint，并打开浏览器。

Options:

```bash
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 或更新版本
- 一个要作为 AUB workspace 的本机项目目录
