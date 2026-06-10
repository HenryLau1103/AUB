export type Blueprint = Record<string, any>;
export type ImplementationReport = Record<string, any>;

export function createImplementationReportTemplate(blueprint: Blueprint): ImplementationReport;

export interface VerifyImplementationReportResult {
  ready: boolean;
  errors: string[];
  summary: {
    nodes_total: number;
    nodes_mapped: number;
    acceptance_total: number;
    acceptance_passed: number;
    unresolved: number;
  };
}

export function verifyImplementationReport(
  blueprint: Blueprint,
  report: ImplementationReport
): VerifyImplementationReportResult;
