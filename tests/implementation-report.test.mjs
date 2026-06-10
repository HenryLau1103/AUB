import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  createImplementationReportTemplate,
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
