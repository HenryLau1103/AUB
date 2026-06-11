import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  { id: 'en', path: 'site/index.html', lang: 'en', editor: './editor/' },
  { id: 'zh-hant', path: 'site/zh-hant/index.html', lang: 'zh-Hant', editor: '../editor/' },
  { id: 'zh-hans', path: 'site/zh-hans/index.html', lang: 'zh-Hans', editor: '../editor/' },
  { id: 'ja', path: 'site/ja/index.html', lang: 'ja', editor: '../editor/' },
  { id: 'ko', path: 'site/ko/index.html', lang: 'ko', editor: '../editor/' },
];

const readmes = [
  'README.md',
  'README.zh-Hant.md',
  'README.zh-Hans.md',
  'README.ja.md',
  'README.ko.md',
];

test('L10N1: five localized Pages outputs declare language, alternates, and safe editor links', async () => {
  for (const page of pages) {
    const html = await readFile(page.path, 'utf8');
    assert.match(html, new RegExp(`<html lang="${page.lang}">`), page.path);
    assert.match(html, new RegExp(`href="${page.editor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), page.path);
    assert.equal((html.match(/rel="alternate" hreflang=/g) ?? []).length, 6, page.path);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, page.path);
    assert.match(html, /<strong>16<\/strong>/, page.path);
    assert.match(html, /Figma[／/]Penpot/, page.path);
  }
});

test('L10N2: every README exposes all languages and current product contracts', async () => {
  const requiredLinks = readmes.map((path) => `./${path}`);
  for (const path of readmes) {
    const markdown = await readFile(path, 'utf8');
    for (const link of requiredLinks.filter((link) => link !== `./${path}`)) {
      assert.ok(markdown.includes(link), `${path} missing ${link}`);
    }
    assert.match(markdown, /0\.3\.0/, path);
    assert.match(markdown, /16/, path);
    assert.match(markdown, /Streamable HTTP/, path);
    assert.match(markdown, /Figma[／/]Penpot/, path);
    assert.match(markdown, /HenryLau1103\/AUB@main/, path);
  }
});
