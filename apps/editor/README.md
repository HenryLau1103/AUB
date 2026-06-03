# AUB Editor

Visual editor for UI Blueprints. Phase 2 prototype.

## What it does

- **Import** a `.ui.json` file (or start from the built-in template)
- **Compose** a screen by clicking components in the palette (left) — they append to the root
- **Inspect** the tree (center) — click a node to select
- **Edit** the selected node's properties (right): id, name, role, type, layout JSON, content JSON
- **Export** to `.ui.json` (download)
- **Export** to `.ui.md` (the agent prompt context, generated programmatically)
- **Live schema validation** — invalid edits show error count in the status bar

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
│   ├── store.ts                  # addNode / deleteNode / updateNode
│   ├── io.ts                     # downloadBlob / readFileAsText
│   └── registry.ts               # read schema/registry/components.json
└── components/
    ├── TopBar.tsx                # import/export buttons + validation status
    ├── Palette.tsx               # 6-category component list
    ├── TreeView.tsx              # recursive node tree
    └── PropertiesPanel.tsx       # selected-node editor
```

The editor shares the project root's `schema/` and registry — it does not duplicate them. TypeScript path aliases are used in `tsconfig.json` to point at the root types.

## Not in v0.1 (v1.1+ backlog)

- Drag-and-drop component addition (currently click-to-add)
- Visual canvas with `tldraw` or `React Flow` (currently a tree view)
- Undo/redo
- Multi-screen projects
- YAML editor
- `.ui.lock.json` generation from the UI (the script does it from CLI)
- Per-node keyboard navigation

## Production build output

```
dist/index.html                          0.40 kB │ gzip:  0.27 kB
dist/assets/index-*.css                  3.31 kB │ gzip:  1.04 kB
dist/assets/export-md.lib-*.js           7.18 kB │ gzip:  2.86 kB
dist/assets/index-*.js                 303.84 kB │ gzip: 94.92 kB
```

The 303 kB main bundle includes React, ajv, and the registry. `export-md.lib-*.js` is the Markdown exporter split out for caching across releases.
