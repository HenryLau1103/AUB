# AUB — UI Blueprint Agent

A structured spec format for AI coding agents. Drag-and-drop a UI canvas, export a `.ui.json` (machine), `.ui.yaml` (human), or `.ui.md` (agent prompt context). Code agents read it. They know what to build, where, and how to verify.

> 繁體中文版：[`README-ZH.MD`](./README-ZH.MD)

## Status

- **Phase 0** — Problem definition, failure cases, success criteria — **done**
- **Phase 1 / Milestone A** — Schema usable — **done** (8/8 Tier 1 criteria pass)
- **Phase 2 / Milestone B** — Editor usable — **done** (prototype, click-to-add; drag-and-drop in v1.1)
- **Phase 3+** — Markdown + agent-context exporters, Codex adapter, frontend bridge, review CLI — backlog

## Repository layout

```
.
├── schema/
│   ├── ui-blueprint.schema.json    # Draft 2020-12 schema (single source of truth)
│   ├── types.ts                    # hand-synced TypeScript types
│   └── registry/components.json    # 45 semantic component types, 6 categories
├── examples/
│   ├── dashboard.ui.json           # SaaS dashboard: 24 nodes, 6 interactions, 11 acceptance
│   ├── dashboard.ui.yaml           # same, hand-editable
│   ├── dashboard.ui.md             # generated agent context
│   └── dashboard.ui.lock.json      # frozen acceptance snapshot (hashes)
├── scripts/
│   ├── validate.mjs                # CLI: validate .ui.json/.yaml against schema
│   ├── export-md.mjs               # CLI: generate .ui.md from .ui.json
│   ├── export-md.lib.mjs           # pure function (browser-safe, used by editor)
│   └── lock-blueprint.mjs          # CLI: generate .ui.lock.json snapshot
├── apps/editor/                    # Vite + React + TypeScript visual editor
├── tests/                          # 37 node:test cases across 4 files
└── docs/
    ├── problem-statement.md
    ├── failure-cases.md
    ├── mvp-success-criteria.md
    └── schema-versioning.md
```

## Quick start

```bash
# 1. install deps (root + editor)
pnpm install
cd apps/editor && pnpm install && cd ../..

# 2. validate the example
pnpm validate examples/dashboard.ui.json

# 3. regenerate the markdown
node scripts/export-md.mjs examples/dashboard.ui.json examples/dashboard.ui.md

# 4. freeze the design as a lock snapshot
node scripts/lock-blueprint.mjs examples/dashboard.ui.json examples/dashboard.ui.lock.json

# 5. run all tests
node --test tests/*.test.mjs

# 6. type-check (root + editor)
pnpm typecheck
(cd apps/editor && pnpm typecheck)

# 7. start the editor
(cd apps/editor && pnpm dev)
# → open http://127.0.0.1:5173/
```

## Design principles (from `ui-blueprint-agent-plan.md`)

1. **Semantic > visual** — every node carries a registered `type` (`data_table`, `metric_card`, …), not just a rectangle.
2. **Layout = contract, not pixels** — flex/grid rules only. Absolute coordinates are forbidden by the schema.
3. **Blueprint is source of truth** — editor state derives from `.ui.json`. Round-trip (export → import) is lossless.
4. **Acceptance is a checklist, not a vibe** — every screen has ≥5 verifiable items spanning layout, interaction, responsive, a11y.
5. **One schema, many agents** — core format is agent-neutral. Per-agent differences live in thin adapters (Phase 4+).
6. **No vibes-based approval** — schema validation, layout diff, and acceptance checklist are the only review signals.

## Failure modes this design prevents

See `docs/failure-cases.md` for the 5 concrete cases. Short version: "match the Figma", "make it responsive like Notion", "add a settings page", "clean sidebar", and "build a dashboard like Stripe" all fail with prose alone. The Blueprint format forces explicit decisions on every dimension.

## Schema versioning

See `docs/schema-versioning.md`. SemVer 2.0.0. `$id` carries the version. Old major versions are immutable under `schema/archive/`.

## Contributing

Before opening a PR:
1. `node --test tests/*.test.mjs` — all 37 tests pass
2. `pnpm typecheck` and `(cd apps/editor && pnpm typecheck)` — both clean
3. `(cd apps/editor && pnpm build)` — production build succeeds
4. If you changed the schema, run `pnpm validate examples/dashboard.ui.json` to confirm the example still passes
5. Atomic commits in `chore:` / `feat:` / `fix:` / `docs:` / `test:` style, zh-TW body
