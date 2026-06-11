export interface BlueprintLock {
  $schema: string;
  version: string;
  source_file: string;
  exported_at: string;
  source_editor_version: string;
  hashes: Record<string, string>;
  counts: {
    nodes: number;
    interactions: number;
    responsive: number;
    acceptance: number;
  };
}

export function createBlueprintLock(
  blueprint: Record<string, any>,
  options?: {
    sourceFile?: string;
    exportedAt?: string;
    sourceEditorVersion?: string;
  }
): BlueprintLock;
