export type Blueprint = Record<string, any>;

export interface ExportAgentPromptOptions {
  adapter?: string;
  task?: string;
}

export function exportAgentPrompt(blueprint: Blueprint, options?: ExportAgentPromptOptions): string;
export function supportedAgentAdapters(): string[];
export function supportedAgentTasks(): string[];
