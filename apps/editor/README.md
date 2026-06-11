# AUB Editor

WYSIWYG editor for UI Blueprints v0.3.

## What it does

- **Import** a `.ui.json`, Figma/Penpot `*.aub.bridge.json`, `aub.registry.json`, Angular HTML/SCSS/TS component bundle, or saved personal-template package
- **Review Angular imports** before loading, including source-line diagnostics and optional local Ollama suggestions
- **Focus imported diagnostics** on the corresponding canvas node after loading
- **Save personal templates** in browser storage, with preview, export, import, and delete actions
- **Start from 18 visual templates** with preview thumbnails covering dashboards, collaboration, commerce, content, and onboarding
- **Follow a six-stage workflow** for goal, layout, interactions, responsive rules, acceptance, and AI handoff
- **Autosave and restore** the active Blueprint draft in local browser storage
- **Compose** a screen by dragging components from the palette into the artboard, or by clicking to append to the selected container
- **Arrange freely** from the visible top-center drag handle; normal dragging stays in the current parent, while Option/Alt-drag explicitly reparents into another container
- **Place directly** by drag or palette click; dropping into an auto-layout container preserves its current child geometry and switches that container to freeform
- **Switch layout mode** per container between freeform geometry and flex/grid auto layout
- **Preview** the screen as a desktop/tablet/mobile UI mockup instead of a graph-only structure view
- **Set the canvas resolution** per viewport from common device presets or a custom width × height, clamped to the schema range and tracked in undo history
- **Fit the full artboard** automatically when loading a template or switching viewport, with a manual fit control
- **Audit rendered viewports** for overflow, undersized components, and freeform overlaps before AI handoff
- **Inspect** the hierarchy by selecting elements directly on the artboard
- **Edit** the selected node's properties (right): id, name, role, type, layout JSON, content JSON
- **Export** to `.ui.json` (download)
- **Export** to `.ui.md` with exact viewport geometry and design tokens
- **Edit** screen goals, declared interactions, responsive rules, and acceptance criteria
- **Compose a multi-screen project** — open or create an `.aub.project.json`, switch between member screens, add/remove/rename screens, set the entry screen, and edit the cross-screen navigation graph
- **Save a project** as a `.zip` bundling the project document and every member `.ui.json`
- **Bundle production component mappings** from `aub.registry.json` into project ZIPs and AI handoff packages
- **Export** a Codex-ready implementation task
- **Export** an `.aub.zip` AI handoff package with portable English/Traditional Chinese agent guides, generic and Codex tasks, JSON, Markdown, implementation report template/schema, viewport screenshots, and a SHA-256 manifest
- **Download** an AI authoring kit containing the current schema, registry, canonical example, validation guide, and author-task prompt
- **Live schema validation** — invalid edits show error count in the status bar
- **Connect to a local AUB workspace** over `aub-mcp-http`, load/save Blueprints through the same MCP tools agents use, review workspace templates, approve component candidates, and preview a real app route side by side.

## Development

```bash
cd apps/editor
pnpm install         # one-time
pnpm dev             # http://127.0.0.1:5173/
pnpm typecheck       # tsc --noEmit
pnpm build           # production build → dist/
pnpm preview         # serve the production build
```

## Architecture

```
src/
├── main.tsx                      # React mount
├── App.tsx                       # 3-column layout + state
├── App.css                       # design tokens + layout
├── global.d.ts                   # .mjs import declarations
├── types.ts                      # re-exports schema/types
├── lib/
│   ├── store.ts                  # immutable node/tree/placement operations
│   ├── geometry.ts               # alignment and distribution
│   ├── history.ts                # undo/redo history
│   ├── draft-storage.ts          # local active-draft autosave
│   ├── drag-intent.mjs           # move versus explicit Option/Alt reparent
│   ├── templates.ts              # 18 localized templates
│   ├── viewport-quality.ts       # rendered viewport quality report types
│   ├── angular-import.ts         # Angular bundle reader, importer, Ollama review
│   ├── personal-templates.ts     # browser-local template persistence/packages
│   ├── project.ts                # browser-safe multi-screen project model + navigation
│   ├── io.ts                     # import/export and AI handoff package
│   ├── workspace-client.ts       # local aub-mcp-http /rpc client for workspace-connected mode
│   └── registry.ts               # read schema/registry/components.json
└── components/
    ├── TopBar.tsx                # import/export buttons + validation status
    ├── ProjectBar.tsx           # multi-screen switcher + navigation editor
    ├── WorkspacePanel.tsx       # workspace connection, direct save, preview, candidate review
    ├── Palette.tsx               # components, templates, and layers
    ├── Canvas.tsx                # freeform/auto viewport artboard
    ├── AngularImportDialog.tsx   # import preview, diagnostics, optional AI review
    ├── WorkflowBar.tsx           # six-stage specification workflow
    ├── BlueprintPanel.tsx        # screen/interaction/responsive/acceptance editor
    └── PropertiesPanel.tsx       # selected-node editor
```

The editor shares the project root's `schema/` and registry — it does not duplicate them. TypeScript path aliases are used in `tsconfig.json` to point at the root types.

## Remaining backlog

- YAML editor
- `.ui.lock.json` generation from the UI (the script does it from CLI)
- Tab/arrow focus traversal across nested layers

## Production build output

```
dist/index.html                          0.40 kB │ gzip:  0.27 kB
dist/assets/index-*.css                 ~31 kB
dist/assets/export-md.lib-*.js           ~9 kB
dist/assets/react-vendor-*.js            split vendor chunk
dist/assets/canvas-tools-*.js            split canvas interaction chunk
dist/assets/jszip.min-*.js               lazy-loaded on package export
```

`html-to-image` and `jszip` are loaded only when exporting an AI handoff package. `export-md.lib-*.js` remains split for caching across releases.

The handoff package format is `aub-handoff` `1.2.0`. Agents start with `AGENT-README.md`; the manifest exposes the same path as `agent_entrypoint`.
