# AUB GitHub Agent Instructions

AUB is a contract layer for safely changing existing product UI with coding agents. When you work on this repository or on an issue that references AUB, optimize for preserving product intent, production components, responsive behavior, and acceptance evidence.

## Default Workflow

1. Read the issue fields first: target route, source files, desired UI change, AUB Blueprint/template/session path, component reuse requirements, preview URL, and acceptance criteria.
2. If the task uses an existing app workspace, prefer AUB MCP tools over guessing from prose:
   - `get_aub_session`
   - `get_blueprint`
   - `get_project`
   - `resolve_component`
   - `validate_blueprint`
   - `submit_report`
3. Before editing app code, identify which production components should be reused.
4. Implement the smallest change that satisfies the Blueprint and acceptance criteria.
5. Report evidence for each acceptance item in the PR description or an implementation report.

## Non-Negotiable Rules

- Do not freely invent AUB core component types.
- Do not recreate lookalike UI when a production component or registry mapping exists.
- Do not auto-approve scanned custom components. Candidates must remain in `.aub/component-candidates.json` until a user approves the mapping.
- Do not weaken or silently rewrite acceptance criteria to match an easier implementation.
- Do not treat `.ui.md` as source of truth. Use `.ui.json` or MCP `get_blueprint`.
- If `aub.registry.json` maps a component type to a module/export/props contract, use that mapping before writing new UI primitives.

## Pull Request Expectations

Every UI implementation PR should include:

- Target route and source files changed.
- AUB Blueprint/template/session path used.
- Component mappings used or unresolved.
- Checks run.
- Acceptance evidence, with pass/fail/needs-review for each relevant item.

If AUB MCP is unavailable, say so explicitly and continue from the checked-in Blueprint/template files instead of guessing.
