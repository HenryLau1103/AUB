#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { verifyWorkspace } from './ci-verify.lib.mjs';

const args = process.argv.slice(2);
const workspace = valueAfter(args, '--workspace') ?? process.cwd();
const configPath = valueAfter(args, '--config') ?? '.aub/ci.json';
const requireReports = args.includes('--require-reports');

const result = await verifyWorkspace({ workspace, configPath, requireReports });

for (const check of result.checks) {
  console.log(`${check.passed ? '✓' : '✗'} ${check.kind}: ${check.path}`);
}
for (const failure of result.failures) {
  console.error(`  ${failure.path}: ${failure.message}`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.error(`::error file=${failure.path}::${escapeAnnotation(failure.message)}`);
  }
}
console.log(
  `AUB CI: ${result.summary.passed}/${result.summary.checks} checks passed, ${result.summary.failures} failure(s).`
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = result.checks
    .map((check) => `| ${check.passed ? 'Pass' : 'Fail'} | ${check.kind} | \`${check.path}\` |`)
    .join('\n');
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## AUB contract verification\n\n| Status | Check | File |\n|---|---|---|\n${rows || '| Fail | configuration | No checks found |'}\n\n**${result.summary.failures} failure(s)**\n`
  );
}

process.exit(result.valid ? 0 : 1);

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function escapeAnnotation(value) {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}
