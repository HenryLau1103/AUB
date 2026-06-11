import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'brand');
const targets = [
  resolve(root, 'site/assets/brand'),
  resolve(root, 'apps/editor/public/brand'),
];
const files = [
  'aub-logo-mark.svg',
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'app-icon-192.png',
  'app-icon-512.png',
  'app-icon-1024.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'mstile-150x150.png',
  'safari-pinned-tab.svg',
  'maskable-icon-512.png',
];

for (const target of targets) {
  await mkdir(target, { recursive: true });
  await Promise.all(files.map((file) => copyFile(resolve(source, file), resolve(target, file))));
}

console.log(`Synced ${files.length} brand assets to ${targets.length} deploy targets.`);
