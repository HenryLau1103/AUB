# aub-workspace

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

AUB 를 clone 하지 않고 기존 project 에서 AUB workspace-connected mode 를 실행합니다.

```bash
cd /path/to/your-existing-app
npx aub-workspace init
npx aub-workspace
```

`init` 은 AUB config, `.aubignore`, `AGENTS.md`, GitHub issue templates, Copilot instructions, PR workflow 를 만듭니다. `aub-workspace` 는 local AUB MCP HTTP server 를 시작하고, bundled AUB editor 를 serve 하며, editor 를 MCP endpoint 에 연결하고 browser 를 엽니다.

성공하면 다음과 같은 output 이 표시됩니다.

```text
AUB Workspace is running
Workspace: /path/to/your-existing-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

Editor 에서는 workspace loop 순서로 진행합니다.

1. 기존 app 을 scan 합니다.
2. route 에서 candidate template 을 생성합니다.
3. component candidates 를 검토합니다.
4. Blueprint/session 을 저장합니다.
5. Copilot, Codex 또는 다른 coding agent 용 지시를 복사합니다.

AUB 는 기존 project 에 다음 files 를 만들 수 있습니다.

```text
.aub/session.json
.aub/scan-report.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
.aub/ci.json
.aubignore
AGENTS.md
.github/workflows/aub-contracts.yml
aub.registry.json
screens/*.ui.json
```

Options:

```bash
npx aub-workspace init
npx aub-workspace init --force
npx aub-workspace init --no-github
npx aub-workspace init --ci-only
npx aub-workspace demo
npx aub-workspace --workspace /path/to/app
npx aub-workspace --mcp-port 3100 --editor-port 3110
npx aub-workspace --no-open
```

`demo` 는 실제 프로젝트 없이 safety loop 를 확인할 수 있는 합성 workspace 를 만듭니다. scan report, generated template, Blueprint, 실패하는 implementation report, 통과 가능한 implementation report, fail/pass PR safety comment 가 포함됩니다.

Requirements:

- Node.js 24 이상
- AUB workspace 로 사용할 local project directory
