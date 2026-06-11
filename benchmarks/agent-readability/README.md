# Agent Readability Benchmark

Languages: **English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

This benchmark checks whether an agent can extract exact AUB facts without redesigning or inferring.

## Files

- `prompt.md`: task sent to the agent
- `output.schema.json`: exact response shape
- `expected.json`: authoritative answer derived from `examples/freeform-actions.ui.json`
- `results/`: transient raw output and score reports

## Run

External execution is intentionally gated by `--allow-external`.

```bash
node scripts/run-agent-readability.mjs codex --allow-external -- \
  codex exec --ephemeral --sandbox read-only \
  --output-schema benchmarks/agent-readability/output.schema.json -
```

For another CLI that accepts a prompt on standard input:

```bash
node scripts/run-agent-readability.mjs gemini --allow-external -- gemini
```

For an Ollama server, use the non-streaming API wrapper to avoid terminal control output:

```bash
node scripts/run-agent-readability.mjs qwen-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://127.0.0.1:11434
```

The runner stores raw stdout/stderr, extracts one JSON object, scores 22 exact facts, and writes a report under `results/`.

The runner embeds `examples/freeform-actions.ui.json` in the prompt so local and remote CLIs receive identical input. Running either command sends that prompt and fixture to the selected agent. Do not run it without authorization for that data transfer.
