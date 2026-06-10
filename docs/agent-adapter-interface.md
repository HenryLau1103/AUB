# Agent Adapter Interface

Agent adapters are thin prompt transforms. They MUST NOT fork or extend the UI Blueprint schema.

For the portable package entrypoint, precedence rules, first-response behavior, and completion contract, read the [Agent handoff guide](./agent-handoff.md).

## Input

- One valid current-major `.ui.json` or `.ui.yaml` Blueprint.
- Adapter id: `generic`, `codex`, `claude-code`, or `copilot`.
- Task id: `author`, `implement`, `plan`, or `review`.

## Output

A deterministic Markdown prompt containing:

1. Agent-specific repository instructions.
2. The requested task and final response contract.
3. The complete framework-neutral Blueprint implementation brief.
4. Acceptance ids that the agent must report with evidence.
5. A machine-readable implementation report template mapping every node and acceptance id.

## Commands

```bash
node scripts/export-agent-prompt.mjs examples/dashboard.ui.json - \
  --adapter generic --task implement

node adapters/codex/export-prompt.mjs examples/dashboard.ui.json dashboard.codex.md
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json dashboard.claude.md
node adapters/copilot/export-prompt.mjs examples/dashboard.ui.json dashboard.copilot.md
```

Adapters may change instructions and invocation conventions. They may not change node types, layout semantics, interactions, responsive rules, or acceptance criteria.

Agents without a dedicated adapter should use the `generic` adapter together with `AGENT-README.md` from the `.aub.zip` handoff package.
