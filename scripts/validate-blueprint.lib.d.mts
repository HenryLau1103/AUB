export type Blueprint = Record<string, any>;

export function validateBlueprintSemantics(blueprint: Blueprint): string[];
export function resolvePlacement(node: Record<string, any>, viewportId: string): Record<string, any> | null;
