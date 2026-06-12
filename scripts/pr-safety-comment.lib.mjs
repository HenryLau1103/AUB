export function formatPrSafetyComment(result) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const failures = Array.isArray(result?.failures) ? result.failures : [];
  const reportChecks = checks.filter((check) => check.kind === 'report');
  const scoreValues = reportChecks
    .map((check) => check.safetyScore?.overall)
    .filter((score) => Number.isInteger(score));
  const averageScore = scoreValues.length
    ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
    : null;
  const grade = gradeForScore(averageScore);
  const rows = checks.map((check) => [
    check.passed ? 'Pass' : 'Fail',
    check.kind,
    `\`${check.path}\``,
    check.safetyScore ? `${check.safetyScore.overall} / ${check.safetyScore.grade}` : '-',
  ]);
  const evidenceRows = reportChecks.map((check) => evidenceMatrixRow(check));
  const decision = reviewDecision({ result, averageScore, reportChecks, failures });

  return [
    '<!-- aub-pr-safety-comment -->',
    '## AUB PR Safety Score',
    '',
    `**Decision:** ${decision.label}. ${decision.reason}`,
    '',
    summaryLine(result, averageScore, grade),
    '',
    '| Status | Check | File | Safety score |',
    '|---|---|---|---|',
    rows.length
      ? rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
      : '| Fail | configuration | No AUB checks were found | - |',
    '',
    '### Evidence Matrix',
    '',
    evidenceRows.length
      ? [
          '| Report | Acceptance | Evidence | Viewports | Overflow | Component reuse | Unresolved |',
          '|---|---:|---:|---|---|---:|---:|',
          ...evidenceRows,
        ].join('\n')
      : '- No implementation reports are configured for this PR.',
    '',
    '### Reviewer Focus',
    '',
    reviewerFocus({ failures, reportChecks, averageScore }).map((item) => `- ${item}`).join('\n'),
    '',
    '### Blocking Findings',
    '',
    failures.length
      ? failures.slice(0, 12).map((failure) => `- \`${failure.path}\`: ${failure.message}`).join('\n')
      : '- None.',
    failures.length > 12 ? `\n- ${failures.length - 12} more finding(s) are in the workflow log.` : '',
    '',
    '### Next Actions',
    '',
    nextActions({ checks, failures, reportChecks, averageScore }).map((action) => `- ${action}`).join('\n'),
    '',
  ].join('\n');
}

function summaryLine(result, averageScore, grade) {
  const status = result?.valid ? 'ready' : 'blocked';
  const checks = result?.summary?.checks ?? 0;
  const passed = result?.summary?.passed ?? 0;
  const failures = result?.summary?.failures ?? 0;
  const score = averageScore === null ? 'not available' : `${averageScore} / ${grade}`;
  return `**Status:** ${status}. **Checks:** ${passed}/${checks}. **Failures:** ${failures}. **Average PR Safety Score:** ${score}.`;
}

function nextActions({ checks, failures, reportChecks, averageScore }) {
  const actions = [];
  if (checks.length === 0) {
    actions.push('Add `.ui.json`, `.aub.project.json`, or `.aub/ci.json` so AUB can verify the PR.');
  }
  if (reportChecks.length === 0) {
    actions.push('Configure an implementation report when this PR changes a real UI route.');
  }
  if (failures.some((failure) => /machine-checkable evidence|no evidence/i.test(failure.message))) {
    actions.push('Add screenshot, DOM query, overflow, component reuse, interaction, or code diff evidence to the implementation report.');
  }
  if (failures.some((failure) => /not mapped|unresolved/i.test(failure.message))) {
    actions.push('Map every Blueprint node to source files and resolve custom component candidates before handoff.');
  }
  if (failures.some((failure) => /overflow/i.test(failure.message))) {
    actions.push('Fix horizontal overflow and recapture viewport evidence before merging.');
  }
  if (Number.isInteger(averageScore) && averageScore < 70) {
    actions.push('Raise the PR Safety Score above the configured threshold before treating this as agent-safe.');
  }
  if (actions.length === 0) {
    actions.push('Keep the report evidence committed with the PR so reviewers can audit the result without trusting agent prose.');
  }
  return actions;
}

