# Figma and Penpot Design Bridge

AUB's Design Bridge moves design intent from Figma or Penpot into a validated
UI Blueprint without asking an importer to guess semantic component types.

The producer can be a design-tool plugin, an MCP agent with access to the design
document, or a custom exporter. It emits one `*.aub.bridge.json` document that
contains:

- source document, page, and frame identifiers;
- one complete, schema-valid AUB Blueprint;
- an exact `node_map` from every Blueprint node id to its design-tool node id;
- optional source component keys for production-component resolution.

The bridge schema is [`schema/design-bridge.schema.json`](../schema/design-bridge.schema.json).
A worked Figma-shaped example is in
[`examples/design-bridge/figma-hero.aub.bridge.json`](../examples/design-bridge/figma-hero.aub.bridge.json).
The same envelope accepts `source.kind: "penpot"`.

## Import with the CLI

```bash
pnpm import:design -- \
  examples/design-bridge/figma-hero.aub.bridge.json \
  --output marketing-hero.ui.json

pnpm validate marketing-hero.ui.json
```

Use `--registry ./aub.registry.json` when the embedded Blueprint contains
namespaced custom component types.

## Import through MCP

Call `import_design_bridge` with either a workspace-relative `path` or an inline
`bridge` object. The tool validates the bridge schema, imports source references
and provenance, then validates the resulting Blueprint against the AUB schema,
semantic rules, and optional component registry.

Use `write_blueprint` separately to persist the returned Blueprint. This split
keeps design import read-only unless an agent explicitly requests a workspace
write.

## Producer requirements

1. Assign an AUB `type`, role, hierarchy, layout, content, interactions,
   responsive rules, and acceptance criteria before export.
2. Map every Blueprint node id exactly once in `node_map`.
3. Use an `aub.registry.json` production mapping for custom design-system
   components.
4. Record uncertainty in `screen.notes`; do not convert ambiguous layer names
   into invented behavior.
5. Keep the design URL or stable design identifiers so reviewers can trace each
   implementation node back to its source.

AUB deliberately does not parse arbitrary design rectangles into guessed UI
semantics. Figma and Penpot remain the design surface; AUB is the versioned
implementation and acceptance contract.
