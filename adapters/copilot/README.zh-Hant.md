# GitHub Copilot Adapter

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

產生 GitHub Copilot 可直接使用的 implement、plan 或 review prompt，不會改變核心 Blueprint schema。

```bash
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json dashboard.copilot.md
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json - --task review
```

產生的 prompt 會要求 Copilot 讀取 `.github/copilot-instructions.md` 與適用的 `AGENTS.md`、重用 repository 既有元件與模式、執行檢查，並針對每個 acceptance id 回報證據。

支援 MCP 的 Copilot 使用者也可以透過 AUB MCP server 的 `export_prompt` tool 使用同一份合約（`adapter: "copilot"`）。請看 [`apps/mcp-server/README.md`](../../apps/mcp-server/README.md)。
