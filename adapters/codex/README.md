# Codex Adapter

Generate a Codex-ready implementation, planning, or review prompt without changing the core Blueprint schema.

```bash
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json dashboard.codex.md
node adapters/codex/export-prompt.mjs examples/dashboard.ui.json - --task review
```

The prompt tells Codex to read applicable `AGENTS.md` files, follow repository-native patterns, run checks, and report evidence for every acceptance id.
