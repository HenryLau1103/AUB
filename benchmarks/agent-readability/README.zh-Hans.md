# Agent Readability Benchmark

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

这个 benchmark 检查 Agent 是否能提取精确的 AUB 事实，而不是重新设计或自行推断。

## Files

- `prompt.md`：发送给 Agent 的任务
- `output.schema.json`：精确 response shape
- `expected.json`：由 `examples/freeform-actions.ui.json` 推导出的标准答案
- `results/`：暂存 raw output 与 score reports

## Run

外部执行必须明确加上 `--allow-external`。

```bash
node scripts/run-agent-readability.mjs codex --allow-external -- \
  codex exec --ephemeral --sandbox read-only \
  --output-schema benchmarks/agent-readability/output.schema.json -
```

对于接受 stdin prompt 的其他 CLI：

```bash
node scripts/run-agent-readability.mjs gemini --allow-external -- gemini
```

Runner 会保存 raw stdout/stderr、提取一个 JSON object、评分 22 个精确事实，并把 report 写到 `results/`。
