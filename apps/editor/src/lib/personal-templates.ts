import type { Blueprint } from '../types';

const STORAGE_KEY = 'aub.personal-templates.v1';

export interface PersonalTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  blueprint: Blueprint;
  preview?: string;
  importSummary?: {
    score: number;
    warnings: number;
    sourceKind?: string;
  };
}

export function loadPersonalTemplates(): PersonalTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isPersonalTemplate) : [];
  } catch {
    return [];
  }
}

export function savePersonalTemplate(template: PersonalTemplate): PersonalTemplate[] {
  const current = loadPersonalTemplates();
  const next = [template, ...current.filter((item) => item.id !== template.id)].slice(0, 40);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deletePersonalTemplate(id: string): PersonalTemplate[] {
  const next = loadPersonalTemplates().filter((template) => template.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createPersonalTemplate(
  name: string,
  blueprint: Blueprint,
  preview?: string,
  importSummary?: PersonalTemplate['importSummary']
): PersonalTemplate {
  const now = new Date().toISOString();
  return {
    id: `personal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || blueprint.screen.name,
    createdAt: now,
    updatedAt: now,
    blueprint: structuredClone(blueprint),
    preview,
    importSummary,
  };
}

export async function readPersonalTemplateFile(file: File): Promise<PersonalTemplate> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find((candidate) => /template\.json$/i.test(candidate.name));
    if (!entry) throw new Error('Template ZIP does not contain template.json.');
    return parsePersonalTemplate(await entry.async('string'));
  }
  return parsePersonalTemplate(await file.text());
}

function parsePersonalTemplate(text: string): PersonalTemplate {
  const parsed = JSON.parse(text);
  const template = parsed?.format === 'aub-personal-template' ? parsed.template : parsed;
  if (!isPersonalTemplate(template)) throw new Error('Invalid AUB personal template.');
  return template;
}

function isPersonalTemplate(value: unknown): value is PersonalTemplate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && Boolean(candidate.blueprint)
    && typeof candidate.blueprint === 'object';
}
