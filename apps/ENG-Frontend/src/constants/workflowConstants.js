/**
 * Workflow Constants for General DWG Request System (Frontend)
 * Centralized configuration for stages, statuses, and UI settings
 */

// ── Workflow Stages ──────────────────────────────────────────────────────────
export const WORKFLOW_STAGES = {
  ENG_CHECK: 'eng_check',
  DRAFT_MAN: 'draft_man',
  DWG_CHECK: 'dwg_check',
  ENG_REVIEW: 'eng_review',
  ENG_APPROVE: 'eng_approve',
  ENG_INFORM: 'eng_inform',
};

// ── Stage Display Labels ─────────────────────────────────────────────────────
export const STAGE_LABELS = {
  [WORKFLOW_STAGES.ENG_CHECK]: 'Eng Check',
  [WORKFLOW_STAGES.DRAFT_MAN]: 'Draft Man',
  [WORKFLOW_STAGES.DWG_CHECK]: 'DWG Check',
  [WORKFLOW_STAGES.ENG_REVIEW]: 'Eng Review',
  [WORKFLOW_STAGES.ENG_APPROVE]: 'Eng Approve',
  [WORKFLOW_STAGES.ENG_INFORM]: 'Eng Inform',
};

// ── Current Stage Display (for UI) ───────────────────────────────────────────
export const CURRENT_STAGE_LABELS = {
  'Eng Check': 'Eng Check',
  'Draft Man': 'Draft Man',
  'DWG Check': 'DWG Check',
  'Eng Review': 'Eng Review',
  'Eng Approve': 'Eng Approve',
  'Eng Inform': 'Eng Inform',
};

// ── Workflow Status ──────────────────────────────────────────────────────────
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
  // Legacy status (for backward compatibility)
  COMPLETE: 'Complete',
};

// ── Status Colors (for Ant Design Tags) ──────────────────────────────────────
export const STATUS_COLORS = {
  'Pending Eng Check': 'orange',
  'Pending Draft Man': 'blue',
  'Pending DWG Check': 'blue',
  'Pending Eng Review': 'purple',
  'Pending Eng Approve': 'gold',
  'Pending Eng Inform': 'cyan',
  'Completed & Informed': 'green',
  'Denied': 'red',
  'Denied by Approve': 'red',
  'Complete': 'green', // Legacy
};

// ── Request Types ────────────────────────────────────────────────────────────
export const REQUEST_TYPES = {
  REGIST_DRAWING: 'Regist Drawing',
  DRAFT_DRAWING: 'Draft Drawing',
  PRINT_3D: '3D Print',
};

// ── Request Type Options (for Select dropdown) ───────────────────────────────
export const REQUEST_TYPE_OPTIONS = [
  { value: REQUEST_TYPES.REGIST_DRAWING, label: 'Regist Drawing' },
  { value: REQUEST_TYPES.DRAFT_DRAWING, label: 'Draft Drawing' },
  { value: REQUEST_TYPES.PRINT_3D, label: '3D Print' },
];

// ── Due Date Configuration (working days) ────────────────────────────────────
export const DUE_DATE_CONFIG = {
  [REQUEST_TYPES.REGIST_DRAWING]: 5,
  [REQUEST_TYPES.DRAFT_DRAWING]: 7,
  [REQUEST_TYPES.PRINT_3D]: 10,
  DEFAULT: 7,
};

// ── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = {
  MACHINE_PART: 'Machine part',
  GAUGE: 'Gauge',
  OTHER: 'Other',
};

// ── Category Options (for Select dropdown) ───────────────────────────────────
export const CATEGORY_OPTIONS = [
  { value: CATEGORIES.MACHINE_PART, label: 'Machine part' },
  { value: CATEGORIES.GAUGE, label: 'Gauge' },
  { value: CATEGORIES.OTHER, label: 'Other' },
];

// ── Drawing Required Options ─────────────────────────────────────────────────
export const DRAWING_REQUIRED = {
  WITH_DRAWING: 'With Drawing',
  WITHOUT_DRAWING: 'Without Drawing',
};

// ── Drawing Required Options (for Select dropdown) ───────────────────────────
export const DRAWING_REQUIRED_OPTIONS = [
  { value: DRAWING_REQUIRED.WITH_DRAWING, label: 'With Drawing' },
  { value: DRAWING_REQUIRED.WITHOUT_DRAWING, label: 'Without Drawing' },
];

// ── Type of Drawing ──────────────────────────────────────────────────────────
export const DRAWING_TYPES = {
  COPY: 'Copy Drawing',
  REMAKE: 'Remake Drawing',
  NEW_DESIGN: 'New Design',
  MODIFY: 'Modify Drawing',
};

