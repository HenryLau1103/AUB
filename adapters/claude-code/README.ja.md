# Claude Code Adapter

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

Claude Code 向けの implement、plan、review prompt を生成します。Core Blueprint schema は変更しません。

```bash
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json dashboard.claude.md
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json - --task plan
```

生成された prompt は Claude Code に repository instructions を読み、既存 pattern を保ち、checks を実行し、各 acceptance id の evidence を報告するよう指示します。
