# Claude Code Adapter

Generate a Claude Code-ready implementation, planning, or review prompt without changing the core Blueprint schema.

```bash
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json dashboard.claude.md
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json - --task plan
```

The prompt tells Claude Code to read repository instructions, preserve existing patterns, run checks, and report evidence for every acceptance id.
