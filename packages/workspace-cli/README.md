# aub-workspace

Languages: **English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

Run AUB workspace-connected mode from an existing project without cloning AUB.

```bash
cd /path/to/your-existing-app
npx aub-workspace
```

The command starts a local AUB MCP HTTP server, serves the bundled AUB editor, connects the editor to the MCP endpoint, and opens the browser.

Options:

```bash
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 or newer
- A local project directory to use as the AUB workspace
