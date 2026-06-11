# AUB Editor

語言： [English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

UI Blueprints v0.3 的 WYSIWYG 編輯器。

## 功能

- 匯入 `.ui.json`、Figma/Penpot `*.aub.bridge.json`、`aub.registry.json`、Angular HTML/SCSS/TS bundle 或個人範本包。
- 從 18 個視覺範本開始，支援 dashboard、collaboration、commerce、content、onboarding 等場景。
- 透過六階段 workflow 編輯 goal、layout、interactions、responsive rules、acceptance 與 AI handoff。
- 在 artboard 上拖曳、放置、縮放與選取元件，支援 freeform geometry 與 flex/grid auto layout。
- 針對 desktop/tablet/mobile 預覽畫面，並可設定各 viewport canvas resolution。
- 匯出 `.ui.json`、`.ui.md`、Codex-ready task、`.aub.zip` handoff package 與 AI authoring kit。
- 編輯 multi-screen project，包含 `.aub.project.json`、member screens 與 navigation graph。
- 匯入 Angular component bundle，顯示 source-line diagnostics，並可把 diagnostics focus 到 canvas node。
- 連到本機 AUB workspace，透過同一組 MCP tools 載入/儲存 Blueprints、審核 workspace templates、批准 component candidates，並並排預覽真實 app route。

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

主要程式碼在 `src/`：

- `App.tsx`：三欄 layout 與 editor state。
- `App.css`：design tokens、layout、canvas 與 workspace UI 樣式。
- `lib/`：store、geometry、history、templates、project、io、workspace client 與 registry helper。
- `components/`：TopBar、ProjectBar、WorkspacePanel、Palette、Canvas、WorkflowBar、BlueprintPanel、PropertiesPanel 等 UI。

Editor 直接共用 repo root 的 `schema/` 與 registry，不複製 schema source of truth。

## Remaining backlog

- YAML editor
- 從 UI 產生 `.ui.lock.json`
- 巢狀 layer 的 Tab/arrow focus traversal
