# MVP Success Criteria

**Phase 0 deliverable** — measurable targets for the first shippable version. Each criterion is observable, binary (pass / fail), and tied to a specific artifact or behavior.

A criterion is **measured**, not "should be" or "ideally". If we cannot observe it in CI, in a manual test, or in a user session, it does not belong in this document.

---

## Tier 0 — Project Bootstrap (gates Phase 0 → Phase 1)

| # | Criterion | How to measure | Pass condition |
|---|-----------|----------------|----------------|
| B1 | Problem statement exists | `docs/problem-statement.md` present, references `failure-cases.md` | File present, links resolve |
| B2 | Five failure cases analyzed | `docs/failure-cases.md` present | Exactly 5 cases, each with prompt + output + failure modes + Blueprint fix |
| B3 | MVP success criteria defined | This document | ≥6 measurable criteria, no subjective language |
| B4 | Plan includes scope boundaries | Reference to `ui-blueprint-agent-plan.md` §3 (non-goals) | Non-goals list present, no Figma-replacement items added |

**Gate**: All four pass before Phase 1 begins.

---

## Tier 1 — Schema Usable (Milestone A)

This is the Phase 1 exit gate from the canonical plan §14. Each criterion is verifiable in CI.

| # | Criterion | How to measure | Pass condition |
|---|-----------|----------------|----------------|
| S1 | JSON Schema validates legal example | `ajv validate -s schema/ui-blueprint.schema.json -d examples/dashboard.ui.json` | Exit 0, no errors |
| S2 | JSON Schema rejects malformed example | `ajv validate` on `examples/dashboard.ui.json` with one field deleted | Non-zero exit, error references deleted field path |
| S3 | TypeScript types compile cleanly | `tsc --noEmit schema/types.ts` | Exit 0, no errors |
| S4 | TypeScript types match JSON Schema | Generated types used to type-check `examples/dashboard.ui.json` | No `as any` casts, no `// @ts-expect-error`, no type errors |
| S5 | YAML example is schema-valid | YAML→JSON, validate against schema | Exit 0 |
| S6 | Markdown example describes a dashboard | Manual review: human identifies screen, layout, components, interactions, acceptance items | Reviewer can list 5+ components, 3+ interactions, 5+ acceptance items without reading code |
| S7 | Versioning policy exists | `docs/schema-versioning.md` present | Defines SemVer rules, breaking-change policy, deprecation window |
| S8 | Component registry has ≥30 types | `schema/registry/components.json` | Count of unique `type` values ≥ 30 across 7 categories (Layout/Visual/Data/Form/Action/Feedback/Nav) |

**Gate**: All eight pass before Milestone A is declared.

---

## Tier 2 — Editor Usable (Milestone B)

| # | Criterion | How to measure | Pass condition |
|---|-----------|----------------|----------------|
| E1 | Editor loads in browser | `pnpm dev` → open `localhost:5173` | Page renders within 3s, no console errors |
| E2 | User can add a screen | Click "New Screen" | New screen appears in tree view |
| E3 | User can drag a component from registry | Drag `metric_card` from palette to canvas | Component appears at drop location, registered type set |
| E4 | User can edit component properties | Click node → property panel populates | All editable fields from schema render |
| E5 | User can export `.ui.json` | Click "Export JSON" | File downloads, validates against schema (S1) |
| E6 | User can export `.ui.md` | Click "Export Markdown" | Markdown contains: screen summary, component hierarchy, interactions, acceptance checklist, agent task |
| E7 | User can import `.ui.json` | Drop `examples/dashboard.ui.json` into editor | Canvas state matches original Blueprint, round-trip is lossless |
| E8 | Schema validation errors surface | Edit a Blueprint to remove required field | Red error indicator, message references field path |
| E9 | Dashboard example is reproducible | New project → drag components per `examples/dashboard.ui.md` | Exported `.ui.json` is semantically equivalent to `examples/dashboard.ui.json` |

**Gate**: All nine pass before Milestone B is declared.

---

## Tier 3 — Agent-Readable (Milestone C)

| # | Criterion | How to measure | Pass condition |
|---|-----------|----------------|----------------|
| A1 | `.ui.md` is sufficient prompt context | Paste `.ui.md` into a fresh Claude Code session | Agent lists screen structure with ≥80% accuracy vs. ground truth |
| A2 | Agent produces implementation plan | Same prompt, ask for plan | Plan includes 5+ actionable steps, each tied to a Blueprint node |
| A3 | Agent flags layout violations | Provide agent with a wrong implementation | Agent identifies ≥3 of 5 planted violations (wrong sidebar width, missing drawer, etc.) |
| A4 | Acceptance checklist is review-ready | Render `examples/dashboard.ui.json` → checklist | Each item has binary pass/fail, no subjective language, ≥5 items per screen |
| A5 | Same Blueprint works in different agents | Run `examples/dashboard.ui.json` through Codex and Cursor adapters | Both produce structurally consistent implementation plans |

**Gate**: All five pass before Milestone C is declared.

---

## Tier 4 — Reviewable (Milestone D)

| # | Criterion | How to measure | Pass condition |
|---|-----------|----------------|----------------|
| R1 | `cli/validate-blueprint` exists | `pnpm validate examples/dashboard.ui.json` | Exit 0, prints "✓ valid" |
| R2 | CLI exits non-zero on invalid input | `pnpm validate examples/malformed.ui.json` | Non-zero exit, error message references failing field |
| R3 | `cli/render-acceptance` produces checklist | `pnpm acceptance examples/dashboard.ui.json` | Markdown output with one `- [ ]` per acceptance item |
| R4 | Layout diff is computable | Run `diff` on two Blueprint revisions | Human can identify the 3 changed nodes from CLI output |
| R5 | Acceptance report template used | `docs/acceptance-report-template.md` | Includes sections: Status / Scope / Pass / Blocker / Must-fix / Should-fix / Evidence / Next |

**Gate**: All five pass before Milestone D is declared.

---

## Tier 5 — Portable (Milestone E)

| # | Criterion | How to measure | Pass condition |
|---|-----------|----------------|----------------|
| P1 | Adapter interface documented | `docs/agent-adapter-interface.md` | Defines input (Blueprint), output (prompt context), commands |
| P2 | Codex adapter implemented | `adapters/codex/` with runnable script | Adapter reads Blueprint, outputs valid prompt |
| P3 | Claude Code adapter implemented | `adapters/claude-code/` | Same: reads Blueprint, outputs valid prompt |
| P4 | Capability matrix exists | `docs/capability-matrix.md` | Lists which features each adapter supports |
| P5 | Core schema unchanged across adapters | `schema/ui-blueprint.schema.json` referenced by all adapters | No adapter-specific schema forks in version control |

**Gate**: All five pass before Milestone E is declared.

---

## Anti-Criteria (these DO NOT count as success)

- "Looks beautiful" — subjective, unmeasurable
- "Easy to use" — vague, requires context
- "Feels like Figma" — explicit non-goal per plan §3
- "Works with my favorite framework" — adapter must be added explicitly, not assumed
- "AI auto-generates the layout" — explicit non-goal per plan §3
- "Pixel-perfect rendering" — explicit non-goal per plan §3

## Definition of Done for v1

When **Tier 0 + Tier 1 + Tier 2 + Tier 3** all pass, v1 ships. Tier 4 and Tier 5 are post-v1 hardening (Phase 6 and Phase 7 in the canonical plan).
