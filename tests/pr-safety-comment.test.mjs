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
          sourceCoverageScore: 100,
          acceptanceEvidenceScore: 20,
          viewportEvidenceScore: 0,
          overflowSafety: 40,
          componentReuseScore: 0,
          unresolvedMappingCount: 2,
          lookalikePreventionCount: 0,
          evidenceItems: 1,
          expectedViewports: ['desktop', 'tablet', 'mobile'],
        },
        reportSummary: {
          nodes_total: 3,
          nodes_mapped: 3,
          acceptance_total: 5,
          acceptance_passed: 1,
          evidence_items: 1,
          unresolved: 2,
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
  assert.match(comment, /Decision:\*\* Do not merge/);
  assert.match(comment, /Evidence Matrix/);
  assert.match(comment, /Reviewer Focus/);
  assert.match(comment, /1\/5/);
  assert.match(comment, /0% \(desktop, tablet, mobile\)/);
  assert.match(comment, /42 \/ fail/);
  assert.match(comment, /machine evidence|machine-checkable evidence|screenshot/i);
  assert.match(comment, /Raise the PR Safety Score/);
});

test('PSC2: passing report comment gives an audit-ready decision and matrix', () => {
  const comment = formatPrSafetyComment({
    valid: true,
    summary: { checks: 2, passed: 2, failed: 0, failures: 0 },
    checks: [
      { kind: 'blueprint', path: 'screens/risk.ui.json', passed: true, failures: [] },
      {
        kind: 'report',
        path: '.aub/reports/risk.implementation-report.json',
        blueprint: 'screens/risk.ui.json',
        passed: true,
        safetyScore: {
          overall: 91,
          grade: 'pass',
          sourceCoverageScore: 100,
          acceptanceEvidenceScore: 100,
          viewportEvidenceScore: 100,
          overflowSafety: 100,
          componentReuseScore: 100,
          unresolvedMappingCount: 0,
          lookalikePreventionCount: 2,
          evidenceItems: 12,
          expectedViewports: ['desktop', 'tablet', 'mobile'],
        },
        reportSummary: {
          nodes_total: 8,
          nodes_mapped: 8,
          acceptance_total: 5,
          acceptance_passed: 5,
          evidence_items: 12,
          unresolved: 0,
        },
        failures: [],
      },
    ],
    failures: [],
  });

  assert.match(comment, /Decision:\*\* Ready for review/);
  assert.match(comment, /5\/5/);
  assert.match(comment, /100% \(desktop, tablet, mobile\)/);
  assert.match(comment, /Evidence is complete enough/);
});
