import type { Blueprint, DesignSystem } from '../schema/types.js';

export const CURRENT_VERSION: string;
export function migrateBlueprint(input: unknown): Blueprint;
export function defaultDesignSystem(): DesignSystem;
