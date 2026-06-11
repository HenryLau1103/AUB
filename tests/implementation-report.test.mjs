import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  createImplementationReportTemplate,
  scoreImplementationSafety,
  verifyImplementationReport,
} from '../scripts/implementation-report.lib.mjs';

const BLUEPRINT_URL = new URL('../examples/freeform-actions.ui.json', import.meta.url);
const SCHEMA_URL = new URL('../schema/implementation-report.schema.json', import.meta.url);

test('IR1: generated implementation report template is schema-valid and complete by id', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const schema = JSON.parse(await readFile(SCHEMA_URL, 'utf8'));
  const report = createImplementationReportTemplate(blueprint);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
  assert.deepEqual(report.node_mappings.map((item) => item.node_id), blueprint.nodes.map((node) => node.id));
  assert.deepEqual(report.acceptance_results.map((item) => item.acceptance_id), blueprint.acceptance.map((item) => item.id));
});

test('IR2: report becomes ready only after every node is mapped and acceptance has evidence', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const report = createImplementationReportTemplate(blueprint);
  assert.equal(verifyImplementationReport(blueprint, report).ready, false);

  report.implementation = { framework: 'React', route: '/signup', files: ['src/Signup.tsx'] };
  report.node_mappings = report.node_mappings.map((item) => ({
    ...item,
    status: 'mapped',
    file: 'src/Signup.tsx',
  }));
  report.acceptance_results = report.acceptance_results.map((item) => ({
    ...item,
    status: 'pass',
    evidence: [{ type: 'file', reference: 'src/Signup.tsx:1' }],
  }));

  const result = verifyImplementationReport(blueprint, report);
  assert.equal(result.ready, true, result.errors.join('\n'));
  assert.equal(result.summary.nodes_mapped, blueprint.nodes.length);
  assert.equal(result.summary.acceptance_passed, blueprint.acceptance.length);
});

test('IR3: verifier rejects unknown ids and unresolved work', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const report = createImplementationReportTemplate(blueprint);
  report.node_mappings.push({ node_id: 'unknown', status: 'mapped', component: 'button', file: 'x.tsx' });
  report.unresolved.push('Need product decision.');
  const result = verifyImplementationReport(blueprint, report);
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => error.includes('Unknown node mapping')));
  assert.ok(result.errors.some((error) => error.includes('unresolved')));
});

test('IR4: requireEvidence rejects narrative-only evidence and accepts machine evidence', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const report = createImplementationReportTemplate(blueprint);
  report.implementation = { framework: 'React', route: '/signup', files: ['src/Signup.tsx'] };
  report.node_mappings = report.node_mappings.map((item) => ({
    ...item,
    status: 'mapped',
    file: 'src/Signup.tsx',
  }));
  report.acceptance_results = report.acceptance_results.map((item) => ({
    ...item,
    status: 'pass',
    evidence: [{ type: 'note', reference: 'Looks correct in preview.' }],
  }));

  const narrative = verifyImplementationReport(blueprint, report, { requireEvidence: true });
  assert.equal(narrative.ready, false);
  assert.ok(narrative.errors.some((error) => error.includes('machine-checkable evidence')));

  report.acceptance_results = report.acceptance_results.map((item) => ({
    ...item,
    evidence: [
      { type: 'screenshot', reference: '.aub/reports/assets/signup-desktop.png', viewport: 'desktop', bytes: 12000 },
      { type: 'overflow', reference: 'desktop:horizontal-overflow', viewport: 'desktop', expected: false, actual: false, pass: true },
    ],
  }));

  const machine = verifyImplementationReport(blueprint, report, { requireEvidence: true });
  assert.equal(machine.ready, true, machine.errors.join('\n'));
  assert.equal(machine.summary.evidence_items, blueprint.acceptance.length * 2);
  assert.ok(machine.summary.safety_score.overall >= 70);
  assert.equal(machine.summary.safety_score.grade, 'review');
});

test('IR5: safety score exposes source, viewport, evidence, and unresolved risk', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const report = createImplementationReportTemplate(blueprint);
  const initial = scoreImplementationSafety(blueprint, report);
  assert.equal(initial.sourceCoverageScore, 0);
  assert.equal(initial.acceptanceEvidenceScore, 0);
  assert.ok(initial.unresolvedMappingCount >= blueprint.nodes.length);
  assert.equal(initial.grade, 'fail');

  report.node_mappings = report.node_mappings.map((item) => ({
    ...item,
    status: 'mapped',
    file: 'src/Signup.tsx',
  }));
  report.acceptance_results = report.acceptance_results.map((item) => ({
    ...item,
    status: 'pass',
    evidence: [
      { type: 'screenshot', reference: '.aub/reports/assets/signup-desktop.png', viewport: 'desktop', bytes: 1000 },
      { type: 'overflow', reference: 'desktop:horizontal-overflow', viewport: 'desktop', expected: false, actual: false, pass: true },
      { type: 'component_reuse', reference: 'src/Signup.tsx' },
    ],
  }));
  const improved = scoreImplementationSafety(blueprint, report);
  assert.equal(improved.sourceCoverageScore, 100);
  assert.equal(improved.acceptanceEvidenceScore, 100);
  assert.ok(improved.lookalikePreventionCount > 0);
  assert.ok(improved.overall > initial.overall);
});
