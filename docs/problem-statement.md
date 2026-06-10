# Problem Statement — AUB (UI Blueprint Agent)

**Phase 0 deliverable** — defines the core problem, scope, and design intent. Companion to `failure-cases.md` and `mvp-success-criteria.md`.

---

## 1. The Problem

In **vibe coding** workflows (humans + AI coding agents like Codex, Claude Code, Cursor, Gemini CLI), users describe UI intent in prose. The agent then has to *guess* layout, structure, and behavior from text. This breaks in three predictable ways:

1. **Ambiguity in the description itself** — "make a dashboard like Stripe" is not actionable.
2. **Loss of design intent in the round-trip** — even precise prose gets compressed/expanded by the LLM.
3. **No verifiable acceptance signal** — once code is produced, there is no machine-checkable contract to compare against the original intent. Review becomes subjective.

The root cause is not the LLM. It is that **the input is the wrong shape**: free-form text is a lossy serialization of UI intent. We need a structured, lossless, agent-readable format — and a tool that produces it without requiring the user to write prose.

## 2. The Solution (in one sentence)

A drag-and-drop canvas that emits a **structured UI Blueprint** (`.ui.json` / `.ui.yaml` / `.ui.md`) describing layout, components, interactions, responsive rules, and acceptance criteria — in a form that any coding agent can read, diff against existing code, and use to verify its own output.

## 3. Core Design Principles

| # | Principle | Why |
|---|-----------|-----|
| P1 | **Semantic > visual** | Agents must know *what* a node is (`data_table`, `metric_card`), not just *where* it is. |
| P2 | **Layout = explicit contract** | Use flex/grid for auto flow and per-viewport placements for intentionally freeform composition. |
| P3 | **Blueprint is the source of truth** | Editor state derives from `.ui.json`. Round-trip (export → import) must be lossless. |
| P4 | **Acceptance is a checklist, not a vibe** | Every screen has ≥5 verifiable items spanning layout, interaction, responsive, a11y. |
| P5 | **One schema, many agents** | The core format is agent-neutral. Per-agent differences live in thin adapters. |
| P6 | **No vibes-based approval** | Schema validation, layout diff, and acceptance checklist are the only review signals. |

## 4. In Scope (Phase 0–2 MVP)

- Visual drag-and-drop editor for screen composition
- Exporter to `.ui.json` (machine), `.ui.yaml` (human-edit), `.ui.md` (agent context)
- Importer that restores canvas from `.ui.json` (round-trip)
- Schema validation (build-time + runtime)
- Acceptance checklist rendering
- Component registry v0.2 (62 semantic types, 7 categories)
- 5 example screens: dashboard, mobile form flow, SaaS settings, marketing landing, CRUD admin table

## 5. Out of Scope (Explicit Non-Goals)

- ❌ Figma replacement / pixel-perfect design tool
- ❌ Free-form vector drawing
- ❌ LLM inference of semantics from images / screenshots
- ❌ Visual screenshot diffing in v1
- ❌ Multi-user realtime collaboration
- ❌ Plugin marketplace / custom component SDK
- ❌ Cloud sync / accounts
- ❌ AI auto-layout (agents only implement what the spec says)

## 6. The User's Workflow (Target)

```
1. Open editor, pick screen type (dashboard / form / landing / settings / admin table)
2. Drag semantic components from registry (sidebar, table, metric_card, ...)
3. Set layout (flex direction, gap, padding, breakpoints)
4. Set content (text, data binding, columns)
5. Set interactions (click → action → result)
6. Set responsive rules (mobile: sidebar → drawer; table → card list)
7. Write acceptance criteria (≥5 verifiable items)
8. Export .ui.json (machine) / .ui.yaml (human) / .ui.md (agent prompt)
9. Hand to coding agent → agent implements → agent reviews against .ui.md
```

## 7. The Agent's Workflow (Target)

```
1. Read .ui.json (or .ui.md for context-window budget)
2. Produce implementation plan from acceptance items
3. Implement frontend code matching layout + components
4. Run schema validation on any layout decisions (must not violate)
5. Render local preview
6. Compare implementation vs. acceptance checklist
7. Output pass/fail per item (not "looks good")
```

## 8. Success Means...

- A non-engineer product owner can produce a `dashboard.ui.json` without writing prose
- Codex reads it, lists the screen structure correctly, and proposes a sensible React component tree
- The same `.ui.json` works for Claude Code and Cursor via thin adapters
- Acceptance checklist output can be pasted into a PR review

See `mvp-success-criteria.md` for measurable targets and `failure-cases.md` for the 5 concrete failure modes this design must prevent.

## 9. References

- `ui-blueprint-agent-plan.md` (canonical plan, internal)
- `failure-cases.md` — 5 concrete vibe-coding failure modes
- `mvp-success-criteria.md` — measurable MVP targets
- `schema-versioning.md` (Phase 1) — schema evolution policy
