export interface HandoffArchiveInput {
  blueprint: Record<string, any>;
  markdown: string;
  genericPrompt: string;
  codexPrompt: string;
  agentGuide: string;
  agentGuideZhHant: string;
  reportTemplate: Record<string, any>;
  reportSchema: Record<string, unknown>;
  viewportImages: Record<string, string>;
  extensionRegistry?: string;
  generatedAt?: string;
}

export interface HandoffArchiveResult {
  bytes: Uint8Array;
  manifest: Record<string, unknown>;
}

export function createHandoffArchive(input: HandoffArchiveInput): Promise<HandoffArchiveResult>;
