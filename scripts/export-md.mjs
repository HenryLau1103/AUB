#!/usr/bin/env node
// CLI wrapper around the browser-safe Markdown exporter.
// Usage: node scripts/export-md.mjs <input.ui.json|input.ui.yaml> [output.ui.md]

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { exportMarkdown } from './export-md.lib.mjs';

export { exportMarkdown };

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/export-md.mjs <input.ui.json|input.ui.yaml> [output.ui.md]');
    console.error('       node scripts/export-md.mjs -  (read JSON from stdin)');
    process.exit(2);
  }

  const inputText = args[0] === '-'
    ? await readFile(0, 'utf8')
    : await readFile(resolve(args[0]), 'utf8');
  const ext = args[0] === '-' ? '.json' : extname(args[0]).toLowerCase();
  const blueprint = ext === '.yaml' || ext === '.yml'
    ? yaml.load(inputText)
    : JSON.parse(inputText);
  const markdown = exportMarkdown(blueprint);

  if (args[1] && args[1] !== '-') {
    await writeFile(resolve(args[1]), markdown, 'utf8');
    console.error(`✓ wrote ${args[1]} (${markdown.length} bytes)`);
  } else {
    process.stdout.write(markdown);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
