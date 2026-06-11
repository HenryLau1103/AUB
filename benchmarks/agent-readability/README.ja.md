# Agent Readability Benchmark

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

この benchmark は、Agent が redesign や推論をせず、正確な AUB facts を抽出できるかを確認します。

## Files

- `prompt.md`: Agent に送る task
- `output.schema.json`: 正確な response shape
- `expected.json`: `examples/freeform-actions.ui.json` から導出した authoritative answer
- `results/`: transient raw output と score reports

## Run

External execution は `--allow-external` で明示的に許可します。

```bash
node scripts/run-agent-readability.mjs codex --allow-external -- \
  codex exec --ephemeral --sandbox read-only \
  --output-schema benchmarks/agent-readability/output.schema.json -
```

Stdin prompt を受け取る他の CLI の例：

```bash
node scripts/run-agent-readability.mjs gemini --allow-external -- gemini
```

Runner は raw stdout/stderr を保存し、1 つの JSON object を抽出し、22 個の exact facts を score して `results/` に report を書きます。
