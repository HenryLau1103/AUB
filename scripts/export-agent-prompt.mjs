#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import {
  exportAgentPrompt,
  supportedAgentAdapters,
  supportedAgentTasks,
} from './export-agent-prompt.lib.mjs';

export { exportAgentPrompt };

export async function runAgentAdapterCli(defaults = {}) {
  const args = process.argv.slice(2);
  const options = parseArgs(args, defaults);
  if (!options.input) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const inputText = options.input === '-'
    ? await readFile(0, 'utf8')
    : await readFile(resolve(options.input), 'utf8');
  const extension = options.input === '-' ? '.json' : extname(options.input).toLowerCase();
  const blueprint = extension === '.yaml' || extension === '.yml'
    ? yaml.load(inputText)
    : JSON.parse(inputText);
  const prompt = exportAgentPrompt(blueprint, {
    adapter: options.adapter,
    task: options.task,
  });

  if (options.output && options.output !== '-') {
    await writeFile(resolve(options.output), prompt, 'utf8');
    console.error(`✓ wrote ${options.output} (${prompt.length} bytes)`);
  } else {
    process.stdout.write(prompt);
  }
}

function parseArgs(args, defaults) {
  const positionals = [];
  const options = {
    adapter: defaults.adapter ?? 'generic',
    task: defaults.task ?? 'implement',
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--adapter') options.adapter = args[++index];
    else if (value === '--task') options.task = args[++index];
    else positionals.push(value);
  }
  if (!supportedAgentAdapters().includes(options.adapter)) {
    throw new Error(`Unsupported adapter "${options.adapter}". Use: ${supportedAgentAdapters().join(', ')}`);
  }
  if (!supportedAgentTasks().includes(options.task)) {
    throw new Error(`Unsupported task "${options.task}". Use: ${supportedAgentTasks().join(', ')}`);
  }
  return {
    ...options,
    input: positionals[0],
    output: positionals[1],
  };
}

function printUsage() {
  console.error('Usage: node scripts/export-agent-prompt.mjs <input.ui.json|yaml> [output.md]');
  console.error('       [--adapter generic|codex|claude-code] [--task author|implement|plan|review]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runAgentAdapterCli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
