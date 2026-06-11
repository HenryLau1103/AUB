#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createImplementationReportTemplate } from './implementation-report.lib.mjs';
import { scoreImplementationBenchmark } from './agent-implementation-benchmark.lib.mjs';

const args = process.argv.slice(2);
const separator = args.indexOf('--');
const options = separator >= 0 ? args.slice(0, separator) : args;
const command = separator >= 0 ? args.slice(separator + 1) : [];
const name = options.find((value) => !value.startsWith('--'));
const allowsExternal = options.includes('--allow-external');

if (!name || command.length === 0) {
  console.error('Usage: node scripts/run-agent-implementation.mjs <agent-name> --allow-external -- <command> [args...]');
  process.exit(2);
}
if (!allowsExternal) {
  console.error('Refusing to run an external agent without the explicit --allow-external flag.');
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkDir = resolve(root, 'benchmarks/agent-implementation');
const resultRoot = resolve(benchmarkDir, 'results');
const slug = name.replace(/[^a-zA-Z0-9._-]+/g, '-');
const resultDir = resolve(resultRoot, slug);
const [prompt, fixtureText, referenceHtml] = await Promise.all([
  readFile(resolve(benchmarkDir, 'prompt.md'), 'utf8'),
  readFile(resolve(root, 'examples/freeform-actions.ui.json'), 'utf8'),
  readFile(resolve(benchmarkDir, 'reference.html'), 'utf8'),
]);
const blueprint = JSON.parse(fixtureText);
const benchmarkInput = [
  prompt.trim(),
  '',
  '<implementation_report_template>',
  JSON.stringify(createImplementationReportTemplate(blueprint), null, 2),
  '</implementation_report_template>',
  '',
  '<blueprint_json>',
  fixtureText.trim(),
  '</blueprint_json>',
  '',
].join('\n');

await mkdir(resultDir, { recursive: true });
const execution = await run(command[0], command.slice(1), benchmarkInput, root);
await Promise.all([
  writeFile(resolve(resultDir, 'agent.stdout.txt'), execution.stdout, 'utf8'),
  writeFile(resolve(resultDir, 'agent.stderr.txt'), execution.stderr, 'utf8'),
]);
if (execution.code !== 0) {
  console.error(`${name} exited with code ${execution.code}. See ${resultDir}/agent.stderr.txt`);
  process.exit(execution.code || 1);
}

const output = extractOutput(execution.stdout);
await Promise.all([
  writeFile(resolve(resultDir, 'index.html'), output.html, 'utf8'),
  writeFile(resolve(resultDir, 'implementation-report.json'), `${JSON.stringify(output.implementation_report, null, 2)}\n`, 'utf8'),
  writeFile(resolve(resultDir, 'agent-output.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8'),
]);

const measurements = await measureImplementations({
  blueprint,
  candidateHtml: output.html,
  referenceHtml,
  resultDir,
});
const scoring = scoreImplementationBenchmark(
  blueprint,
  measurements.candidate,
  measurements.reference,
  output.implementation_report
);
const report = {
  agent: name,
  command: command.map(redactArgument),
  executed_at: new Date().toISOString(),
  ...scoring,
};
await Promise.all([
  writeFile(resolve(resultDir, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`, 'utf8'),
  writeFile(resolve(resultDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ready ? 0 : 1);

async function measureImplementations({ blueprint, candidateHtml, referenceHtml, resultDir }) {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(request.url?.startsWith('/reference') ? referenceHtml : candidateHtml);
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const chromePort = await reservePort();
  const chromeDir = await mkdtemp(resolve(tmpdir(), 'aub-benchmark-chrome-'));
  const chrome = spawn(findChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${chromeDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeError = '';
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', (chunk) => { chromeError += chunk; });

  try {
    const target = await openChromeTarget(chromePort);
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    try {
      await cdp.command('Page.enable');
      await cdp.command('Runtime.enable');
      const candidate = await measureDocument(cdp, blueprint, `http://127.0.0.1:${port}/candidate`, 'candidate', resultDir);
      const reference = await measureDocument(cdp, blueprint, `http://127.0.0.1:${port}/reference`, 'reference', resultDir);
      return { candidate, reference };
    } finally {
      cdp.close();
    }
  } catch (error) {
    throw new Error(`Chrome measurement failed: ${error.message}\n${chromeError.slice(-2000)}`);
  } finally {
    chrome.kill('SIGTERM');
    server.close();
    await rm(chromeDir, { recursive: true, force: true });
  }
}

async function measureDocument(cdp, blueprint, url, prefix, resultDir) {
  const result = {
    viewports: {},
    interactions: {},
    has_focus_visible: false,
  };
  for (const viewport of blueprint.viewports) {
    await cdp.command('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.id === 'mobile',
    });
    await cdp.command('Page.navigate', { url: `${url}?viewport=${viewport.id}` });
    await waitForDocument(cdp);
    const measurement = await evaluate(cdp, measurementExpression(blueprint.nodes.map((node) => node.id)));
    const screenshot = await cdp.command('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const screenshotBytes = Buffer.from(screenshot.data, 'base64');
    const screenshotName = `${prefix}-${viewport.id}.png`;
    await writeFile(resolve(resultDir, screenshotName), screenshotBytes);
    result.viewports[viewport.id] = {
      ...measurement,
      screenshot: screenshotName,
      screenshot_bytes: screenshotBytes.length,
    };
  }

  if (prefix === 'candidate') {
    await cdp.command('Emulation.setDeviceMetricsOverride', {
      width: blueprint.viewports[0].width,
      height: blueprint.viewports[0].height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.command('Page.navigate', { url });
    await waitForDocument(cdp);
    for (const interaction of blueprint.interactions) {
      result.interactions[interaction.source_node_id] = await evaluate(cdp, `(() => {
        const target = document.querySelector('[data-aub-node="${escapeJs(interaction.source_node_id)}"]');
        if (!target) return null;
        delete document.body.dataset.lastAction;
        target.click();
        return document.body.dataset.lastAction || null;
      })()`);
    }
    result.has_focus_visible = await evaluate(cdp, `Array.from(document.styleSheets).some((sheet) => {
      try { return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(':focus-visible')); }
      catch { return false; }
    })`);
  }
  return result;
}

function measurementExpression(nodeIds) {
  return `(() => {
    const ids = ${JSON.stringify(nodeIds)};
    const nodes = {};
    for (const id of ids) {
      const element = document.querySelector('[data-aub-node="' + id + '"]');
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      nodes[id] = {
        text: element.textContent || '',
        rect: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          z_index: Number(style.zIndex) || 0
        },
        styles: {
          position: style.position,
          display: style.display,
          flexDirection: style.flexDirection,
          rowGap: style.rowGap,
          columnGap: style.columnGap,
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          marginTop: style.marginTop,
          marginRight: style.marginRight,
          marginBottom: style.marginBottom,
          marginLeft: style.marginLeft,
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight
        },
        parent_node_id: element.parentElement?.closest('[data-aub-node]')?.getAttribute('data-aub-node') || null
      };
    }
    const root = document.querySelector('[data-aub-node="root"]');
    return {
      nodes,
      root_children: root ? Array.from(root.children).map((child) => child.getAttribute('data-aub-node')).filter(Boolean) : [],
      horizontal_overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      document_styles: {
        html: {
          backgroundColor: getComputedStyle(document.documentElement).backgroundColor,
        },
        body: {
          backgroundColor: getComputedStyle(document.body).backgroundColor,
        },
      },
    };
  })()`;
}

async function waitForDocument(cdp) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(cdp, `document.readyState === 'complete'`);
    if (ready) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error('Timed out waiting for benchmark document.');
}

async function evaluate(cdp, expression) {
  const response = await cdp.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? 'Runtime evaluation failed.');
  return response.result?.value;
}

async function openChromeTarget(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error('Timed out connecting to local Chrome.');
}

async function connectCdp(url) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This benchmark requires a Node.js runtime with global WebSocket support.');
  }
  const socket = new WebSocket(url);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result ?? {});
  });
  return {
    command(method, params = {}) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolveCommand, rejectCommand) => {
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

function reservePort() {
  const server = createServer();
  return new Promise((resolvePort, rejectPort) => {
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.AUB_CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'google-chrome',
    'chromium',
  ].filter(Boolean);
  const absolute = candidates.find((candidate) => candidate.startsWith('/') && existsSync(candidate));
  return absolute ?? candidates.find((candidate) => !candidate.startsWith('/')) ?? candidates[0];
}

function run(executable, commandArgs, stdin, cwd) {
  return new Promise((resolveRun, rejectRun) => {
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
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

function extractOutput(text) {
  const trimmed = text.trim();
  const candidates = [trimmed, trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const output = JSON.parse(candidate);
      if (isOutput(output)) return output;
    } catch {
      // Continue to balanced object extraction.
    }
  }
  for (let start = trimmed.indexOf('{'); start >= 0; start = trimmed.indexOf('{', start + 1)) {
    const candidate = balancedObjectAt(trimmed, start);
    if (!candidate) continue;
    try {
      const output = JSON.parse(candidate);
      if (isOutput(output)) return output;
    } catch {
      // Try the next opening brace.
    }
  }
  throw new Error('Agent output did not contain a JSON object with html and implementation_report.');
}

function isOutput(value) {
  return Boolean(value && typeof value.html === 'string' && value.implementation_report && typeof value.implementation_report === 'object');
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

function escapeJs(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function redactArgument(argument) {
  return /(?:key|token|secret|password)=/i.test(argument)
    ? argument.replace(/=.*/, '=REDACTED')
    : argument;
}
