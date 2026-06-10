# Agent Implementation Benchmark

This benchmark checks whether an agent can turn a fixed AUB Blueprint into a
working standalone implementation rather than only extract facts.

It verifies:

- all Blueprint nodes and hierarchy
- exact desktop, tablet, and mobile geometry
- declared content and design tokens
- responsive horizontal overflow
- both click interactions
- implementation report completeness
- screenshots and computed-style comparison against `reference.html`

## Run with the local AI workstation

```bash
pnpm benchmark:implementation qwen3.6-35b-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

The explicit flag is required because the Blueprint is sent to the named agent,
even when that agent is on the local network. Results, generated HTML, reports,
measurements, and viewport screenshots are written under `results/<agent>/`.

The benchmark uses an installed local Chrome binary in headless mode. Override
automatic detection with `AUB_CHROME_BIN=/path/to/chrome`.

Re-score an existing measured result after changing the deterministic scorer:

```bash
pnpm score:implementation \
  benchmarks/agent-implementation/results/<agent>/measurements.json \
  benchmarks/agent-implementation/results/<agent>/implementation-report.json
```
