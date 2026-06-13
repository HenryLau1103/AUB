import JSZip from 'jszip';

export const HANDOFF_FORMAT_VERSION = '1.2.0';
export const HANDOFF_AGENT_ENTRYPOINT = 'AGENT-README.md';
const SAFE_ZIP_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_VIEWPORT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_VIEWPORT_IMAGE_BYTES = 32 * 1024 * 1024;

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

  let totalViewportImageBytes = 0;
  for (const [viewportId, dataUrl] of Object.entries(viewportImages)) {
    assertSafeZipSegment(viewportId, 'viewport id');
    if (!blueprint.viewports?.some((viewport) => viewport.id === viewportId)) {
      throw new Error(`Unknown viewport id: ${viewportId}`);
    }
    const estimatedImageBytes = estimatePngDataUrlBytes(dataUrl, viewportId);
    if (estimatedImageBytes > MAX_VIEWPORT_IMAGE_BYTES) {
      throw new Error(`Viewport ${viewportId} screenshot exceeds maximum size of ${MAX_VIEWPORT_IMAGE_BYTES} bytes.`);
    }
    if (totalViewportImageBytes + estimatedImageBytes > MAX_TOTAL_VIEWPORT_IMAGE_BYTES) {
      throw new Error(`Viewport screenshots exceed maximum total size of ${MAX_TOTAL_VIEWPORT_IMAGE_BYTES} bytes.`);
    }
    const imageBytes = pngDataUrlToBytes(dataUrl, viewportId);
    totalViewportImageBytes += imageBytes.byteLength;
    if (totalViewportImageBytes > MAX_TOTAL_VIEWPORT_IMAGE_BYTES) {
      throw new Error(`Viewport screenshots exceed maximum total size of ${MAX_TOTAL_VIEWPORT_IMAGE_BYTES} bytes.`);
    }
    files[`screenshots/${viewportId}.png`] = imageBytes;
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

function pngDataUrlToBytes(dataUrl, viewportId) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl));
  if (!match) {
    throw new Error(`Viewport ${viewportId} screenshot must be a PNG data URL.`);
  }
  const bytes = base64ToBytes(match[1]);
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < pngSignature.length || !pngSignature.every((byte, index) => bytes[index] === byte)) {
    throw new Error(`Viewport ${viewportId} screenshot is not a PNG.`);
  }
  return bytes;
}

function estimatePngDataUrlBytes(dataUrl, viewportId) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl));
  if (!match) {
    throw new Error(`Viewport ${viewportId} screenshot must be a PNG data URL.`);
  }
  const base64 = match[1];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function base64ToBytes(base64) {
  if (typeof globalThis.atob === 'function') {
    return Uint8Array.from(globalThis.atob(base64), (ch) => ch.charCodeAt(0));
  }
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
  throw new Error('Base64 decoder is unavailable.');
}

async function sha256(bytes) {
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const buffer = await crypto.subtle.digest('SHA-256', stableBytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
