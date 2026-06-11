import type { Blueprint } from '../schema/types.js';

export interface DesignBridgeSource {
  kind: 'figma' | 'penpot';
  document_id: string;
  page_id?: string;
  frame_id: string;
  url?: string;
  exported_at?: string;
}

export interface DesignBridgeDocument {
  format: 'aub-design-bridge';
  version: '1.0.0';
  source: DesignBridgeSource;
  blueprint: Blueprint;
  node_map: Record<
    string,
    {
      source_id: string;
      source_name?: string;
      component_key?: string;
    }
  >;
}

export const DESIGN_BRIDGE_VERSION: '1.0.0';
export function importDesignBridge(input: DesignBridgeDocument): {
  blueprint: Blueprint;
  source: DesignBridgeSource;
  sourceMap: DesignBridgeDocument['node_map'];
};
