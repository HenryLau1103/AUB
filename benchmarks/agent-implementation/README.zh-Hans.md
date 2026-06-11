# Agent Implementation Benchmark

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

这个 benchmark 检查 Agent 是否能把固定的 AUB Blueprint 实作成可运行的 standalone implementation，而不只是提取信息。

它会验证：

- 所有 Blueprint nodes 与 hierarchy
- desktop、tablet、mobile 的精确 geometry
- 声明的 content 与 design tokens
- responsive horizontal overflow
- 两个 click interactions
- implementation report 完整度
- screenshots 与 `reference.html` 的 computed-style comparison

## 使用本机 AI 工作站运行

```bash
pnpm benchmark:implementation qwen3.6-35b-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

因为 Blueprint 会发送到指定 Agent，即使 Agent 在本机网络，也必须明确加上 `--allow-external`。结果、生成的 HTML、reports、measurements 与 viewport screenshots 会写到 `results/<agent>/`。

Benchmark 使用已安装的本机 Chrome headless mode。可用 `AUB_CHROME_BIN=/path/to/chrome` 覆盖自动侦测。

如果 deterministic scorer 有变更，可重新评分既有 measured result：

```bash
pnpm score:implementation \
  benchmarks/agent-implementation/results/<agent>/measurements.json \
  benchmarks/agent-implementation/results/<agent>/implementation-report.json
```
