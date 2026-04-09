/**
 * MTC Module Constants for Frontend
 * Centralized configuration for paths, statuses, and categories
 */

export const MTC_PATHS = {
  HOME: '/eng/mtc_eng',
  TOOLING_INSPECT: '/eng/mtc_eng/tooling',
  TOOL_REQUEST: '/eng/mtc_eng/tool-request',
  TOOLING_SELECT: '/eng/mtc_eng/tooling-select',
  TOOLING_INVENTORY: '/eng/mtc_eng/tooling_inventory',
  SDS: '/eng/mtc_eng/sds',
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
