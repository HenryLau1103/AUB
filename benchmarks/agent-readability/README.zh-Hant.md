# Agent Readability Benchmark

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

這個 benchmark 檢查 Agent 是否能擷取精確的 AUB 事實，而不是重新設計或自行推論。

## Files

- `prompt.md`：送給 Agent 的任務
- `output.schema.json`：精確 response shape
- `expected.json`：由 `examples/freeform-actions.ui.json` 推導出的標準答案
- `results/`：暫存 raw output 與 score reports

## Run

外部執行必須明確加上 `--allow-external`。

```bash
node scripts/run-agent-readability.mjs codex --allow-external -- \
  codex exec --ephemeral --sandbox read-only \
  --output-schema benchmarks/agent-readability/output.schema.json -
```

對於接受 stdin prompt 的其他 CLI：

```bash
node scripts/run-agent-readability.mjs gemini --allow-external -- gemini
```

Runner 會保存 raw stdout/stderr、擷取一個 JSON object、評分 22 個精確事實，並把 report 寫到 `results/`。
