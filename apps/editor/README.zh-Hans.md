# AUB Editor

语言： [English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

UI Blueprints v0.3 的 WYSIWYG 编辑器。

## 功能

- 导入 `.ui.json`、Figma/Penpot `*.aub.bridge.json`、`aub.registry.json`、Angular HTML/SCSS/TS bundle 或个人模板包。
- 从 18 个视觉模板开始，支持 dashboard、collaboration、commerce、content、onboarding 等场景。
- 通过六阶段 workflow 编辑 goal、layout、interactions、responsive rules、acceptance 与 AI handoff。
- 在 artboard 上拖曳、放置、缩放与选取组件，支持 freeform geometry 与 flex/grid auto layout。
- 针对 desktop/tablet/mobile 预览画面，并可设置各 viewport canvas resolution。
- 导出 `.ui.json`、`.ui.md`、Codex-ready task、`.aub.zip` handoff package 与 AI authoring kit。
- 编辑 multi-screen project，包含 `.aub.project.json`、member screens 与 navigation graph。
- 导入 Angular component bundle，显示 source-line diagnostics，并可把 diagnostics focus 到 canvas node。
- 连接本机 AUB workspace，通过同一组 MCP tools 加载/保存 Blueprints、审核 workspace templates、批准 component candidates，并并排预览真实 app route。

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

主要代码在 `src/`：

- `App.tsx`：三栏 layout 与 editor state。
- `App.css`：design tokens、layout、canvas 与 workspace UI 样式。
- `lib/`：store、geometry、history、templates、project、io、workspace client 与 registry helper。
- `components/`：TopBar、ProjectBar、WorkspacePanel、Palette、Canvas、WorkflowBar、BlueprintPanel、PropertiesPanel 等 UI。

Editor 直接共用 repo root 的 `schema/` 与 registry，不复制 schema source of truth。

## Remaining backlog

- YAML editor
- 从 UI 生成 `.ui.lock.json`
- 嵌套 layer 的 Tab/arrow focus traversal
