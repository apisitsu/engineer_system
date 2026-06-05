/**
 * MTC Module Constants for Frontend
 * Centralized configuration for paths, statuses, and categories
 */

export const MTC_PATHS = {
  HOME: '/eng/mtc_eng',
  TOOLING_INSPECT: '/eng/mtc_eng/tooling',
  TOOLING_RESULT_DASHBOARD: '/eng/mtc_eng/tooling-result-dashboard',
  TOOL_REQUEST: '/eng/mtc_eng/tool-request',
  TOOLING_SELECT: '/eng/mtc_eng/tooling-select',
  TOOLING_MANAGEMENT: '/eng/mtc_eng/tooling-management',
  TOOLING_INVENTORY: '/eng/mtc_eng/inventory',
  SDS_V2: '/eng/mtc_eng/sds-v2',
  SDS_V2_ADMIN: '/eng/mtc_eng/sds-v2/admin',
  SDS_COVERAGE_REPORT: '/eng/mtc_eng/sds-coverage-report',
  EMAIL_CONFIG: '/eng/mtc/email-config',
  FORMULA_CONFIG: '/eng/mtc/formulas',
  SELECTION_RULES: '/eng/mtc_eng/selection-rules',
};

export const WORKFLOW_STATUS = {
  PENDING_ENG_CHECK: 'Pending Eng Check',
  PENDING_DRAFT_MAN: 'Pending Draft Man',
  PENDING_DWG_CHECK: 'Pending DWG Check',
  PENDING_ENG_REVIEW: 'Pending Eng Review',
  PENDING_ENG_APPROVE: 'Pending Eng Approve',
  PENDING_ENG_INFORM: 'Pending Eng Inform',
  COMPLETED_INFORMED: 'Completed & Informed',
  DENIED: 'Denied',
  DENIED_BY_APPROVE: 'Denied by Approve',
  // Legacy or simplified status
  COMPLETE: 'Complete',
  PENDING: 'Pending',
};

export const REQUEST_TYPES = {
  REGIST_DRAWING: 'Regist Drawing',
  DRAFT_DRAWING: 'Draft Drawing',
  PRINT_3D: '3D Print',
};

export const CATEGORIES = {
  MACHINE_PART: 'Machine part',
  GAUGE: 'Gauge',
  OTHER: 'Other',
};
