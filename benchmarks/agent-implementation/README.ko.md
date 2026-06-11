# Agent Implementation Benchmark

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

이 benchmark 는 Agent 가 고정된 AUB Blueprint 를 단순 정보 추출이 아니라 동작하는 standalone implementation 으로 만들 수 있는지 확인합니다.

검증 항목:

- 모든 Blueprint nodes 와 hierarchy
- Desktop, tablet, mobile 의 정확한 geometry
- 선언된 content 와 design tokens
- Responsive horizontal overflow
- 두 개의 click interactions
- Implementation report 완전성
- Screenshots 와 `reference.html` 의 computed-style comparison

## Local AI workstation 으로 실행

```bash
pnpm benchmark:implementation qwen3.6-35b-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

Blueprint 가 지정 Agent 로 전송되므로 Agent 가 local network 에 있더라도 `--allow-external` flag 가 필요합니다. 결과, 생성 HTML, reports, measurements, viewport screenshots 는 `results/<agent>/` 에 저장됩니다.

Benchmark 는 installed local Chrome binary 를 headless mode 로 사용합니다. `AUB_CHROME_BIN=/path/to/chrome` 으로 자동 감지를 덮어쓸 수 있습니다.
