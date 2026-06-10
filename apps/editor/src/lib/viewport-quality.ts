import type { ViewportId } from '../types';

export type ViewportQualityIssueType =
  | 'viewport-overflow'
  | 'horizontal-overflow'
  | 'undersized'
  | 'overlap';

export interface ViewportQualityIssue {
  viewportId: ViewportId;
  type: ViewportQualityIssueType;
  nodeIds: string[];
}

export interface ViewportQualityReport {
  checkedViewportIds: ViewportId[];
  issues: ViewportQualityIssue[];
}
