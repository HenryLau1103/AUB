# Schema Versioning Policy

**Phase 1 deliverable** — how the UI Blueprint schema evolves over time, what counts as a breaking change, and what tools consumers can rely on.

## Versioning Scheme

The schema follows **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`).

The version is exposed at three layers, in sync:

1. **JSON Schema `$id`** — the absolute URI embeds the version: `https://github.com/HenryLau1103/AUB/schema/v0.1.0/ui-blueprint.schema.json`
2. **TypeScript package version** — `package.json#version`
3. **Blueprint document** — every `.ui.json` MUST declare its `version` and it MUST match the schema version it was authored against

## Change Classification

### MAJOR (breaking)

A change is MAJOR if it invalidates a previously valid document, or if it makes a previously invalid document valid for a different reason than intended.

Examples:
- Removing a property from any `$defs` definition
- Removing a value from any `enum`
- Tightening a constraint (e.g. `minLength: 0` → `minLength: 1`)
- Making an optional property required
- Changing a property's type (e.g. `string` → `integer`)
- Renaming a field
- Changing the structure of the root document (adding/removing top-level required fields)

Process:
1. Bump `MAJOR`
2. Move the previous major's schema to `schema/archive/v{old}/` (immutable)
3. Update `$id` to the new version
4. Update the "Migrating from v{N-1} to v{N}" section in this file
5. Add migration guide + example diffs

### MINOR (additive, backward-compatible)

A change is MINOR if it adds new optional properties, new enum values, new `$defs`, or new optional top-level fields.

Examples:
- Adding a new optional property to `layout`
- Adding a new value to an existing `enum`
- Adding a new `acceptance.type` or `verification_method` value
- Adding a new `responsive.rule` value
- Adding a new component type to `componentType` enum
- Adding a new optional top-level property (e.g. `theme`)

Process:
1. Bump `MINOR`, reset `PATCH` to 0
2. Update `$id` to the new version
3. Add new properties/values; do not modify existing ones
4. Old schemas MUST still validate documents authored against them

### PATCH (clarification, no behavior change)

A change is PATCH if it does not affect what documents are valid.

Examples:
- Fixing typos in `description` fields
- Improving examples
- Updating `$id` to a more stable URL form (no behavior change)
- Adding new test cases
- Refactoring `$defs` structure (without changing meaning)

Process:
1. Bump `PATCH`
2. No migration needed

## Deprecation Policy

When a property or enum value is scheduled for removal:

1. Mark it `deprecated: true` in the schema description (if JSON Schema Draft 2020-12 tooling supports it; otherwise document in a `deprecated` array in the schema's top-level metadata).
2. Add a notice in the description: `"DEPRECATED since 0.4.0; use X instead. Will be removed in 1.0.0."`
3. Keep the deprecated construct working for at least one MAJOR cycle.
4. Add a migration note to "Migrating from..." section.

## Consumer Compatibility Matrix

| Consumer | Behavior on schema change |
|---|---|
| **Ajv validator** (`scripts/validate.mjs`) | Loads schema by `$id`; old documents validate against old schema, new against new. |
| **TypeScript types** (`schema/types.ts`) | Regenerated on each MINOR. Major bumps require user-side code updates. |
| **Editor** (Phase 2+) | Bumps editor version on each MAJOR. Older `.ui.json` files get an "import as previous version" prompt. |
| **Adapters** (`adapters/codex`, `adapters/claude-code`, etc.) | Each adapter declares the schema versions it supports in its `capability-matrix.md`. Adapters MUST support the current MAJOR and the previous MAJOR for at least 6 months. |

## Migration Guide

### v0.1.0 → v0.2.0 (planned)

The first MINOR bump will likely add:

- New `theme` top-level property (optional, default = system)
- New `responsive.rule` values: `dropdown`, `tabs`, `accordion`
- New component types: `kbd`, `tooltip`, `popover`

No migration required for existing `v0.1.0` documents.

## How to Verify Your Document Matches the Schema

```bash
# Validate a JSON document
pnpm validate examples/dashboard.ui.json

# Validate a YAML document
pnpm validate examples/dashboard.ui.yaml

# Run the full test suite (including illegal-case rejection)
pnpm test

# Type-check the TypeScript types
pnpm typecheck
```

## Decision Checklist for Schema Changes

Before merging a change to `schema/ui-blueprint.schema.json`, answer:

1. [ ] Is this MAJOR, MINOR, or PATCH?
2. [ ] If MAJOR: have I moved the old schema to `schema/archive/`?
3. [ ] If MINOR/MAJOR: have I updated `$id` to the new version?
4. [ ] Have I updated `schema/types.ts` to match?
5. [ ] Have I added/updated test cases in `tests/`?
6. [ ] Have I run `pnpm test` and `pnpm typecheck`?
7. [ ] If MAJOR: have I written a migration guide in this file?
8. [ ] Have I run `pnpm validate` against all examples in `examples/`?
