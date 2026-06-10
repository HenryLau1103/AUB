import type { Blueprint } from '../types';
import type { Language } from './i18n';

const DRAFT_KEY = 'aub.editor.active-draft.v1';

export interface StoredDraft {
  blueprint: Blueprint;
  language: Language;
  savedAt: string;
}

export function loadDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredDraft>;
    if (!value.blueprint || typeof value.savedAt !== 'string') return null;
    return {
      blueprint: value.blueprint,
      language: value.language === 'en' ? 'en' : 'zh-Hant',
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveDraft(blueprint: Blueprint, language: Language): string {
  const savedAt = new Date().toISOString();
  const value: StoredDraft = { blueprint, language, savedAt };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
  return savedAt;
}

export function clearDraft(): void {
  window.localStorage.removeItem(DRAFT_KEY);
}
