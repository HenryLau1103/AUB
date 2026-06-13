#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { verifyWorkspace } from './ci-verify.lib.mjs';
import { formatPrSafetyComment } from './pr-safety-comment.lib.mjs';

const args = process.argv.slice(2);
const workspace = valueAfter(args, '--workspace') ?? process.cwd();
const configPath = valueAfter(args, '--config') ?? '.aub/ci.json';
const output = valueAfter(args, '--output') ?? null;
const requireReports = args.includes('--require-reports');
const requireEvidence = args.includes('--require-evidence');
const minSafetyScore = valueAfter(args, '--min-safety-score') ?? null;

const result = await verifyWorkspace({ workspace, configPath, requireReports, requireEvidence, minSafetyScore });
const comment = formatPrSafetyComment(result);

if (output) {
  await writeFile(output, comment, 'utf8');
} else {
  process.stdout.write(comment);
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}
