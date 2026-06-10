export type Blueprint = Record<string, any>;

export type ScaffoldSection = 'interactions' | 'responsive' | 'acceptance';
export type ScaffoldLanguage = 'en' | 'zh-Hant';

export interface ScaffoldOptions {
  sections?: ScaffoldSection[];
  language?: ScaffoldLanguage;
}

export interface ScaffoldSummary {
  interactions: number;
  responsive: number;
  acceptance: number;
  total: number;
}

export const SCAFFOLD_SECTIONS: ScaffoldSection[];

export function scaffoldInteractions(
  blueprint: Blueprint,
  options?: { language?: ScaffoldLanguage }
): { interactions: any[]; added: any[] };

export function scaffoldResponsive(
  blueprint: Blueprint,
  options?: { language?: ScaffoldLanguage }
): { responsive: any[]; added: any[] };

export function scaffoldAcceptance(
  blueprint: Blueprint,
  options?: { language?: ScaffoldLanguage }
): { acceptance: any[]; added: any[] };

export function scaffoldBlueprint(
  blueprint: Blueprint,
  options?: ScaffoldOptions
): { blueprint: Blueprint; summary: ScaffoldSummary };
