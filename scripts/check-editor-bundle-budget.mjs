#!/usr/bin/env node
import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const assetsDir = resolve(repoRoot, 'apps/editor/dist/assets');
const maxChunkBytes = Number(process.env.AUB_EDITOR_MAX_CHUNK_BYTES ?? 500 * 1024);

const entries = await readdir(assetsDir, { withFileTypes: true });
const jsChunks = [];

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const path = join(assetsDir, entry.name);
  const info = await stat(path);
  jsChunks.push({ path, bytes: info.size });
}

const offenders = jsChunks
  .filter((chunk) => chunk.bytes > maxChunkBytes)
  .sort((a, b) => b.bytes - a.bytes);

if (offenders.length > 0) {
  const limit = formatBytes(maxChunkBytes);
  const details = offenders
    .map((chunk) => `- ${relative(repoRoot, chunk.path)}: ${formatBytes(chunk.bytes)} > ${limit}`)
    .join('\n');
  throw new Error(`Editor bundle budget exceeded:\n${details}`);
}

console.log(`Editor bundle budget ok: ${jsChunks.length} JS chunks, max ${formatBytes(maxChunkBytes)}.`);

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
