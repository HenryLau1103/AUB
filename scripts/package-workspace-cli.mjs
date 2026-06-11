#!/usr/bin/env node
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(repoRoot, 'packages', 'workspace-cli');
const vendorRoot = join(packageRoot, 'vendor', 'aub');

async function assertDir(path, label) {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
  } catch {
    throw new Error(`${label} is missing. Build first with: pnpm workspace:package`);
  }
}

await assertDir(join(repoRoot, 'apps', 'mcp-server', 'dist'), 'MCP server dist');
await assertDir(join(repoRoot, 'apps', 'editor', 'dist'), 'Editor dist');

await rm(vendorRoot, { recursive: true, force: true });
await mkdir(vendorRoot, { recursive: true });

await cp(join(repoRoot, 'schema'), join(vendorRoot, 'schema'), { recursive: true });
await cp(join(repoRoot, 'scripts'), join(vendorRoot, 'scripts'), { recursive: true });
await mkdir(join(vendorRoot, 'docs'), { recursive: true });
await cp(join(repoRoot, 'docs', 'agent-handoff.md'), join(vendorRoot, 'docs', 'agent-handoff.md'));
await cp(join(repoRoot, 'docs', 'agent-handoff.zh-Hant.md'), join(vendorRoot, 'docs', 'agent-handoff.zh-Hant.md'));
await cp(join(repoRoot, 'docs', 'template-authoring-agent.md'), join(vendorRoot, 'docs', 'template-authoring-agent.md'));
await cp(join(repoRoot, 'apps', 'mcp-server', 'dist'), join(vendorRoot, 'apps', 'mcp-server', 'dist'), { recursive: true });
await cp(join(repoRoot, 'apps', 'editor', 'dist'), join(vendorRoot, 'apps', 'editor', 'dist'), { recursive: true });

console.error(`Prepared aub-workspace vendor payload at ${vendorRoot}`);
