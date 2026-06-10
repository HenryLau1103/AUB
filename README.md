# AUB — UI Blueprint Agent

A structured spec format for AI coding agents. Drag-and-drop a UI canvas, export a `.ui.json` (machine), `.ui.yaml` (human), or `.ui.md` (agent prompt context). Code agents read it. They know what to build, where, and how to verify.

> 繁體中文版：[`README-ZH.MD`](./README-ZH.MD)

## Status

- **Phase 0** — Problem definition, failure cases, success criteria — **done**
- **Phase 1 / Milestone A** — Schema usable — **done** (8/8 Tier 1 criteria pass)
- **Phase 2 / Milestone B** — Editor usable — **done** (freeform/auto layout, drag, resize, multi-select, built-in and personal templates)
- **Phase 3 / Milestone C** — Agent handoff — **done locally** (`.ui.md`, `.aub.zip`, screenshots, hashes, and 22/22 exact extraction with local Qwen 3.6 35B)
- **Milestone D/E foundations** — **done** (Blueprint diff, Codex/Claude Code adapters, implementation report schema and verifier)
- **Blueprint v0.3 import/authoring** — **implemented** (Angular component bundles, source diagnostics, personal templates, and an AI authoring kit)

## Repository layout

```
.
├── schema/
│   ├── ui-blueprint.schema.json    # Draft 2020-12 schema (single source of truth)
│   ├── types.ts                    # hand-synced TypeScript types
│   └── registry/components.json    # 62 semantic component types, 7 categories
├── examples/
│   ├── dashboard.ui.json           # SaaS dashboard: 24 nodes, 6 interactions, 11 acceptance
│   ├── dashboard.ui.yaml           # same, hand-editable
│   ├── dashboard.ui.md             # generated agent context
│   ├── dashboard.ui.lock.json      # frozen acceptance snapshot (hashes)
│   └── freeform-actions.ui.json    # compact freeform/AI-readability fixture
├── scripts/
│   ├── validate.mjs                # CLI: validate .ui.json/.yaml against schema
│   ├── validate-blueprint.lib.mjs  # tree, reference, and geometry semantics
│   ├── migrate-blueprint-cli.mjs   # CLI: migrate v0.1/v0.2 blueprints to v0.3
│   ├── import-angular-component.mjs # CLI: Angular HTML/SCSS/TS → Blueprint v0.3
│   ├── create-authoring-kit.mjs    # CLI: schema + registry + prompt authoring kit
│   ├── export-md.mjs               # CLI: generate .ui.md from .ui.json
│   ├── export-md.lib.mjs           # pure function (browser-safe, used by editor)
│   ├── lock-blueprint.mjs          # CLI: generate .ui.lock.json snapshot
│   ├── score-agent-readability.mjs # deterministic 22-check benchmark scorer
│   └── run-agent-readability.mjs   # explicitly gated external-agent runner
├── benchmarks/agent-readability/  # agent prompt and expected extraction
├── apps/editor/                    # Vite + React + TypeScript visual editor
├── tests/                          # 71 node:test cases
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

# 4. migrate an older blueprint
pnpm migrate old.ui.json migrated.ui.json

# 5. freeze the design as a lock snapshot
node scripts/lock-blueprint.mjs examples/dashboard.ui.json examples/dashboard.ui.lock.json

# 6. run all tests
pnpm test

# 7. type-check (root + editor)
pnpm typecheck
(cd apps/editor && pnpm typecheck)

# 8. score an agent's benchmark answer
pnpm score:agent path/to/agent-output.json

# 9. import an Angular component bundle
pnpm import:angular path/to/component-directory --entry app-example --output example.ui.json

# 10. create a kit that teaches an AI to author AUB files
pnpm authoring:kit aub-authoring-kit.zip

# 11. start the editor
(cd apps/editor && pnpm dev)
# → open http://127.0.0.1:5173/
```

## Design principles (from `ui-blueprint-agent-plan.md`)

1. **Semantic > visual** — every node carries a registered `type` (`data_table`, `metric_card`, …), not just a rectangle.
2. **Layout = explicit contract** — auto containers use flex/grid; freeform containers use per-viewport placements. Agents must preserve the declared mode.
3. **Blueprint is source of truth** — editor state derives from `.ui.json`. Round-trip (export → import) is lossless.
4. **Acceptance is a checklist, not a vibe** — every screen has ≥5 verifiable items spanning layout, interaction, responsive, a11y.
5. **One schema, many agents** — core format is agent-neutral. Per-agent differences live in thin adapters (Phase 4+).
6. **No vibes-based approval** — schema validation, layout diff, and acceptance checklist are the only review signals.

Direct placement in the editor is an explicit freeform action. Normal handle dragging keeps a node in its current parent; hold Option/Alt while dragging over another container to reparent it. When a palette drop targets an auto-layout container, the editor preserves the rendered child geometry before switching that container to freeform.

## Agent readability benchmark

Give `benchmarks/agent-readability/prompt.md` and `examples/freeform-actions.ui.json` to an agent, save its JSON-only answer, then run:

```bash
pnpm score:agent path/to/agent-output.json
```

The scorer compares 22 exact facts covering hierarchy, freeform geometry, layout mode, design tokens, interactions, and acceptance criteria.

See `benchmarks/agent-readability/README.md` for the explicitly gated Codex/other-CLI runner. It will not invoke an external agent unless `--allow-external` is present.

## Agent implementation benchmark

The implementation benchmark asks an agent to generate a working standalone UI and implementation report, then uses local Chrome to verify exact desktop/tablet/mobile geometry, hierarchy, auto layout, interactions, focus states, responsive overflow, computed styles, screenshots, and report completeness.

```bash
pnpm benchmark:implementation qwen-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

See `benchmarks/agent-implementation/README.md`. The deterministic reference implementation passes every check; the latest local `qwen3.6:35b` result passes 420/420 checks after prompt-contract refinement.

## Agent tasks and Blueprint diffs

Generate an authoring, implementation, planning, or review task for a supported agent:

```bash
pnpm prompt examples/dashboard.ui.json dashboard.codex.md --adapter codex --task implement
pnpm prompt examples/dashboard.ui.json author.codex.md --adapter codex --task author
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json - --task review
```

Compare two Blueprint revisions and list changed node ids and exact fields:

```bash
pnpm diff before.ui.json after.ui.json
pnpm diff before.ui.json after.ui.json --json
```

See `docs/agent-adapter-interface.md` and `docs/capability-matrix.md`.

Create and verify the machine-readable implementation report returned by an agent:

```bash
pnpm report:init examples/dashboard.ui.json implementation-report.json
pnpm report:verify examples/dashboard.ui.json implementation-report.json
```

## Failure modes this design prevents

See `docs/failure-cases.md` for the 5 concrete cases. Short version: "match the Figma", "make it responsive like Notion", "add a settings page", "clean sidebar", and "build a dashboard like Stripe" all fail with prose alone. The Blueprint format forces explicit decisions on every dimension.

## Schema versioning

See `docs/schema-versioning.md`. SemVer 2.0.0. `$id` carries the version. Old major versions are immutable under `schema/archive/`.

## Contributing

Before opening a PR:
1. `pnpm test` — all tests pass
2. `pnpm typecheck` and `(cd apps/editor && pnpm typecheck)` — both clean
3. `(cd apps/editor && pnpm build)` — production build succeeds
4. If you changed the schema, run `pnpm validate examples/dashboard.ui.json` to confirm the example still passes
5. Atomic commits in `chore:` / `feat:` / `fix:` / `docs:` / `test:` style, zh-TW body
