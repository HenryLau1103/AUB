export const WORKSPACE_LOOP_VERSION: string;
export const AUB_DIR: string;
export const SESSION_PATH: string;
export const COMPONENT_CANDIDATES_PATH: string;
export const TEMPLATE_DIR: string;
export const TEMPLATE_FORMAT: string;
export const TEMPLATE_FORMAT_VERSION: string;

export function readAubSession(root: string): Promise<Record<string, any>>;
export function updateAubSession(root: string, patch?: Record<string, any>): Promise<{ path: string; session: Record<string, any> }>;
export function readComponentCandidates(root: string): Promise<{ format: string; format_version: string; candidates: any[] }>;
export function listWorkspaceTemplates(root: string): Promise<any[]>;
export function getWorkspaceStatus(root: string): Promise<Record<string, any>>;
export function scanProjectUi(root: string, options?: Record<string, any>): Promise<Record<string, any>>;
export function generateTemplateFromSource(root: string, args?: Record<string, any>): Promise<{ savedPath: string; template: Record<string, any> }>;
export function approveComponentCandidate(root: string, args?: Record<string, any>): Promise<Record<string, any>>;
export function templateAuthoringPrompt(): string;
