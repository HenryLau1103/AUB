#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function scoreAgentOutput(actual, expected) {
  const checks = [];
  compare(expected, actual, '$', checks);
  const passed = checks.filter((check) => check.pass).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    passed,
    total: checks.length,
    checks,
  };
}

async function main() {
  const [actualPath, expectedPath = 'benchmarks/agent-readability/expected.json'] = process.argv.slice(2);
  if (!actualPath) {
    console.error('Usage: node scripts/score-agent-readability.mjs <agent-output.json> [expected.json]');
    process.exit(2);
  }

  const actual = JSON.parse(await readFile(resolve(actualPath), 'utf8'));
  const expected = JSON.parse(await readFile(resolve(expectedPath), 'utf8'));
  const report = scoreAgentOutput(actual, expected);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.score === 100 ? 0 : 1);
}

function compare(expectedValue, actualValue, path, checks) {
  if (Array.isArray(expectedValue)) {
    checks.push({
      path,
      pass: JSON.stringify(actualValue) === JSON.stringify(expectedValue),
      expected: expectedValue,
      actual: actualValue,
    });
    return;
  }
  if (expectedValue && typeof expectedValue === 'object') {
    for (const [key, value] of Object.entries(expectedValue)) {
      compare(value, actualValue?.[key], `${path}.${key}`, checks);
    }
    return;
  }
  checks.push({ path, pass: Object.is(actualValue, expectedValue), expected: expectedValue, actual: actualValue });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
