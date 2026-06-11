# Codex Adapter

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

生成 Codex 可直接使用的 implement、plan 或 review prompt，不会改变核心 Blueprint schema。

```bash
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json dashboard.codex.md
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json - --task review
```

生成的 prompt 会要求 Codex 读取适用的 `AGENTS.md`、遵循 repository 既有模式、运行检查，并针对每个 acceptance id 回报证据。
