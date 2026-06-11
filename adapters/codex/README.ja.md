# Codex Adapter

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

Codex 向けの implement、plan、review prompt を生成します。Core Blueprint schema は変更しません。

```bash
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json dashboard.codex.md
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json - --task review
```

生成された prompt は Codex に適用される `AGENTS.md` を読み、repository-native patterns に従い、checks を実行し、各 acceptance id の evidence を報告するよう指示します。
