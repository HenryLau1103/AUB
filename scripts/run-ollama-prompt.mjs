#!/usr/bin/env node

const [model, baseUrl = 'http://127.0.0.1:11434'] = process.argv.slice(2);
if (!model) {
  console.error('Usage: node scripts/run-ollama-prompt.mjs <model> [ollama-base-url]');
  process.exit(2);
}

let prompt = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) prompt += chunk;
const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model,
    prompt,
    stream: false,
    think: false,
    format: 'json',
    options: { temperature: 0 },
  }),
});

if (!response.ok) {
  throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
}

const result = await response.json();
process.stdout.write(result.response ?? '');
