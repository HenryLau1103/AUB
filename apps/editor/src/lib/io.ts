// Helpers for download-as-file in the browser.

import type { Blueprint } from '../types';
import type { PersonalTemplate } from './personal-templates';
import implementationReportSchema from '../../../../schema/implementation-report.schema.json';
import blueprintSchema from '../../../../schema/ui-blueprint.schema.json';
import componentRegistry from '../../../../schema/registry/components.json';
import canonicalExample from '../../../../examples/dashboard.ui.json';
import { migrateBlueprint } from '../../../../scripts/migrate-blueprint.mjs';

export function downloadBlob(filename: string, content: BlobPart | Blob, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsText(file);
  });
}

export async function downloadHandoffPackage(
  blueprint: Blueprint,
  markdown: string,
  agentPrompt: string,
  reportTemplate: Record<string, unknown>,
  viewportImages: Record<string, string>
): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const json = `${JSON.stringify(blueprint, null, 2)}\n`;
  const files: Record<string, string | Uint8Array> = {
    [`${blueprint.screen.id}.ui.json`]: json,
    [`${blueprint.screen.id}.ui.md`]: markdown,
    [`${blueprint.screen.id}.codex.md`]: agentPrompt,
    'implementation-report.template.json': `${JSON.stringify(reportTemplate, null, 2)}\n`,
    'implementation-report.schema.json': `${JSON.stringify(implementationReportSchema, null, 2)}\n`,
  };

  for (const [viewportId, dataUrl] of Object.entries(viewportImages)) {
    files[`screenshots/${viewportId}.png`] = dataUrlToBytes(dataUrl);
  }

  const manifestFiles: Record<string, { sha256: string; bytes: number }> = {};
  for (const [path, content] of Object.entries(files)) {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    manifestFiles[path] = {
      sha256: await sha256(bytes),
      bytes: bytes.byteLength,
    };
    zip.file(path, content);
  }

  zip.file('manifest.json', `${JSON.stringify({
    format: 'aub-handoff',
    format_version: '1.0.0',
    blueprint_version: blueprint.version,
    screen_id: blueprint.screen.id,
    generated_at: new Date().toISOString(),
    viewports: blueprint.viewports,
    files: manifestFiles,
  }, null, 2)}\n`);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(`${blueprint.screen.id}.aub.zip`, blob, 'application/zip');
}

export async function downloadAuthoringKit(): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const files: Record<string, string> = {
    'AUTHORING.md': authoringGuide(),
    'ui-blueprint.schema.json': `${JSON.stringify(blueprintSchema, null, 2)}\n`,
    'components.json': `${JSON.stringify(componentRegistry, null, 2)}\n`,
    'examples/canonical.ui.json': `${JSON.stringify(migrateBlueprint(canonicalExample), null, 2)}\n`,
    'prompts/author.md': authorPrompt(),
    'VALIDATE.md': '# Validation\n\nRun `pnpm validate path/to/screen.ui.json` from the AUB repository. The command must exit with status 0.\n',
  };
  const manifestFiles: Record<string, { sha256: string; bytes: number }> = {};
  for (const [path, content] of Object.entries(files)) {
    const bytes = new TextEncoder().encode(content);
    manifestFiles[path] = { sha256: await sha256(bytes), bytes: bytes.byteLength };
    zip.file(path, content);
  }
  zip.file('manifest.json', `${JSON.stringify({
    format: 'aub-authoring-kit',
    format_version: '1.0.0',
    blueprint_version: '0.3.0',
    files: manifestFiles,
  }, null, 2)}\n`);
  downloadBlob('aub-authoring-kit.zip', await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'application/zip');
}

export async function downloadPersonalTemplatePackage(template: PersonalTemplate): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const payload = `${JSON.stringify({ format: 'aub-personal-template', format_version: '1.0.0', template }, null, 2)}\n`;
  zip.file('template.json', payload);
  if (template.preview) zip.file('preview.png', dataUrlToBytes(template.preview));
  zip.file('manifest.json', `${JSON.stringify({
    format: 'aub-personal-template',
    format_version: '1.0.0',
    template_id: template.id,
    files: {
      'template.json': { sha256: await sha256(new TextEncoder().encode(payload)), bytes: new TextEncoder().encode(payload).byteLength },
    },
  }, null, 2)}\n`);
  downloadBlob(`${safeFilename(template.name)}.aub-template.zip`, await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'application/zip');
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const buffer = await crypto.subtle.digest('SHA-256', stableBytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function authoringGuide() {
  return `# AUB Blueprint Authoring

1. Use only component types declared in components.json.
2. Create exactly one root node with parent_id set to null.
3. Keep parent_id and children links bidirectionally consistent.
4. Use auto layout unless exact per-viewport geometry is known.
5. Declare interactions, responsive rules, and at least five acceptance items.
6. Include layout, interaction, responsive, and accessibility acceptance categories.
7. Record unresolved decisions in screen.notes instead of guessing.
8. Return JSON only when a machine-readable Blueprint is requested.
`;
}

function authorPrompt() {
  return `Create an AUB UI Blueprint from the supplied screen requirements.

Read AUTHORING.md, components.json, ui-blueprint.schema.json, and the canonical example.
Return one complete JSON object using only registered component types.
Do not omit hierarchy, layout, interactions, responsive rules, or acceptance criteria.
If evidence is incomplete, record the uncertainty in screen.notes instead of inventing behavior.
Validate the result before returning it.
`;
}

function safeFilename(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'template';
}
