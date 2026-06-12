import JSZip from 'jszip';

export const HANDOFF_FORMAT_VERSION = '1.2.0';
export const HANDOFF_AGENT_ENTRYPOINT = 'AGENT-README.md';
const SAFE_ZIP_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export async function createHandoffArchive({
  blueprint,
  markdown,
  genericPrompt,
  codexPrompt,
  agentGuide,
  agentGuideZhHant,
  reportTemplate,
  reportSchema,
  viewportImages,
  extensionRegistry,
  generatedAt = new Date().toISOString(),
}) {
  const zip = new JSZip();
  const screenId = blueprint.screen.id;
  const hasExtensionRegistry = typeof extensionRegistry === 'string' && extensionRegistry.trim().length > 0;
  const agentGuideText = agentGuide.replace('./agent-handoff.zh-Hant.md', './AGENT-README.zh-Hant.md');
  const files = {
    [HANDOFF_AGENT_ENTRYPOINT]: ensureTrailingNewline(
      hasExtensionRegistry ? appendExtensionRegistryNote(agentGuideText) : agentGuideText
    ),
    'AGENT-README.zh-Hant.md': ensureTrailingNewline(
      agentGuideZhHant.replace('./agent-handoff.md', './AGENT-README.md')
    ),
    [`${screenId}.ui.json`]: `${JSON.stringify(blueprint, null, 2)}\n`,
    [`${screenId}.ui.md`]: ensureTrailingNewline(markdown),
    [`${screenId}.agent.md`]: ensureTrailingNewline(genericPrompt),
    [`${screenId}.codex.md`]: ensureTrailingNewline(codexPrompt),
    'implementation-report.template.json': `${JSON.stringify(reportTemplate, null, 2)}\n`,
    'implementation-report.schema.json': `${JSON.stringify(reportSchema, null, 2)}\n`,
  };

  if (hasExtensionRegistry) {
    files['aub.registry.json'] = ensureTrailingNewline(extensionRegistry);
  }

  for (const [viewportId, dataUrl] of Object.entries(viewportImages)) {
    assertSafeZipSegment(viewportId, 'viewport id');
    files[`screenshots/${viewportId}.png`] = dataUrlToBytes(dataUrl);
  }

  const manifestFiles = {};
  for (const [path, content] of Object.entries(files)) {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    manifestFiles[path] = {
      sha256: await sha256(bytes),
      bytes: bytes.byteLength,
    };
    zip.file(path, content);
  }

  const manifest = {
    format: 'aub-handoff',
    format_version: HANDOFF_FORMAT_VERSION,
    blueprint_version: blueprint.version,
    screen_id: screenId,
    generated_at: generatedAt,
    agent_entrypoint: HANDOFF_AGENT_ENTRYPOINT,
    extension_registry: hasExtensionRegistry ? 'aub.registry.json' : null,
    viewports: blueprint.viewports,
    files: manifestFiles,
  };
  zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    bytes: await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
    manifest,
  };
}

function assertSafeZipSegment(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value === '.' ||
    value === '..' ||
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    !SAFE_ZIP_SEGMENT_PATTERN.test(value)
  ) {
    throw new Error(`Unsafe ${label}: ${String(value)}`);
  }
}

function appendExtensionRegistryNote(agentGuide) {
  const note = [
    '',
    '## Custom component types',
    '',
    'This handoff includes `aub.registry.json`, which declares namespaced extension',
    'component types (`team:component`) used by this blueprint. Treat every node `type`',
    'that contains a colon as a project-defined component: resolve its meaning and',
    'container/leaf behavior from `aub.registry.json` — never guess. When an entry',
    'declares `implementations`, reuse the matching production component, import path,',
    'and prop mappings instead of recreating it. Validate with',
    '`aub validate <file> --registry ./aub.registry.json`.',
    '',
  ].join('\n');
  return `${agentGuide.replace(/\n+$/, '')}\n${note}`;
}

function ensureTrailingNewline(value) {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(bytes) {
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const buffer = await crypto.subtle.digest('SHA-256', stableBytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
