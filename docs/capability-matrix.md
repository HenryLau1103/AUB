# Agent Adapter Capability Matrix

| Capability | Generic / Copilot | Codex | Claude Code |
|---|---:|---:|---:|
| Current Blueprint schema | Yes | Yes | Yes |
| Blueprint authoring task | Yes | Yes | Yes |
| Implementation task | Yes | Yes | Yes |
| Planning task | Yes | Yes | Yes |
| Review task | Yes | Yes | Yes |
| Component hierarchy | Yes | Yes | Yes |
| Auto and freeform layout | Yes | Yes | Yes |
| Per-viewport geometry | Yes | Yes | Yes |
| Interactions and responsive rules | Yes | Yes | Yes |
| Acceptance evidence contract | Yes | Yes | Yes |
| Portable `.aub.zip` entrypoint | `AGENT-README.md` | `AGENT-README.md` + Codex prompt | `AGENT-README.md` + generated Claude prompt |
| Repository instruction discovery | Generic / Copilot instructions | `AGENTS.md` | `CLAUDE.md` |

All adapters import the same exporter and schema-compatible Blueprint. No adapter-specific schema exists.

GitHub Copilot currently uses the generic handoff contract; AUB does not ship a separate Copilot adapter.
