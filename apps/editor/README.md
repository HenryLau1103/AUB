# AUB Editor

Visual editor for UI Blueprints. Phase 2 prototype.

## What it does

- **Import** a `.ui.json` file (or start from the built-in template)
- **Start from templates** for dashboard app shell, product landing page, or settings form examples
- **Compose** a screen by dragging components from the palette into the artboard, or by clicking to append to the selected container
- **Preview** the screen as a desktop/tablet/mobile UI mockup instead of a graph-only structure view
- **Inspect** the hierarchy by selecting elements directly on the artboard
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
    ├── Canvas.tsx                # viewport artboard + nested component preview
    └── PropertiesPanel.tsx       # selected-node editor
```

The editor shares the project root's `schema/` and registry — it does not duplicate them. TypeScript path aliases are used in `tsconfig.json` to point at the root types.

## Not in v0.1 (v1.1+ backlog)

- Undo/redo
- Multi-screen projects
- YAML editor
- `.ui.lock.json` generation from the UI (the script does it from CLI)
- Per-node keyboard navigation

## Production build output

```
dist/index.html                          0.40 kB │ gzip:  0.27 kB
dist/assets/index-*.css                 20.42 kB │ gzip:  4.62 kB
dist/assets/export-md.lib-*.js           7.18 kB │ gzip:  2.86 kB
dist/assets/index-*.js                 357.20 kB │ gzip: 112.14 kB
```

The 357 kB main bundle includes React, ajv, templates, and the registry. `export-md.lib-*.js` is the Markdown exporter split out for caching across releases.
