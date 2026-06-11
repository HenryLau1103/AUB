# AUB Editor

Languages: [English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語** · [한국어](./README.ko.md)

UI Blueprints v0.3 の WYSIWYG editor です。

## What it does

- `.ui.json`、Figma/Penpot `*.aub.bridge.json`、`aub.registry.json`、Angular HTML/SCSS/TS bundle、personal-template package を import。
- Dashboard、collaboration、commerce、content、onboarding などを含む 18 個の visual templates から開始。
- Goal、layout、interactions、responsive rules、acceptance、AI handoff を 6-stage workflow で編集。
- Artboard 上で components を drag、place、resize、select。Freeform geometry と flex/grid auto layout をサポート。
- Desktop/tablet/mobile preview と viewport ごとの canvas resolution 設定。
- `.ui.json`、`.ui.md`、Codex-ready task、`.aub.zip` handoff package、AI authoring kit を export。
- `.aub.project.json`、member screens、navigation graph を含む multi-screen project を編集。
- Angular component bundle を import し、source-line diagnostics を表示し、diagnostics を canvas node に focus。
- Local AUB workspace に接続し、同じ MCP tools で Blueprints の load/save、workspace templates の review、component candidates の approve、real app route の side-by-side preview を実行。

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

主要 code は `src/` にあります。

- `App.tsx`: 3-column layout と editor state。
- `App.css`: design tokens、layout、canvas、workspace UI styles。
- `lib/`: store、geometry、history、templates、project、io、workspace client、registry helper。
- `components/`: TopBar、ProjectBar、WorkspacePanel、Palette、Canvas、WorkflowBar、BlueprintPanel、PropertiesPanel など。

Editor は repo root の `schema/` と registry を直接共有し、schema source of truth を複製しません。

## Remaining backlog

- YAML editor
- UI から `.ui.lock.json` を生成
- Nested layers の Tab/arrow focus traversal
