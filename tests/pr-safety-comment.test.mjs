import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrSafetyComment } from '../scripts/pr-safety-comment.lib.mjs';

test('PSC1: PR Safety Score comment summarizes checks, failures, and actions', () => {
  const comment = formatPrSafetyComment({
    valid: false,
    summary: { checks: 2, passed: 1, failed: 1, failures: 2 },
    checks: [
      { kind: 'blueprint', path: 'screens/risk.ui.json', passed: true, failures: [] },
      {
        kind: 'report',
        path: '.aub/reports/risk.implementation-report.json',
        passed: false,
        safetyScore: {
          overall: 42,
          grade: 'fail',
        },
        failures: [],
      },
    ],
    failures: [
      { path: '.aub/reports/risk.implementation-report.json', message: 'Implementation report: Acceptance result has no machine-checkable evidence: acc_demo' },
      { path: '.aub/reports/risk.implementation-report.json', message: 'Implementation safety score 42 is below required minimum 70.' },
    ],
  });

  assert.match(comment, /<!-- aub-pr-safety-comment -->/);
  assert.match(comment, /AUB PR Safety Score/);
  assert.match(comment, /42 \/ fail/);
  assert.match(comment, /machine evidence|machine-checkable evidence|screenshot/i);
  assert.match(comment, /Raise the PR Safety Score/);
});
