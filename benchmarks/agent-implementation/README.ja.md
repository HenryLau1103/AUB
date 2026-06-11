# Agent Implementation Benchmark

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

この benchmark は、Agent が固定された AUB Blueprint を単なる情報抽出ではなく、動作する standalone implementation に変換できるかを確認します。

検証項目：

- すべての Blueprint nodes と hierarchy
- Desktop、tablet、mobile の正確な geometry
- 宣言された content と design tokens
- Responsive horizontal overflow
- 2 つの click interactions
- Implementation report の完全性
- Screenshots と `reference.html` の computed-style comparison

## Local AI workstation で実行

```bash
pnpm benchmark:implementation qwen3.6-35b-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

Blueprint が指定 Agent に送信されるため、Agent が local network 上にあっても `--allow-external` が必要です。結果、生成 HTML、reports、measurements、viewport screenshots は `results/<agent>/` に保存されます。

Benchmark は installed local Chrome binary を headless mode で使います。`AUB_CHROME_BIN=/path/to/chrome` で自動検出を上書きできます。
