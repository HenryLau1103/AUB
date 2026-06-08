import registry from '../../../../schema/registry/components.json';
import type { ComponentType } from '../types';

interface RegistryType {
  name: ComponentType;
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

export function getCategories(): RegistryCategory[] {
  return reg.categories;
}

export function getTypeMeta(name: ComponentType): RegistryType | undefined {
  for (const cat of reg.categories) {
    const t = cat.types.find((tt) => tt.name === name);
    if (t) return t;
  }
  return undefined;
}

export function isContainerType(name: ComponentType): boolean {
  return getTypeMeta(name)?.isContainer ?? false;
}
