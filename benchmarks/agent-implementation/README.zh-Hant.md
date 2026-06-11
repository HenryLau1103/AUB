# Agent Implementation Benchmark

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

這個 benchmark 檢查 Agent 是否能把固定的 AUB Blueprint 實作成可運作的 standalone implementation，而不只是擷取資訊。

它會驗證：

- 所有 Blueprint nodes 與 hierarchy
- desktop、tablet、mobile 的精確 geometry
- 宣告的 content 與 design tokens
- responsive horizontal overflow
- 兩個 click interactions
- implementation report 完整度
- screenshots 與 `reference.html` 的 computed-style comparison

## 使用本機 AI 工作站執行

```bash
pnpm benchmark:implementation qwen3.6-35b-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

因為 Blueprint 會送到指定 Agent，即使 Agent 在本機網路，也必須明確加上 `--allow-external`。結果、產生的 HTML、reports、measurements 與 viewport screenshots 會寫到 `results/<agent>/`。

Benchmark 使用已安裝的本機 Chrome headless mode。可用 `AUB_CHROME_BIN=/path/to/chrome` 覆寫自動偵測。

如果 deterministic scorer 有變更，可重新評分既有 measured result：

```bash
pnpm score:implementation \
  benchmarks/agent-implementation/results/<agent>/measurements.json \
  benchmarks/agent-implementation/results/<agent>/implementation-report.json
```
