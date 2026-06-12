import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const DENYLIST = [
  ['s', 'f', 'a', 'p'].join(''),
  ['S', 'F', 'A', 'P'].join(''),
  ['c', 't', 'b', 'c'].join(''),
  ['C', 'T', 'B', 'C'].join(''),
  ['C', '0', '1', '0', '0', '0', '0'].join(''),
  ['F', '0', '5', '0', '0', '0', '0'].join(''),
  ['T', '0', '1', '0', '0', '0', '0'].join(''),
  ['S', 'P', 'P', 'D', 'M'].join(''),
  ['C', 'S', 'Q', 'S', 'T'].join(''),
  ['M', 'o', 'b', 'i', 'l', 'e', ' ', 'D', 'o', 'c', 'u', 'm', 'e', 'n', 't', 's'].join(''),
  ['個', '人', '文', '件'].join(''),
  ['s', 'f', 'a', 'p', '-', 'w', 'e', 'b'].join(''),
  ['/', 'U', 's', 'e', 'r', 's', '/', 'h', '/', 'L', 'i', 'b', 'r', 'a', 'r', 'y'].join(''),
  ['/', 'U', 's', 'e', 'r', 's', '/', 'h', '/', 'W', 'o', 'r', 'k', 's', 'p', 'a', 'c', 'e', '/', 's'].join(''),
];
const TEXT_FILE_PATTERN = /\.(md|mdx|txt|json|ya?ml|mjs|mts|ts|tsx|js|jsx|css|scss|html)$/i;

test('DS1: committed text fixtures and docs do not contain local test-project identifiers', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root });
  const files = stdout
    .split('\n')
    .filter((file) => TEXT_FILE_PATTERN.test(file))
    .filter((file) => !file.includes('node_modules/'));
  const hits = [];
  for (const file of files) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const term of DENYLIST) {
      if (text.includes(term)) hits.push(`${file}: contains ${term}`);
    }
  }
  assert.deepEqual(hits, []);
});
