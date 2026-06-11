# Custom component types

AUB ships a curated registry of 62 core semantic component types
(`schema/registry/components.json`). Core types are intentionally closed: rule #1
("each node must use a registered component `type`") and rule #5 ("agents must not
guess") depend on every type having an agreed, resolvable meaning.

Real products still need components the core registry does not model — a branded
`insight_card`, a bespoke `metric_sparkline`, a domain widget. **Extension component
types** let a project declare those without forking core and without weakening the
"never guess" guarantee. They can also point coding agents at the production component
that already implements the design-system behavior.

## How it works

1. A project declares its custom types in an `aub.registry.json` file at the project
   root.
2. Each custom type uses a **namespace**: `team:component` (a colon-separated owner
   and snake_case name), e.g. `acme:insight_card`. Core types stay bare snake_case,
   so the two can never collide.
3. Blueprints reference extension types in `node.type` exactly like core types.
4. Validation resolves extension types against `aub.registry.json` — auto-discovered
   from the blueprint's directory upward, or passed explicitly with `--registry`.
5. When a handoff package is produced with extensions, `aub.registry.json` is bundled
   into the `.aub.zip` so the receiving agent can **resolve** every custom type.
6. Optional `implementations` map the type to framework modules, exports, source files,
   Storybook stories, documentation, and Blueprint-to-prop paths.

Extension types are **additive** and MINOR-compatible (see
[schema versioning](./schema-versioning.md)). They never change core semantics.

## The `aub.registry.json` file

```json
{
  "$schema": "https://henrylau1103.github.io/AUB/schema/aub.registry.schema.json",
  "version": "0.1.0",
  "description": "Acme custom components.",
  "components": [
    {
      "name": "acme:metric_sparkline",
      "isContainer": false,
      "description": "Compact inline trend chart for a single KPI. Leaf node."
    },
    {
      "name": "acme:insight_card",
      "isContainer": true,
      "description": "Branded card framing an analytics insight. Container.",
      "implementations": [
        {
          "id": "react",
          "framework": "react",
          "module": "@acme/analytics-ui",
          "export": "InsightCard",
          "importStyle": "named",
          "sourcePath": "packages/analytics-ui/src/InsightCard.tsx",
          "storybookUrl": "https://storybook.example.com/?path=/story/insight-card--default",
          "props": {
            "title": {
              "from": "content.title",
              "required": true
            }
          },
          "notes": "Preserve the built-in focus treatment."
        }
      ]
    }
  ]
}
```

Each entry requires:

| Field | Rules |
|---|---|
| `name` | Must match `^[a-z][a-z0-9]*:[a-z][a-z0-9_]*$` (`team:component`). Must not collide with a core type. Must be unique within the file. |
| `isContainer` | Boolean. `true` if the component may declare `children`; `false` for a leaf. |
| `description` | Optional but strongly recommended — this is what the agent reads to understand the component. |
| `implementations` | Optional production mappings. Each mapping requires a stable `id`, `framework`, and package/module specifier. |

## Production implementation mapping

An implementation mapping is a reuse instruction, not generated code:

| Field | Meaning |
|---|---|
| `id` | Stable selector such as `react`, `angular`, or `web-component`. |
| `framework` | Runtime family: React, Vue, Angular, Svelte, Web Component, HTML, or other. |
| `module` | Import specifier or package name used by the target repository. |
| `export` | Exported symbol when the module uses named or default exports. |
| `importStyle` | `named`, `default`, `namespace`, `side-effect`, or `custom-element`. |
| `sourcePath` | Optional repository-relative path for code navigation. |
| `storybookUrl` / `docsUrl` | Optional authoritative usage references. |
| `props` | Maps production prop names to Blueprint paths such as `content.title`. |
| `notes` | Constraints the agent must preserve. |

Use the MCP server to resolve a mapping:

```text
resolve_component {
  "type": "acme:insight_card",
  "registry": "aub.registry.json",
  "implementation": "react"
}
```

If a matching production implementation is declared, agents should reuse it instead of
creating a visually similar replacement.

A working example lives in
[`examples/extensions/`](../examples/extensions/): an `aub.registry.json` plus
`analytics-insights.ui.json`, a blueprint that uses `acme:insight_card` and
`acme:metric_sparkline`.

## Validation

```bash
# Auto-discover aub.registry.json from the file's directory upward
pnpm validate examples/extensions/analytics-insights.ui.json

# Or point at a specific registry
pnpm validate path/to/screen.ui.json --registry ./aub.registry.json
```

Two layers run:

- **JSON Schema** accepts any `node.type` that is either a core type or matches the
  `team:component` pattern. It does not know your specific names — it only checks the
  shape.
- **Semantic validation** resolves each namespaced type against the registry. It
  reports:
  - `unknown component type "team:x" — declare it in aub.registry.json` when a
    namespaced type is not registered.
  - a leaf/container violation when an extension type marked `isContainer: false`
    declares `children`.

Core container/leaf rules stay enforced by the schema; extension container/leaf rules
are enforced semantically from the registry's `isContainer` flag.

The MCP `validate_blueprint` tool accepts an optional `registry` argument and otherwise
auto-discovers `aub.registry.json` from the workspace root.

## Handoff

When you generate a `.aub.zip` and provide the project registry, the package includes
`aub.registry.json` and the manifest records `extension_registry: "aub.registry.json"`.
`AGENT-README.md` gains a "Custom component types" note instructing the agent to treat
any colon-bearing `node.type` as a project component and to resolve it from the bundled
registry — never to guess. The note also requires matching production implementations and
prop mappings to be reused.

## Limitations

- Extension types are **project-scoped**, not global. A blueprint that uses them is
  only fully resolvable alongside its `aub.registry.json`.
- The visual editor authors **core** types only. Extension types and production mappings are a
  validation/handoff concern; hand-edit them in `.ui.json`/`.ui.yaml`.
- Extensions cannot redefine or shadow core types — names are checked for collision.
- "Registered" now means **core OR a declared project extension** — it never means a
  free-typed string. Rules #1 and #5 still hold.
