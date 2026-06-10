export type Blueprint = Record<string, any>;

export interface KnownTypeMeta {
  isContainer: boolean;
  source?: string;
}

export type KnownTypes = Map<string, KnownTypeMeta>;

export function validateBlueprintSemantics(
  blueprint: Blueprint,
  options?: { knownTypes?: KnownTypes }
): string[];
export function resolvePlacement(node: Record<string, any>, viewportId: string): Record<string, any> | null;
