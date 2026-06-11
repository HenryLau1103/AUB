# Agent Readability Benchmark

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

이 benchmark 는 Agent 가 redesign 이나 추론 없이 정확한 AUB facts 를 추출할 수 있는지 확인합니다.

## Files

- `prompt.md`: Agent 에게 보내는 task
- `output.schema.json`: 정확한 response shape
- `expected.json`: `examples/freeform-actions.ui.json` 에서 도출한 authoritative answer
- `results/`: transient raw output 과 score reports

## Run

External execution 은 `--allow-external` 로 명시적으로 허용해야 합니다.

```bash
node scripts/run-agent-readability.mjs codex --allow-external -- \
  codex exec --ephemeral --sandbox read-only \
  --output-schema benchmarks/agent-readability/output.schema.json -
```

Stdin prompt 를 받는 다른 CLI 예:

```bash
node scripts/run-agent-readability.mjs gemini --allow-external -- gemini
```

Runner 는 raw stdout/stderr 를 저장하고, 하나의 JSON object 를 추출하고, 22 개 exact facts 를 score 한 뒤 `results/` 에 report 를 씁니다.
