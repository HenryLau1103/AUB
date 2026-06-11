export type Blueprint = Record<string, any>;
export type ImplementationReport = Record<string, any>;

export function createImplementationReportTemplate(blueprint: Blueprint): ImplementationReport;

export interface ImplementationSafetyScore {
  overall: number;
  grade: 'pass' | 'review' | 'risk' | 'fail';
  sourceCoverageScore: number;
  acceptanceEvidenceScore: number;
  viewportEvidenceScore: number;
  overflowSafety: number;
  componentReuseScore: number;
  unresolvedMappingCount: number;
  lookalikePreventionCount: number;
  evidenceItems: number;
  expectedViewports: string[];
}

export interface VerifyImplementationReportResult {
  ready: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    nodes_total: number;
    nodes_mapped: number;
    acceptance_total: number;
    acceptance_passed: number;
    evidence_items: number;
    unresolved: number;
    safety_score: ImplementationSafetyScore;
  };
}

export function scoreImplementationSafety(
  blueprint: Blueprint,
  report: ImplementationReport
): ImplementationSafetyScore;

export function verifyImplementationReport(
  blueprint: Blueprint,
  report: ImplementationReport,
  options?: { requireEvidence?: boolean }
): VerifyImplementationReportResult;
