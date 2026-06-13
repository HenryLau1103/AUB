import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { exportMarkdown } from '../scripts/export-md.lib.mjs';
import { exportAgentPrompt } from '../scripts/export-agent-prompt.lib.mjs';
import { createImplementationReportTemplate } from '../scripts/implementation-report.lib.mjs';
import {
  createHandoffArchive,
  HANDOFF_AGENT_ENTRYPOINT,
  HANDOFF_FORMAT_VERSION,
} from '../scripts/handoff-package.lib.mjs';

const BLUEPRINT_URL = new URL('../examples/freeform-actions.ui.json', import.meta.url);
const REPORT_SCHEMA_URL = new URL('../schema/implementation-report.schema.json', import.meta.url);
const GUIDE_URL = new URL('../docs/agent-handoff.md', import.meta.url);
const GUIDE_ZH_URL = new URL('../docs/agent-handoff.zh-Hant.md', import.meta.url);

test('HP1: current handoff package contains agent entrypoints and preserves legacy files', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  const agentGuide = await readFile(GUIDE_URL, 'utf8');
  const agentGuideZhHant = await readFile(GUIDE_ZH_URL, 'utf8');
  const screenId = blueprint.screen.id;
  const { bytes, manifest } = await createHandoffArchive({
    blueprint,
    markdown: exportMarkdown(blueprint),
    genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
    codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
    agentGuide,
    agentGuideZhHant,
    reportTemplate: createImplementationReportTemplate(blueprint),
    reportSchema,
    viewportImages: {
      desktop: 'data:image/png;base64,iVBORw0KGgo=',
    },
    generatedAt: '2026-06-10T00:00:00.000Z',
  });

  assert.equal(manifest.format_version, HANDOFF_FORMAT_VERSION);
  assert.equal(manifest.agent_entrypoint, HANDOFF_AGENT_ENTRYPOINT);

  const zip = await JSZip.loadAsync(bytes);
  const required = [
    'AGENT-README.md',
    'AGENT-README.zh-Hant.md',
    `${screenId}.ui.json`,
    `${screenId}.ui.md`,
    `${screenId}.agent.md`,
    `${screenId}.codex.md`,
    'implementation-report.template.json',
    'implementation-report.schema.json',
    'screenshots/desktop.png',
    'manifest.json',
  ];
  for (const path of required) assert.ok(zip.file(path), `Missing ${path}`);

  const genericPrompt = await zip.file(`${screenId}.agent.md`).async('string');
  assert.ok(genericPrompt.includes('Generic coding agent'));
  const codexPrompt = await zip.file(`${screenId}.codex.md`).async('string');
  assert.ok(codexPrompt.includes('Read every applicable AGENTS.md'));
  const packagedGuide = await zip.file('AGENT-README.md').async('string');
  assert.ok(packagedGuide.includes('./AGENT-README.zh-Hant.md'));
  const packagedGuideZhHant = await zip.file('AGENT-README.zh-Hant.md').async('string');
  assert.ok(packagedGuideZhHant.includes('./AGENT-README.md'));
});

test('HP2: manifest byte counts and SHA-256 hashes match every packaged file', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  const { bytes, manifest } = await createHandoffArchive({
    blueprint,
    markdown: exportMarkdown(blueprint),
    genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
    codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
    agentGuide: await readFile(GUIDE_URL, 'utf8'),
    agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
    reportTemplate: createImplementationReportTemplate(blueprint),
    reportSchema,
    viewportImages: {},
  });
  const zip = await JSZip.loadAsync(bytes);

  for (const [path, expected] of Object.entries(manifest.files)) {
    const content = await zip.file(path).async('uint8array');
    assert.equal(content.byteLength, expected.bytes, `${path} byte count`);
    assert.equal(createHash('sha256').update(content).digest('hex'), expected.sha256, `${path} hash`);
  }
});

test('HP2b: screenshot data URL decoding prefers the browser atob path', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  const originalAtob = globalThis.atob;
  let atobCalled = false;
  try {
    globalThis.atob = (value) => {
      atobCalled = true;
      return originalAtob(value);
    };
    const { bytes } = await createHandoffArchive({
      blueprint,
      markdown: exportMarkdown(blueprint),
      genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
      codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
      agentGuide: await readFile(GUIDE_URL, 'utf8'),
      agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
      reportTemplate: createImplementationReportTemplate(blueprint),
      reportSchema,
      viewportImages: {
        desktop: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });
    const zip = await JSZip.loadAsync(bytes);
    assert.ok(zip.file('screenshots/desktop.png'));
    assert.equal(atobCalled, true);
  } finally {
    globalThis.atob = originalAtob;
  }
});

