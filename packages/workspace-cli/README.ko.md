# aub-workspace

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

AUB 를 clone 하지 않고 기존 project 에서 AUB workspace-connected mode 를 실행합니다.

```bash
cd /path/to/your-existing-app
npx aub-workspace
```

이 command 는 local AUB MCP HTTP server 를 시작하고, bundled AUB editor 를 serve 하며, editor 를 MCP endpoint 에 연결하고 browser 를 엽니다.

Options:

```bash
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

Requirements:

- Node.js 24 이상
- AUB workspace 로 사용할 local project directory
