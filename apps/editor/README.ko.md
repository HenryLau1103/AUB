# AUB Editor

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · **한국어**

UI Blueprints v0.3 용 WYSIWYG editor 입니다.

## What it does

- `.ui.json`, Figma/Penpot `*.aub.bridge.json`, `aub.registry.json`, Angular HTML/SCSS/TS bundle, personal-template package import.
- Dashboard, collaboration, commerce, content, onboarding 등을 포함한 18 개 visual templates 로 시작.
- Goal, layout, interactions, responsive rules, acceptance, AI handoff 를 6-stage workflow 로 편집.
- Artboard 에서 components drag, place, resize, select. Freeform geometry 와 flex/grid auto layout 지원.
- Desktop/tablet/mobile preview 와 viewport 별 canvas resolution 설정.
- `.ui.json`, `.ui.md`, Codex-ready task, `.aub.zip` handoff package, AI authoring kit export.
- `.aub.project.json`, member screens, navigation graph 를 포함한 multi-screen project 편집.
- Angular component bundle import, source-line diagnostics 표시, diagnostics 를 canvas node 로 focus.
- Local AUB workspace 에 연결하여 같은 MCP tools 로 Blueprints load/save, workspace templates review, component candidates approve, real app route side-by-side preview 수행.

## Development

```bash
cd apps/editor
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
```

## Architecture

주요 code 는 `src/` 에 있습니다.

- `App.tsx`: 3-column layout 과 editor state.
- `App.css`: design tokens, layout, canvas, workspace UI styles.
- `lib/`: store, geometry, history, templates, project, io, workspace client, registry helper.
- `components/`: TopBar, ProjectBar, WorkspacePanel, Palette, Canvas, WorkflowBar, BlueprintPanel, PropertiesPanel 등.

Editor 는 repo root 의 `schema/` 와 registry 를 직접 공유하며 schema source of truth 를 복제하지 않습니다.

## Remaining backlog

- YAML editor
- UI 에서 `.ui.lock.json` 생성
- Nested layers 의 Tab/arrow focus traversal
