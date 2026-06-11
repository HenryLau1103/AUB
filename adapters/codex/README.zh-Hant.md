# Codex Adapter

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

產生 Codex 可直接使用的 implement、plan 或 review prompt，不會改變核心 Blueprint schema。

```bash
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json dashboard.codex.md
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json - --task review
```

產生的 prompt 會要求 Codex 讀取適用的 `AGENTS.md`、遵循 repository 既有模式、執行檢查，並針對每個 acceptance id 回報證據。
