#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scoreImplementationBenchmark } from './agent-implementation-benchmark.lib.mjs';

const [measurementsPath, implementationReportPath, outputPath] = process.argv.slice(2);
if (!measurementsPath || !implementationReportPath) {
  console.error('Usage: node scripts/score-agent-implementation.mjs <measurements.json> <implementation-report.json> [output.json]');
  process.exit(2);
}

const [blueprint, measurements, implementationReport] = await Promise.all([
  readFile(resolve('examples/freeform-actions.ui.json'), 'utf8').then(JSON.parse),
  readFile(resolve(measurementsPath), 'utf8').then(JSON.parse),
  readFile(resolve(implementationReportPath), 'utf8').then(JSON.parse),
]);
const result = scoreImplementationBenchmark(
  blueprint,
  measurements.candidate,
  measurements.reference,
  implementationReport
);
const output = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) await writeFile(resolve(outputPath), output, 'utf8');
else process.stdout.write(output);
process.exit(result.ready ? 0 : 1);
