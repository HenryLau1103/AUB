# GitHub Copilot Adapter

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

GitHub Copilot 向けの implement、plan、review prompt を生成します。Core Blueprint schema は変更しません。

```bash
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json dashboard.copilot.md
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json - --task review
```

生成された prompt は Copilot に `.github/copilot-instructions.md` と適用される `AGENTS.md` を読み、repository-native components と patterns を再利用し、checks を実行し、各 acceptance id の evidence を報告するよう指示します。

MCP 対応の Copilot users は、AUB MCP server の `export_prompt` tool でも同じ contract を利用できます（`adapter: "copilot"`）。[`apps/mcp-server/README.md`](../../apps/mcp-server/README.md) を参照してください。