// ── Drawing Type Options (for Select dropdown) ───────────────────────────────
export const DRAWING_TYPE_OPTIONS = [
  { value: DRAWING_TYPES.COPY, label: 'Copy Drawing' },
  { value: DRAWING_TYPES.REMAKE, label: 'Remake Drawing' },
  { value: DRAWING_TYPES.NEW_DESIGN, label: 'New Design' },
  { value: DRAWING_TYPES.MODIFY, label: 'Modify Drawing' },
];

// ── Action Types ─────────────────────────────────────────────────────────────
export const ACTION_TYPES = {
  APPROVE: 'approve',
  DENY: 'deny',
  SUBMIT: 'submit',
};

// ── Filter Types (for UI filter buttons) ─────────────────────────────────────
export const FILTER_TYPES = {
  ALL: 'all',
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  COMPLETE: 'complete',
  DENIED: 'denied',
};

// ── Filter Type Labels ───────────────────────────────────────────────────────
export const FILTER_TYPE_LABELS = {
  [FILTER_TYPES.ALL]: 'All',
  [FILTER_TYPES.PENDING]: 'Eng Check',
  [FILTER_TYPES.IN_PROGRESS]: 'In Progress',
  [FILTER_TYPES.COMPLETE]: 'Complete',
  [FILTER_TYPES.DENIED]: 'Denied',
};

// ── Validation Rules ─────────────────────────────────────────────────────────
export const VALIDATION_RULES = {
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
export const FILE_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_EXTENSIONS: ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg'],
  ACCEPT_FILE_TYPES: '.pdf,.dwg,.dxf,.png,.jpg,.jpeg',
};

// ── Table Configuration ──────────────────────────────────────────────────────
export const TABLE_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_LIMIT: 200,
};

// ── Date Formats ─────────────────────────────────────────────────────────────
export const DATE_FORMATS = {
  DISPLAY: 'DD-MMM-YYYY',
  DISPLAY_SHORT: 'DD-MMM-YY',
  API: 'YYYY-MM-DD HH:mm:ss',
  DATE_ONLY: 'YYYY-MM-DD',
};

// ── Icons (Ant Design) ───────────────────────────────────────────────────────
export const STAGE_ICONS = {
  [WORKFLOW_STAGES.ENG_CHECK]: 'AuditOutlined',
  [WORKFLOW_STAGES.DRAFT_MAN]: 'FileTextOutlined',
  [WORKFLOW_STAGES.DWG_CHECK]: 'AuditOutlined',
  [WORKFLOW_STAGES.ENG_REVIEW]: 'UserOutlined',
  [WORKFLOW_STAGES.ENG_APPROVE]: 'CheckCircleOutlined',
  [WORKFLOW_STAGES.ENG_INFORM]: 'SendOutlined',
};

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if status is a completed/done status
 */
export const isDoneStatus = (status) => {
  return [
    WORKFLOW_STATUS.COMPLETED_INFORMED,
    WORKFLOW_STATUS.DENIED,
    WORKFLOW_STATUS.DENIED_BY_APPROVE,
    WORKFLOW_STATUS.COMPLETE,
  ].includes(status);
};

/**
 * Check if status is denied
 */
export const isDeniedStatus = (status) => {
  return [
    WORKFLOW_STATUS.DENIED,
    WORKFLOW_STATUS.DENIED_BY_APPROVE,
  ].includes(status);
};

/**
 * Get stage key from current stage label
 */
export const getStageKeyFromLabel = (stageLabel) => {
  const mapping = {
    'Eng Check': WORKFLOW_STAGES.ENG_CHECK,
    'Draft Man': WORKFLOW_STAGES.DRAFT_MAN,
    'DWG Check': WORKFLOW_STAGES.DWG_CHECK,
    'Eng Review': WORKFLOW_STAGES.ENG_REVIEW,
    'Eng Approve': WORKFLOW_STAGES.ENG_APPROVE,
    'Eng Inform': WORKFLOW_STAGES.ENG_INFORM,
  };
  return mapping[stageLabel];
};

/**
 * Get default request template for new request
 */
export const getDefaultRequestTemplate = (userName, userEmail, userDepartment) => ({
  requester: userName || '',
  requester_email: userEmail || '',
  department: userDepartment || '',
  work_center: '',
  work_center_name: '',
  type_of_request: '',
  category: '',
  drawing_required: '',
  type_of_drawing: '',
  title: '',
  detail: '',
  machine_no: '',
  machine_name: '',
});
