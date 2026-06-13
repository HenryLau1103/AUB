# GitHub Agent Workflow

AUB is most useful when GitHub issues become agent-ready UI work orders. The issue defines the route, Blueprint/template, component reuse rules, and acceptance criteria; Copilot, Codex, or another coding agent implements the real app change and returns evidence.

## Recommended Flow

1. Start AUB in the existing app:

   ```bash
   cd /path/to/existing-app
   npx aub-workspace
   ```

2. In AUB Editor, scan the project and generate a candidate workspace template for the route.
3. Review component candidates. Keep custom components as candidates until a user approves the mapping.
4. Adjust the Blueprint and save it back to the workspace.
5. Copy the agent instruction from AUB Editor.
6. Open a GitHub issue with the **AUB UI Change** template.
7. Assign the issue to GitHub Copilot cloud agent, or ask Codex to work from the issue/PR.
8. Review the implementation PR, implementation report, and acceptance evidence.

## Issue Templates

Use **AUB Scan Existing Route** when the first task is discovery:

- scan a route or component file
- generate `.aub/templates/<slug>.aub.template.json`
- write custom components to `.aub/component-candidates.json`
- leave the template as `status: "candidate"`

Use **AUB UI Change** when the task is implementation:

- apply an approved or edited Blueprint to real app code
- reuse mapped production components
- preserve route behavior and responsive behavior
- report acceptance evidence

## Copilot Cloud Agent

When assigning an issue to Copilot, keep the issue concrete. Include:

- target route
- source files
- Blueprint/template path
- production components to reuse
- acceptance criteria
- preview URL if available

The repository includes `.github/copilot-instructions.md` so Copilot can apply AUB-specific rules without depending on local-only `AGENTS.md`.

## Codex Review

On an implementation PR, request review with:

```text
@codex review
```

Codex should verify the PR against the Blueprint, component mappings, and acceptance criteria. If automatic code review is unavailable in the Codex settings UI, manual `@codex review` is still the smallest viable path to validate.

## Actions Approval

If GitHub asks for Actions workflow approval after an agent opens a PR, that is a safety setting, not an AUB failure. Approve the workflow only after checking the diff and confirming it does not introduce unexpected scripts, secrets access, or dependency changes.

## Implementation Report Expectations

Every agent implementation should include evidence for each relevant acceptance item:

- `pass`: verified with test, screenshot, preview, or code inspection evidence
- `fail`: known mismatch with explanation
- `needs-review`: requires human judgement or blocked by missing runtime access

When AUB MCP is available, agents should use `submit_report`. When MCP is unavailable, they should include the same evidence in the PR body.
