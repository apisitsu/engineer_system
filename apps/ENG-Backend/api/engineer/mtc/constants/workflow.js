/**
 * Workflow Constants for General DWG Request System
 * Centralized configuration for stages, statuses, and email templates
 */

// ── Workflow Stages ──────────────────────────────────────────────────────────
const WORKFLOW_STAGES = {
  ENG_CHECK: 'eng_check',
  DRAFT_MAN: 'draft_man',
  DWG_CHECK: 'dwg_check',
  ENG_REVIEW: 'eng_review',
  ENG_APPROVE: 'eng_approve',
  ENG_INFORM: 'eng_inform',
};

// ── Stage Display Labels ─────────────────────────────────────────────────────
const STAGE_LABELS = {
  [WORKFLOW_STAGES.ENG_CHECK]: 'Eng Check',
  [WORKFLOW_STAGES.DRAFT_MAN]: 'Draft Man',
  [WORKFLOW_STAGES.DWG_CHECK]: 'DWG Check',
  [WORKFLOW_STAGES.ENG_REVIEW]: 'Eng Review',
  [WORKFLOW_STAGES.ENG_APPROVE]: 'Eng Approve',
  [WORKFLOW_STAGES.ENG_INFORM]: 'Eng Inform',
};

// ── Workflow Status ──────────────────────────────────────────────────────────
const WORKFLOW_STATUS = {
  PENDING_ENG_CHECK: 'Pending Eng Check',
  PENDING_DRAFT_MAN: 'Pending Draft Man',
  PENDING_DWG_CHECK: 'Pending DWG Check',
  PENDING_ENG_REVIEW: 'Pending Eng Review',
  PENDING_ENG_APPROVE: 'Pending Eng Approve',
  PENDING_ENG_INFORM: 'Pending Eng Inform',
  COMPLETED_INFORMED: 'Completed & Informed',
  DENIED: 'Denied',
  DENIED_BY_APPROVE: 'Denied by Approve',
  // Legacy status (for backward compatibility)
  COMPLETE: 'Complete',
};

// ── Status to Stage Mapping ──────────────────────────────────────────────────
const STATUS_TO_STAGE = {
  [WORKFLOW_STATUS.PENDING_ENG_CHECK]: WORKFLOW_STAGES.ENG_CHECK,
  [WORKFLOW_STATUS.PENDING_DRAFT_MAN]: WORKFLOW_STAGES.DRAFT_MAN,
  [WORKFLOW_STATUS.PENDING_DWG_CHECK]: WORKFLOW_STAGES.DWG_CHECK,
  [WORKFLOW_STATUS.PENDING_ENG_REVIEW]: WORKFLOW_STAGES.ENG_REVIEW,
  [WORKFLOW_STATUS.PENDING_ENG_APPROVE]: WORKFLOW_STAGES.ENG_APPROVE,
  [WORKFLOW_STATUS.PENDING_ENG_INFORM]: WORKFLOW_STAGES.ENG_INFORM,
};

// ── Request Types ────────────────────────────────────────────────────────────
const REQUEST_TYPES = {
  REGIST_DRAWING: 'Regist Drawing',
  DRAFT_DRAWING: 'Draft Drawing',
  PRINT_3D: '3D Print',
};

// ── Due Date Configuration (working days) ────────────────────────────────────
const DUE_DATE_CONFIG = {
  [REQUEST_TYPES.REGIST_DRAWING]: 5,
  [REQUEST_TYPES.DRAFT_DRAWING]: 7,
  [REQUEST_TYPES.PRINT_3D]: 10,
  DEFAULT: 7,
};

// ── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  MACHINE_PART: 'Machine part',
  GAUGE: 'Gauge',
  OTHER: 'Other',
};

// ── Drawing Required Options ─────────────────────────────────────────────────
const DRAWING_REQUIRED = {
  WITH_DRAWING: 'With Drawing',
  WITHOUT_DRAWING: 'Without Drawing',
};

// ── Type of Drawing ──────────────────────────────────────────────────────────
const DRAWING_TYPES = {
  COPY: 'Copy Drawing',
  REMAKE: 'Remake Drawing',
  NEW_DESIGN: 'New Design',
  MODIFY: 'Modify Drawing',
};

// ── Action Types ─────────────────────────────────────────────────────────────
const ACTION_TYPES = {
  APPROVE: 'approve',
  DENY: 'deny',
  SUBMIT: 'submit',
};

// ── Status Colors (for UI) ───────────────────────────────────────────────────
const STATUS_COLORS = {
  [WORKFLOW_STATUS.PENDING_ENG_CHECK]: 'orange',
  [WORKFLOW_STATUS.PENDING_DRAFT_MAN]: 'blue',
  [WORKFLOW_STATUS.PENDING_DWG_CHECK]: 'blue',
  [WORKFLOW_STATUS.PENDING_ENG_REVIEW]: 'purple',
  [WORKFLOW_STATUS.PENDING_ENG_APPROVE]: 'gold',
  [WORKFLOW_STATUS.PENDING_ENG_INFORM]: 'cyan',
  [WORKFLOW_STATUS.COMPLETED_INFORMED]: 'green',
  [WORKFLOW_STATUS.DENIED]: 'red',
  [WORKFLOW_STATUS.DENIED_BY_APPROVE]: 'red',
};

// ── Email Templates ──────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = {
  SUBJECT_PREFIX: '[Tool Request]',
  APPROVE_ICON: '✅',
  DENY_ICON: '❌',
};

// ── Validation Rules ─────────────────────────────────────────────────────────
const VALIDATION_RULES = {
  REQUIRED_FIELDS: [
    'department',
    'work_center',
    'requester',
    'type_of_request',
    'category',
    'title',
    'detail',
  ],
  MAX_TITLE_LENGTH: 200,
  MAX_DETAIL_LENGTH: 2000,
  MAX_COMMENT_LENGTH: 1000,
};

// ── File Upload Configuration ────────────────────────────────────────────────
const FILE_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_EXTENSIONS: ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg'],
  UPLOAD_DIR: 'tool_requests',
};

// ── Export All ───────────────────────────────────────────────────────────────
module.exports = {
  WORKFLOW_STAGES,
  STAGE_LABELS,
  WORKFLOW_STATUS,
  STATUS_TO_STAGE,
  REQUEST_TYPES,
  DUE_DATE_CONFIG,
  CATEGORIES,
  DRAWING_REQUIRED,
  DRAWING_TYPES,
  ACTION_TYPES,
  STATUS_COLORS,
  EMAIL_TEMPLATES,
  VALIDATION_RULES,
  FILE_CONFIG,
};