test('HP3: handoff bundles aub.registry.json and references it when extensions are provided', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  const extensionRegistry = JSON.stringify(
    {
      version: '0.1.0',
      components: [
        {
          name: 'acme:data_card',
          isContainer: true,
          implementations: [
            {
              id: 'react',
              framework: 'react',
              module: '@acme/ui',
              export: 'DataCard',
            },
          ],
        },
      ],
    },
    null,
    2
  );
  const { bytes, manifest } = await createHandoffArchive({
    blueprint,
    markdown: exportMarkdown(blueprint),
    genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
    codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
    agentGuide: await readFile(GUIDE_URL, 'utf8'),
    agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
    reportTemplate: createImplementationReportTemplate(blueprint),
    reportSchema,
    viewportImages: {},
    extensionRegistry,
  });

  assert.equal(manifest.extension_registry, 'aub.registry.json');
  const zip = await JSZip.loadAsync(bytes);
  assert.ok(zip.file('aub.registry.json'), 'registry file missing from package');
  const packagedRegistry = await zip.file('aub.registry.json').async('string');
  assert.ok(packagedRegistry.includes('acme:data_card'));
  const guide = await zip.file('AGENT-README.md').async('string');
  assert.ok(guide.includes('Custom component types'));
  assert.ok(guide.includes('aub.registry.json'));
  assert.ok(guide.includes('production component'));
  assert.ok(guide.includes('prop mappings'));
});

test('HP4: handoff omits the registry and sets null when no extensions are provided', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  const { bytes, manifest } = await createHandoffArchive({
    blueprint,
    markdown: exportMarkdown(blueprint),
    genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
    codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
    agentGuide: await readFile(GUIDE_URL, 'utf8'),
    agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
    reportTemplate: createImplementationReportTemplate(blueprint),
    reportSchema,
    viewportImages: {},
  });
  assert.equal(manifest.extension_registry, null);
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(zip.file('aub.registry.json'), null);
});

test('HP5: handoff rejects traversal-style viewport screenshot ids', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  await assert.rejects(
    async () => createHandoffArchive({
      blueprint,
      markdown: exportMarkdown(blueprint),
      genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
      codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
      agentGuide: await readFile(GUIDE_URL, 'utf8'),
      agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
      reportTemplate: createImplementationReportTemplate(blueprint),
      reportSchema,
      viewportImages: {
        '../../evil': 'data:image/png;base64,iVBORw0KGgo=',
      },
    }),
    /Unsafe viewport id/
  );
});

test('HP6: handoff rejects screenshots for undeclared viewports', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  await assert.rejects(
    async () => createHandoffArchive({
      blueprint,
      markdown: exportMarkdown(blueprint),
      genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
      codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
      agentGuide: await readFile(GUIDE_URL, 'utf8'),
      agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
      reportTemplate: createImplementationReportTemplate(blueprint),
      reportSchema,
      viewportImages: {
        desktop_extra: 'data:image/png;base64,iVBORw0KGgo=',
      },
    }),
    /Unknown viewport id: desktop_extra/
  );
});

test('HP7: handoff rejects non-PNG screenshot data URLs', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  await assert.rejects(
    async () => createHandoffArchive({
      blueprint,
      markdown: exportMarkdown(blueprint),
      genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
      codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
      agentGuide: await readFile(GUIDE_URL, 'utf8'),
      agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
      reportTemplate: createImplementationReportTemplate(blueprint),
      reportSchema,
      viewportImages: {
        desktop: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      },
    }),
    /must be a PNG data URL/
  );
  await assert.rejects(
    async () => createHandoffArchive({
      blueprint,
      markdown: exportMarkdown(blueprint),
      genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
      codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
      agentGuide: await readFile(GUIDE_URL, 'utf8'),
      agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
      reportTemplate: createImplementationReportTemplate(blueprint),
      reportSchema,
      viewportImages: {
        desktop: 'data:image/png;base64,ZmFrZQ==',
      },
    }),
    /is not a PNG/
  );
});

test('HP8: handoff rejects oversized viewport screenshots', async () => {
  const blueprint = JSON.parse(await readFile(BLUEPRINT_URL, 'utf8'));
  const reportSchema = JSON.parse(await readFile(REPORT_SCHEMA_URL, 'utf8'));
  const pngBytes = new Uint8Array(8 * 1024 * 1024 + 9);
  pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  await assert.rejects(
    async () => createHandoffArchive({
      blueprint,
      markdown: exportMarkdown(blueprint),
      genericPrompt: exportAgentPrompt(blueprint, { adapter: 'generic', task: 'implement' }),
      codexPrompt: exportAgentPrompt(blueprint, { adapter: 'codex', task: 'implement' }),
      agentGuide: await readFile(GUIDE_URL, 'utf8'),
      agentGuideZhHant: await readFile(GUIDE_ZH_URL, 'utf8'),
      reportTemplate: createImplementationReportTemplate(blueprint),
      reportSchema,
      viewportImages: {
        desktop: `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`,
      },
    }),
    /screenshot exceeds maximum size/
  );
});
