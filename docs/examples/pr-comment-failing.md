# Example PR Comment: Failing Evidence Gate

```md
<!-- aub-pr-safety-comment -->
## AUB PR Safety Score

**Decision:** Do not merge. AUB found blocking contract or implementation evidence failures.

**Status:** blocked. **Checks:** 1/2. **Failures:** 2. **Average PR Safety Score:** 42 / fail.

### Evidence Matrix

| Report | Acceptance | Evidence | Viewports | Overflow | Component reuse | Unresolved |
|---|---:|---:|---|---|---:|---:|
| `.aub/reports/risk.implementation-report.json` | 1/5 | 1 | 0% (desktop, tablet, mobile) | 40% | 0 | 2 |

### Reviewer Focus

- Acceptance evidence is missing or narrative-only; require screenshot, DOM, overflow, component reuse, interaction, or code-diff proof.
- Some Blueprint nodes or custom components are unresolved; verify component reuse before merge.
- PR Safety Score is below the recommended merge threshold.

### Blocking Findings

- `.aub/reports/risk.implementation-report.json`: Implementation report: Acceptance result has no machine-checkable evidence: acc_workspace_responsive
- `.aub/reports/risk.implementation-report.json`: Implementation safety score 42 is below required minimum 70.
```
