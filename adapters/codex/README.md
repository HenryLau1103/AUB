# Codex Adapter

Languages: **English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

Generate a Codex-ready implementation, planning, or review prompt without changing the core Blueprint schema.

```bash
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json dashboard.codex.md
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json - --task review
```

The prompt tells Codex to read applicable `AGENTS.md` files, follow repository-native patterns, run checks, and report evidence for every acceptance id.
