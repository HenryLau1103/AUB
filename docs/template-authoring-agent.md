# Template Authoring for Existing Projects

This guide is for coding agents that scan an existing application and produce
AUB workspace templates.

## Contract

Agents must treat AUB as a semantic contract system, not a screenshot copier.
When scanning an app:

1. Inspect routes, layouts, reusable components, design tokens, and project
   conventions before generating a template.
2. Respect `.aubignore` and default scanner exclusions. Do not include secrets,
   generated output, or local-only cache files in templates, candidates, or
   snapshots.
3. Use core AUB component types when the meaning is clear.
4. Put project-specific components in `.aub/component-candidates.json`.
5. Treat Storybook stories as component reuse hints, not as automatic approval.
6. Never write a scanned component directly into `aub.registry.json`.
7. Generate `.aub/templates/<slug>.aub.template.json` with source references,
   confidence, and `status: "candidate"` unless a human has already approved it.

## Workspace Template Shape

```json
{
  "format": "aub-workspace-template",
  "format_version": "0.1.0",
  "id": "settings",
  "name": "Settings",
  "category": "workspace",
  "framework": "react",
  "source": {
    "kind": "route",
    "path": "src/pages/settings.tsx",
    "route": "/settings"
  },
  "blueprint": {
    "version": "0.3.0"
  },
  "registryRefs": ["app:settings_panel"],
  "confidence": 0.72,
  "status": "candidate"
}
```

The embedded `blueprint` must be a complete, schema-valid `.ui.json` document.

## Component Candidates

Scanned custom components belong in `.aub/component-candidates.json`:

```json
{
  "format": "aub-component-candidates",
  "format_version": "0.1.0",
  "candidates": [{
    "id": "src-components-insight-card-insight_card",
    "status": "candidate",
    "sourcePath": "src/components/InsightCard.tsx",
    "framework": "react",
    "componentName": "InsightCard",
    "suggestedType": "app:insight_card",
    "suggestedCoreType": "card",
    "isContainer": true,
    "props": ["title"],
    "usageCount": 3,
    "storybookStories": [
      { "path": "src/components/InsightCard.stories.tsx", "title": "Analytics/InsightCard" }
    ],
    "confidence": 0.72,
    "reason": "Static scan found a reusable project component."
  }]
}
```

Users review each candidate in the editor:

- **Map core** records that the project component should be represented by an
  existing AUB core type.
- **Create extension** writes a namespaced component entry to `aub.registry.json`.
- **Ignore** leaves the component out of the registry.

## MCP Workflow

1. `scan_project_ui` writes `.aub/component-candidates.json`.
2. `generate_template_from_source` writes a candidate workspace template.
3. The user opens the template in the AUB editor and reviews component
   candidates.
4. The editor saves the reviewed Blueprint with `write_blueprint` and updates
   `.aub/session.json` with `update_aub_session`.
5. The implementation agent reads `get_aub_session`, `get_blueprint`, and
   `resolve_component` before changing production code.
6. The implementation agent returns an implementation report with machine
   evidence and a PR Safety Score so reviewers can see source coverage,
   viewport coverage, overflow safety, and component reuse risk.
