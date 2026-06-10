# Angular Import and Personal Templates

AUB v0.3 can convert an Angular component file group into an editable
Blueprint. The deterministic importer is the source of truth; local AI review
is optional and only produces suggestions that the user applies explicitly.

## Supported input

Provide a directory, individual files, or a ZIP containing:

- `*.component.html`
- matching `*.component.ts`
- matching `*.component.scss` or `*.component.css`
- child components used by the entry template

The importer ignores `*.spec.ts`. Source paths stored in the Blueprint are
relative and sanitized; absolute local paths are not exported.

## CLI

```bash
pnpm import:angular path/to/component-directory \
  --entry app-customer-search \
  --output customer-search.ui.json

pnpm validate customer-search.ui.json
```

`--entry` accepts a component selector or template path. If omitted, the first
discovered Angular component is used.

## Editor workflow

1. Choose **Import Angular component** in the top toolbar.
2. Select component files, a folder, or a ZIP.
3. Choose the entry component and review diagnostics.
4. Optionally send low-confidence diagnostics to a local Ollama model.
5. Apply individual AI suggestions, then load the result into the canvas.
6. Use the import-diagnostics panel to focus affected nodes.
7. Save the result as a personal template when it is reusable.

Personal templates are stored in browser `localStorage`. Export a template
package to move it between browsers or machines.

## Mapping

The importer preserves:

- hierarchy, labels, headings, forms, field groups, tables, tabs, actions, and
  common layout containers
- Angular values, visibility, enabled state, repetition, selection, and event
  bindings
- required, pattern, minimum, maximum, and length validation metadata
- form defaults and disabled state when they can be read from `FormBuilder`
- table header, binding, width, alignment, sort, sticky, icon, link, checkbox,
  and action semantics
- source file, source line, selector, provenance, diagnostics, and confidence
- reusable colors, spacing, radii, shadows, and typography found in stylesheets

Unknown custom elements remain visible as placeholders and produce a warning.
The importer does not execute Angular code or infer hidden business behavior.

## Local AI review

Set an Ollama URL and model in the import dialog, or use:

```bash
VITE_AUB_OLLAMA_URL=http://127.0.0.1:11434
VITE_AUB_OLLAMA_MODEL=qwen3.6:35b
```

Only low-confidence diagnostics and relevant source snippets are sent. Returned
patches are restricted to semantic node fields and are never applied
automatically.