function reviewDecision({ result, averageScore, reportChecks, failures }) {
  if (!result?.valid) {
    return {
      label: 'Do not merge',
      reason: 'AUB found blocking contract or implementation evidence failures.',
    };
  }
  if (reportChecks.length === 0) {
    return {
      label: 'Needs product review',
      reason: 'Contracts are valid, but no implementation report proves the real UI change.',
    };
  }
  if (Number.isInteger(averageScore) && averageScore < 85) {
    return {
      label: 'Needs human review',
      reason: 'The gate passed, but the safety score is below the ready threshold.',
    };
  }
  if (failures.length === 0) {
    return {
      label: 'Ready for review',
      reason: 'Contracts, report evidence, and safety score are strong enough for reviewer audit.',
    };
  }
  return {
    label: 'Needs review',
    reason: 'AUB could not derive a stronger decision from the available evidence.',
  };
}

function evidenceMatrixRow(check) {
  const summary = check.reportSummary ?? {};
  const score = check.safetyScore ?? {};
  const acceptance = `${summary.acceptance_passed ?? 0}/${summary.acceptance_total ?? 0}`;
  const expectedViewports = Array.isArray(score.expectedViewports) && score.expectedViewports.length > 0
    ? score.expectedViewports.join(', ')
    : '-';
  const viewportLabel = Number.isInteger(score.viewportEvidenceScore)
    ? `${score.viewportEvidenceScore}% (${expectedViewports})`
    : '-';
  const overflowLabel = Number.isInteger(score.overflowSafety)
    ? `${score.overflowSafety}%`
    : '-';
  return [
    `\`${check.path}\``,
    acceptance,
    summary.evidence_items ?? 0,
    viewportLabel,
    overflowLabel,
    score.componentReuseScore ?? '-',
    summary.unresolved ?? score.unresolvedMappingCount ?? '-',
  ].map((value) => String(value).replace(/\|/g, '\\|')).join(' | ').replace(/^/, '| ').replace(/$/, ' |');
}

function reviewerFocus({ failures, reportChecks, averageScore }) {
  const focus = [];
  if (reportChecks.length === 0) {
    focus.push('No report evidence is available; review cannot rely on agent self-reporting.');
  }
  if (failures.some((failure) => /machine-checkable evidence|no evidence/i.test(failure.message))) {
    focus.push('Acceptance evidence is missing or narrative-only; require screenshot, DOM, overflow, component reuse, interaction, or code-diff proof.');
  }
  if (failures.some((failure) => /overflow/i.test(failure.message))) {
    focus.push('Viewport overflow evidence failed; inspect responsive behavior before approving.');
  }
  if (failures.some((failure) => /not mapped|unresolved/i.test(failure.message))) {
    focus.push('Some Blueprint nodes or custom components are unresolved; verify component reuse before merge.');
  }
  if (Number.isInteger(averageScore) && averageScore < 70) {
    focus.push('PR Safety Score is below the recommended merge threshold.');
  } else if (Number.isInteger(averageScore) && averageScore < 85) {
    focus.push('PR Safety Score passed the gate but still needs reviewer judgment.');
  }
  for (const check of reportChecks) {
    const score = check.safetyScore;
    if (!score) continue;
    if (score.componentReuseScore < 100) focus.push(`Component reuse is incomplete in \`${check.path}\`.`);
    if (score.viewportEvidenceScore < 100) focus.push(`Viewport evidence is incomplete in \`${check.path}\`.`);
    if (score.acceptanceEvidenceScore < 100) focus.push(`Acceptance evidence coverage is incomplete in \`${check.path}\`.`);
  }
  if (focus.length === 0) {
    focus.push('Evidence is complete enough for reviewer audit; keep the report artifacts with the PR.');
  }
  return [...new Set(focus)];
}

function gradeForScore(score) {
  if (!Number.isInteger(score)) return 'n/a';
  if (score >= 85) return 'pass';
  if (score >= 70) return 'review';
  if (score >= 50) return 'risk';
  return 'fail';
}
