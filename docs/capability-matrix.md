# Agent Adapter Capability Matrix

| Capability | Codex | Claude Code | Copilot | MCP server |
|---|---:|---:|---:|---:|
| Current Blueprint schema | Yes | Yes | Yes | Yes |
| Blueprint authoring task | Yes | Yes | Yes | `export_prompt` |
| Implementation task | Yes | Yes | Yes | `export_prompt` |
| Planning task | Yes | Yes | Yes | `export_prompt` |
| Review task | Yes | Yes | Yes | `export_prompt` |
| Component hierarchy | Yes | Yes | Yes | `get_blueprint` |
| Auto and freeform layout | Yes | Yes | Yes | `get_blueprint` |
| Per-viewport geometry | Yes | Yes | Yes | `get_blueprint` |
| Interactions and responsive rules | Yes | Yes | Yes | `get_blueprint` |
| Acceptance evidence contract | Yes | Yes | Yes | `submit_report` |
| Portable `.aub.zip` entrypoint | `AGENT-README.md` + Codex prompt | `AGENT-README.md` + generated Claude prompt | `AGENT-README.md` + Copilot prompt | — (tools over stdio) |
| Repository instruction discovery | `AGENTS.md` | `CLAUDE.md` | `.github/copilot-instructions.md` + `AGENTS.md` | — (caller's responsibility) |
| Schema validation | via CLI | via CLI | via CLI | `validate_blueprint` |
| Spec scaffolding (interactions / responsive / acceptance) | `pnpm scaffold` | `pnpm scaffold` | `pnpm scaffold` | `scaffold_blueprint` |
| Implementation report submission | via CLI | via CLI | via CLI | `submit_report` |

All adapters import the same exporter and schema-compatible Blueprint. No adapter-specific schema exists. A `generic` adapter is also available as the default fallback for any other coding agent.

GitHub Copilot has a dedicated adapter (`adapters/copilot/`, adapter id `copilot`) that points Copilot at `.github/copilot-instructions.md` and applicable `AGENTS.md`. The MCP server's `export_prompt` tool accepts `adapter: "copilot"` as well.

The MCP server (`apps/mcp-server/`) wraps the same libraries and exposes the same Blueprint contract as direct tools over stdio — no adapter-specific schema exists there either. See [`apps/mcp-server/README.md`](../apps/mcp-server/README.md) for registration instructions.
