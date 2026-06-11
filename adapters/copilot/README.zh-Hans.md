# GitHub Copilot Adapter

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

生成 GitHub Copilot 可直接使用的 implement、plan 或 review prompt，不会改变核心 Blueprint schema。

```bash
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json dashboard.copilot.md
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json - --task review
```

生成的 prompt 会要求 Copilot 读取 `.github/copilot-instructions.md` 与适用的 `AGENTS.md`、重用 repository 既有组件与模式、运行检查，并针对每个 acceptance id 回报证据。

支持 MCP 的 Copilot 用户也可以通过 AUB MCP server 的 `export_prompt` tool 使用同一份合约（`adapter: "copilot"`）。请看 [`apps/mcp-server/README.md`](../../apps/mcp-server/README.md)。
