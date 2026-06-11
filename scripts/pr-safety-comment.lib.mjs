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

  return [
    '<!-- aub-pr-safety-comment -->',
    '## AUB PR Safety Score',
    '',
    summaryLine(result, averageScore, grade),
    '',
    '| Status | Check | File | Safety score |',
    '|---|---|---|---|',
    rows.length
      ? rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
      : '| Fail | configuration | No AUB checks were found | - |',
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

function gradeForScore(score) {
  if (!Number.isInteger(score)) return 'n/a';
  if (score >= 85) return 'pass';
  if (score >= 70) return 'review';
  if (score >= 50) return 'risk';
  return 'fail';
}
