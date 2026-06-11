export interface BlueprintDiff {
  before: { version: string; screen_id: string; screen_name: string };
  after: { version: string; screen_id: string; screen_name: string };
  summary: Record<string, number>;
  screen_changes: string[];
  nodes: Record<string, any[]>;
  interactions: Record<string, any[]>;
  responsive: Record<string, any[]>;
  acceptance: Record<string, any[]>;
  viewports: Record<string, any[]>;
  design_system_changes: string[];
}

export function diffBlueprints(
  before: Record<string, any>,
  after: Record<string, any>
): BlueprintDiff;
export function renderBlueprintDiff(diff: BlueprintDiff): string;
