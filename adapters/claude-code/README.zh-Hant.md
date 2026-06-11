# Claude Code Adapter

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

產生 Claude Code 可直接使用的 implement、plan 或 review prompt，不會改變核心 Blueprint schema。

```bash
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json dashboard.claude.md
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json - --task plan
```

產生的 prompt 會要求 Claude Code 讀取 repository instructions、保留既有實作模式、執行檢查，並針對每個 acceptance id 回報證據。
