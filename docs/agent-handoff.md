# AUB Agent Handoff Guide

This guide is for coding agents that receive an AUB UI Blueprint or an `.aub.zip` handoff package.

> 繁體中文版：[`agent-handoff.zh-Hant.md`](./agent-handoff.zh-Hant.md)

## Explain AUB to the user

AUB is a visual UI contract between a person and a coding agent. The user arranges a screen in the AUB editor, then exports structured layout, component semantics, interactions, responsive behavior, screenshots, and verifiable acceptance criteria.

In your first response:

1. Reply in the user's language.
2. Explain that AUB describes what the interface must do and how it will be verified.
3. List the AUB files and supporting evidence you found.
4. State whether you will author, plan, implement, or review.
5. Identify unresolved product decisions. Ask only when the repository and supplied evidence cannot resolve them.

## Recognize the inputs

An AUB handoff package can contain:

| File | Purpose | Authority |
|---|---|---|
| `*.ui.json` | Complete machine-readable UI contract | **Source of truth** |
| `*.ui.md` | Human- and agent-readable rendering of the Blueprint | Derived reference |
| `screenshots/*.png` | Visual evidence for each viewport | Supporting reference |
| `*.agent.md` | Agent-neutral task prompt | Execution instructions |
| `*.codex.md` | Codex-specific task prompt | Execution instructions |
| `implementation-report.template.json` | Required node and acceptance report | Completion contract |
| `implementation-report.schema.json` | Schema for the completed report | Validation contract |
| `manifest.json` | Package metadata, hashes, and entrypoint | Integrity metadata |

If files conflict, follow this precedence:

1. Valid `*.ui.json`
2. Explicit repository constraints
3. Acceptance criteria and responsive rules in the Blueprint
4. Generated `*.ui.md`
5. Screenshots
6. Prose outside the package

Do not silently resolve a conflict. Explain it and propose a concrete resolution.

## Choose the task

- **Author**: Convert product requirements or an existing screen into one schema-valid Blueprint.
- **Plan**: Map Blueprint nodes and acceptance ids to the target repository without editing files.
- **Implement**: Change the target repository until the Blueprint and every acceptance item are satisfied.
- **Review**: Compare an existing implementation with the Blueprint and report mismatches by severity.

## Required workflow

1. Read the target repository's instructions, including applicable `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`.
2. Inspect existing routes, components, design tokens, dependencies, tests, and implementation patterns.
3. Validate the Blueprint before relying on it.
4. Map every Blueprint node id to an existing or new implementation component.
5. Preserve hierarchy, semantic component type, layout mode, viewport geometry, interactions, responsive rules, states, and constraints.
6. Use repository-native components and tokens when they satisfy the contract.
7. Run checks that cover every changed surface.
8. Complete the implementation report with a file mapping and evidence for every acceptance id.

## Non-negotiable rules

- Treat `*.ui.json` as the source of truth. Markdown and screenshots do not override it.
- Do not redesign the screen, weaken acceptance criteria, or replace declared behavior with a preferred pattern.
- Do not invent missing product behavior. Record uncertainty and ask the user when it materially affects the result.
- Do not change `auto` layout to `freeform`, or the reverse, unless the Blueprint or an approved conflict resolution requires it.
- Preserve accessible names, focus behavior, minimum target sizes, and responsive overflow constraints.
- Report blockers explicitly. Partial completion must not be presented as complete.

## Completion response

Reply in the user's language and include:

1. What was implemented or reviewed.
2. Files changed or inspected.
3. Validation commands and exact results.
4. Every acceptance id with `pass`, `fail`, or `needs-review` and concrete evidence.
5. Unresolved decisions, conflicts, or blockers.
6. The completed `implementation-report.json` when the task is implementation or review.

An implementation is complete only when the report maps every node, every required acceptance item passes with evidence, and no unresolved blocker remains.
