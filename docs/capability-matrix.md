# Agent Adapter Capability Matrix

| Capability | Generic / Copilot | Codex | Claude Code | MCP server |
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
| Portable `.aub.zip` entrypoint | `AGENT-README.md` | `AGENT-README.md` + Codex prompt | `AGENT-README.md` + generated Claude prompt | — (tools over stdio) |
| Repository instruction discovery | Generic / Copilot instructions | `AGENTS.md` | `CLAUDE.md` | — (caller's responsibility) |
| Schema validation | via CLI | via CLI | via CLI | `validate_blueprint` |
| Implementation report submission | via CLI | via CLI | via CLI | `submit_report` |

All adapters import the same exporter and schema-compatible Blueprint. No adapter-specific schema exists.

GitHub Copilot currently uses the generic handoff contract; AUB does not ship a separate Copilot adapter.

The MCP server (`apps/mcp-server/`) wraps the same libraries and exposes the same Blueprint contract as direct tools over stdio — no adapter-specific schema exists there either. See [`apps/mcp-server/README.md`](../apps/mcp-server/README.md) for registration instructions.
