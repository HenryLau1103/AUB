# GitHub Copilot Adapter

Languages: **English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

Generate a GitHub Copilot–ready implementation, planning, or review prompt without changing the core Blueprint schema.

```bash
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json dashboard.copilot.md
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json - --task review
```

The prompt tells Copilot to read `.github/copilot-instructions.md` and any applicable `AGENTS.md`, reuse repository-native components and patterns, run checks, and report evidence for every acceptance id.

Copilot users with MCP support can also call the same contract through the AUB MCP server's `export_prompt` tool (`adapter: "copilot"`). See [`apps/mcp-server/README.md`](../../apps/mcp-server/README.md).
