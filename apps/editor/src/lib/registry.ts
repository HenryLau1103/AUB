import registry from '../../../../schema/registry/components.json';
import type { ResolvedComponentType } from '../types';

interface RegistryType {
  name: ResolvedComponentType;
  displayName: string;
  isContainer: boolean;
  description: string;
}

interface RegistryCategory {
  id: string;
  name: string;
  description: string;
  types: RegistryType[];
}

interface Registry {
  categories: RegistryCategory[];
}

const reg = registry as Registry;

const CUSTOM_CATEGORY_ID = 'extensions';
const CUSTOM_CATEGORY_NAME = 'Extensions';
const CUSTOM_CATEGORY_DESCRIPTION = 'Project-specific namespaced extension components.';
let extensionComponents: RegistryType[] = [];
const EXTENSION_TYPE_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9_]*$/;

function normalizeExtensionTypeName(value: unknown): ResolvedComponentType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !EXTENSION_TYPE_PATTERN.test(normalized)) {
    return null;
  }
  return normalized as ResolvedComponentType;
}

function normalizeDisplayName(value: unknown, fallback: string): string {
  const source = typeof value === 'string' ? value.trim() : '';
  return source || fallback;
}

export function getCategories(): RegistryCategory[] {
  const categories: RegistryCategory[] = [...reg.categories];
  if (extensionComponents.length > 0) {
    categories.push({
      id: CUSTOM_CATEGORY_ID,
      name: CUSTOM_CATEGORY_NAME,
      description: CUSTOM_CATEGORY_DESCRIPTION,
      types: extensionComponents.map((candidate) => ({
        ...candidate,
        displayName: candidate.displayName || candidate.name,
      })),
    });
  }
  return categories;
}

export function getTypeMeta(name: ResolvedComponentType): RegistryType | undefined {
  for (const cat of reg.categories) {
    const t = cat.types.find((tt) => tt.name === name);
    if (t) return t;
  }
  if (name.includes(':')) {
    return extensionComponents.find((candidate) => candidate.name === name);
  }
  return undefined;
}

export function isContainerType(name: ResolvedComponentType): boolean {
  return getTypeMeta(name)?.isContainer ?? false;
}

export function setExtensionRegistry(raw: string | null): void {
  if (!raw) {
    extensionComponents = [];
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid registry JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AUB registry must be a JSON object.');
  }

  if (!('components' in parsed) || !Array.isArray((parsed as { components?: unknown }).components)) {
    throw new Error('AUB registry must define "components" as an array.');
  }

  const { components } = parsed as { components: unknown[] };
  const unique = new Set<string>();
  const next: RegistryType[] = [];

  for (const candidate of components) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('Each registry component entry must be an object.');
    }
    const value = candidate as {
      name?: unknown;
      isContainer?: unknown;
      displayName?: unknown;
      description?: unknown;
    };
    const name = normalizeExtensionTypeName(value.name);
    if (!name) {
      throw new Error(`Invalid extension component name: ${String(value.name)}`);
    }
    if (unique.has(name)) {
      throw new Error(`Duplicate extension component name: ${name}`);
    }
    if (!candidate || typeof value.isContainer !== 'boolean') {
      throw new Error(`Extension component "${name}" must declare isContainer as boolean.`);
    }
    unique.add(name);
    next.push({
      name,
      displayName: normalizeDisplayName(value.displayName, name.split(':')[1] ?? name),
      isContainer: value.isContainer,
      description: normalizeDisplayName(value.description, `Extension component ${name}`),
    });
  }

  extensionComponents = next.sort((a, b) => a.name.localeCompare(b.name));
}
