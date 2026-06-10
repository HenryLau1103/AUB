import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Walk up from this module to find the AUB repository root (the directory that
// owns schema/ui-blueprint.schema.json). Works from both src/ and dist/ layouts.
export function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'schema', 'ui-blueprint.schema.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not locate AUB repo root (schema/ui-blueprint.schema.json not found).');
}
