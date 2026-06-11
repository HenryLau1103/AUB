# GitHub Copilot Adapter

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

GitHub Copilot 용 implement, plan, review prompt 를 생성합니다. Core Blueprint schema 는 변경하지 않습니다.

```bash
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json dashboard.copilot.md
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json - --task review
```

생성된 prompt 는 Copilot 에게 `.github/copilot-instructions.md` 와 적용 가능한 `AGENTS.md` 를 읽고, repository-native components 와 patterns 를 재사용하고, checks 를 실행하며, 각 acceptance id 의 evidence 를 보고하도록 지시합니다.

MCP 를 지원하는 Copilot 사용자는 AUB MCP server 의 `export_prompt` tool 로도 같은 contract 를 사용할 수 있습니다(`adapter: "copilot"`). [`apps/mcp-server/README.md`](../../apps/mcp-server/README.md)를 참고하세요.
