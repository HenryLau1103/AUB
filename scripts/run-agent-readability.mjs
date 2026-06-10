#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreAgentOutput } from './score-agent-readability.mjs';

const args = process.argv.slice(2);
const separator = args.indexOf('--');
const options = separator >= 0 ? args.slice(0, separator) : args;
const command = separator >= 0 ? args.slice(separator + 1) : [];
const name = options.find((value) => !value.startsWith('--'));
const allowsExternal = options.includes('--allow-external');

if (!name || command.length === 0) {
  console.error('Usage: node scripts/run-agent-readability.mjs <agent-name> --allow-external -- <command> [args...]');
  process.exit(2);
}

if (!allowsExternal) {
  console.error('Refusing to run an external agent without the explicit --allow-external flag.');
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkDir = resolve(root, 'benchmarks/agent-readability');
const resultDir = resolve(benchmarkDir, 'results');
const prompt = await readFile(resolve(benchmarkDir, 'prompt.md'), 'utf8');
const fixture = await readFile(resolve(root, 'examples/freeform-actions.ui.json'), 'utf8');
const expected = JSON.parse(await readFile(resolve(benchmarkDir, 'expected.json'), 'utf8'));
await mkdir(resultDir, { recursive: true });

const benchmarkInput = [
  prompt.trim(),
  '',
  '<blueprint_json>',
  fixture.trim(),
  '</blueprint_json>',
  '',
].join('\n');
const result = await run(command[0], command.slice(1), benchmarkInput, root);
const slug = name.replace(/[^a-zA-Z0-9._-]+/g, '-');
await writeFile(resolve(resultDir, `${slug}.stdout.txt`), result.stdout, 'utf8');
await writeFile(resolve(resultDir, `${slug}.stderr.txt`), result.stderr, 'utf8');

if (result.code !== 0) {
  console.error(`${name} exited with code ${result.code}. See benchmarks/agent-readability/results/${slug}.stderr.txt`);
  process.exit(result.code || 1);
}

const actual = extractJsonObject(result.stdout);
const report = {
  agent: name,
  command: command.map(redactArgument),
  executed_at: new Date().toISOString(),
  ...scoreAgentOutput(actual, expected),
};
await writeFile(resolve(resultDir, `${slug}.output.json`), `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
await writeFile(resolve(resultDir, `${slug}.report.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
process.exit(report.score === 100 ? 0 : 1);

function run(executable, commandArgs, stdin, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, commandArgs, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  for (const candidate of [trimmed, fenced].filter(Boolean)) {
    try {
      const value = JSON.parse(candidate);
      if (isBenchmarkOutput(value)) return value;
    } catch {
      // Continue to balanced-object extraction.
    }
  }

  for (let start = trimmed.indexOf('{'); start >= 0; start = trimmed.indexOf('{', start + 1)) {
    const candidate = balancedObjectAt(trimmed, start);
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (isBenchmarkOutput(value)) return value;
    } catch {
      // Try the next opening brace.
    }
  }
  throw new Error('Agent output did not contain one parseable JSON object.');
}

function isBenchmarkOutput(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.version === 'string' &&
    typeof value.root_id === 'string' &&
    Array.isArray(value.direct_root_children)
  );
}

function balancedObjectAt(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function redactArgument(argument) {
  return /(?:key|token|secret|password)=/i.test(argument)
    ? argument.replace(/=.*/, '=REDACTED')
    : argument;
}
