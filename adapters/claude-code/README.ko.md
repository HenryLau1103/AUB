# Claude Code Adapter

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

Claude Code 용 implement, plan, review prompt 를 생성합니다. Core Blueprint schema 는 변경하지 않습니다.

```bash
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json dashboard.claude.md
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json - --task plan
```

생성된 prompt 는 Claude Code 에게 repository instructions 를 읽고, 기존 pattern 을 유지하고, checks 를 실행하며, 각 acceptance id 의 evidence 를 보고하도록 지시합니다.
