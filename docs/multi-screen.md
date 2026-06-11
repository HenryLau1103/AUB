# Multi-screen projects

A single `.ui.json` Blueprint describes **one screen**. Real products are made of
several screens linked by navigation. AUB composes screens into a **project**
without changing the single-screen format: a project is a thin, reference-based
document that points at existing Blueprint files.

## Why reference-based

- **Single-screen files stay the source of truth.** Every member `.ui.json`
  remains a fully valid, standalone Blueprint you can validate, export, lock, and
  hand off on its own.
- **No format fork.** The Blueprint schema (`ui-blueprint.schema.json`) is
  unchanged and still at `0.3.0`. The project document is a *separate* schema on
  its own version track, starting at `0.1.0`.
- **Composable.** Screens can belong to more than one project, and a project can
  grow or shrink by editing a small index file.

## The project document

A project file is named `*.aub.project.json` and validates against
[`schema/ui-project.schema.json`](../schema/ui-project.schema.json):

```json
{
  "$schema": "../../schema/ui-project.schema.json",
  "version": "0.1.0",
  "id": "acme-app",
  "name": "Acme App",
  "description": "Two screens linked by navigation.",
  "screens": [
    { "id": "acme.dashboard", "name": "Dashboard", "path": "dashboard.ui.json" },
    { "id": "acme.settings", "name": "Settings", "path": "settings.ui.json" }
  ],
  "entry_screen": "acme.dashboard",
  "navigation": [
    { "from": "acme.dashboard", "to": "acme.settings", "trigger": "click", "label": "Open settings" },
    { "from": "acme.settings", "to": "acme.dashboard", "trigger": "click", "label": "Back to dashboard" }
  ],
  "design_system": { "name": "Acme Tokens" }
}
```

| Field | Meaning |
|---|---|
| `screens[]` | Member screens. Each `path` is **relative to the project file** and points at a `.ui.json`/`.ui.yaml`. Each `id` MUST match the referenced Blueprint's `screen.id`. |
| `entry_screen` | The screen the flow starts on. Must be a declared screen id. |
| `navigation[]` | Directed edges `{ from, to, trigger?, interaction_id?, label? }`. `from`/`to` must be declared screen ids. `trigger` ∈ `click` / `submit` / `change` / `load` / `system` / `gesture`. `interaction_id` optionally links the edge to the source screen's interaction. |
| `design_system` | Optional project-level shared tokens. A member screen's own `design_system` overrides these (shallow merge, screen wins). |

A canonical example lives in [`examples/project/`](../examples/project/).

## Validation rules

Beyond JSON Schema, project validation enforces:

- Unique screen `id`s and unique `path`s.
- `entry_screen` references a declared screen.
- Every `navigation` edge's `from`/`to` references a declared screen, with a known `trigger`.
- Each member `path` resolves to a readable Blueprint whose `screen.id` matches the declared `id`.
- **Every member screen** independently passes Blueprint schema + semantic validation.

A project is valid only when the project document, the project-level semantics,
and all member screens are valid.

## CLI

```bash
# Validate a project (schema + project semantics + every member screen)
pnpm project validate examples/project/app.aub.project.json
# (pnpm validate also auto-detects *.aub.project.json and routes here)
pnpm validate examples/project/app.aub.project.json

# Wrap existing single-screen Blueprints into a new project (entry = first)
pnpm project init app.aub.project.json dashboard.ui.json settings.ui.json

# Emit a project overview .md plus per-screen .ui.md agent context
pnpm project export-md examples/project/app.aub.project.json ./out
```

## MCP tools

Agents over the MCP server can address projects directly:

| Tool | Purpose |
|---|---|
| `list_projects` | List every `*.aub.project.json` in the workspace with id, name, screen count. |
| `get_project` | Resolve a project; with `inlineScreens: true` it returns each member's full Blueprint and merged design system. |
| `validate_project` | Validate the project document, project semantics, and every member screen. |

## Editor

The visual editor can open a project (select the `*.aub.project.json` together
with its member `.ui.json` files), shows a **project bar** with a tab per screen,
and lets you switch screens, add / remove / rename screens, set the entry screen,
and edit the navigation graph. Saving downloads a `.zip` containing the project
document and every member screen file. With no project loaded, the editor behaves
exactly as before (single-screen editing).

## Versioning

The project schema has its own SemVer track (`0.1.0`), independent of the
Blueprint schema. See [schema versioning](./schema-versioning.md).
