/**
 * Network Configuration
 * Update these values for production deployment
 */

// ── Network Connection Messages ──────────────────────────────────────────────
export const NETWORK_CONNECTION_MESSAGE = "Cannot connect to server, Please try again.";
export const NETWORK_TIMEOUT_MESSAGE = "A network timeout has occurred, Please try again.";
export const UPLOAD_PHOTO_FAIL_MESSAGE = "An error has occurred. The photo was unable to upload.";
export const NOT_CONNECT_NETWORK = "NOT_CONNECT_NETWORK";

// ── Environment Detection ────────────────────────────────────────────────────
// Detect if running on production server (plbmp129)
const isProduction = window.location.hostname === 'plbmp129' || 
                     window.location.hostname === 'localhost' === false;

// ── API URL Configuration ────────────────────────────────────────────────────
// DEV: Local development
// PROD: Production server (plbmp129)

// Uncomment ONE of the following lines based on your environment:

// For LOCAL DEVELOPMENT:
export const apiUrl = "http://localhost:2005/";

// For PRODUCTION (plbmp129 server) - UNCOMMENT THIS LINE FOR DEPLOYMENT:
// export const apiUrl = "http://plbmp129:2005/";

// ── Server Endpoints ─────────────────────────────────────────────────────────
export const server = {
  API_URL: `${apiUrl}`,

  // -------------------- Master --------------------
  
  // -------------------- Tooling --------------------
  // Tooling Inspect (Legacy System)
  TOOLING_INSPECT_GETLIST: `${apiUrl}api/tooling_inspect/getlist`,
  TOOLING_INSPECT_UPDATE: `${apiUrl}api/tooling_inspect/update`,
  TOOLING_INSPECT_STATUS_PREVIEW: `${apiUrl}api/tooling_inspect/status_preview`,
  TOOLING_RETURN_ADD: `${apiUrl}api/tooling_inspect/return_add`,
  TOOLING_RESULT_DASHBOARD: `${apiUrl}api/tooling_inspect/result_dashboard`,
  TOOLING_AVAILABLE_FYE: `${apiUrl}api/tooling_inspect/available_fye`,

  // Legacy DWG Request (Old System - for tooling_dwg_require.jsx only)
  TOOLING_DWG_REQUEST_GETLIST: `${apiUrl}api/tooling_inspect/dwg_require_getlist`,
  TOOLING_DWG_REQUEST_ADD: `${apiUrl}api/tooling_inspect/dwg_require_add`,
  
  // General DWG Request (New System - tr_request)
  MTC_TOOL_REQUESTS: `${apiUrl}api/engineer/mtc/tool-requests`,
  MTC_TOOL_REQUEST_DETAIL: `${apiUrl}api/engineer/mtc/tool-requests`,
  MTC_TOOL_REQUEST_DASHBOARD: `${apiUrl}api/engineer/mtc/tool-requests/dashboard`,
  MTC_TOOL_REQUEST_PERMISSIONS: `${apiUrl}api/engineer/mtc/tool-requests/permissions`,

  // Template Tool (APQP Forms)
  TT_FORMS: `${apiUrl}api/engineer/new_prod/forms`,
  TT_STAMPS: `${apiUrl}api/engineer/new_prod/stamps`,
  TT_CALC_LOG: `${apiUrl}api/engineer/new_prod/calc/log`,

  // HTML to PDF (New Prod)
  HTML_TO_PDF_UPLOAD: `${apiUrl}api/engineer/new_prod/html-to-pdf/upload`,
  HTML_TO_PDF_JOBS: `${apiUrl}api/engineer/new_prod/html-to-pdf/jobs`,
  HTML_TO_PDF_DOWNLOAD_PDF: `${apiUrl}api/engineer/new_prod/html-to-pdf/download/`,
  HTML_TO_PDF_DOWNLOAD_HTML: `${apiUrl}api/engineer/new_prod/html-to-pdf/download-html/`,
  HTML_TO_PDF_DELETE_JOB: `${apiUrl}api/engineer/new_prod/html-to-pdf/jobs/`,
  HTML_TO_PDF_DELETE_ALL: `${apiUrl}api/engineer/new_prod/html-to-pdf/jobs/all`,
  HTML_TO_PDF_REWORK: `${apiUrl}api/engineer/new_prod/html-to-pdf/jobs/`,
  PDF_REPAIR: `${apiUrl}api/engineer/pdf-hub/repair`,
  PDF_TO_IMAGE: `${apiUrl}api/engineer/pdf-hub/pdf-to-image`,

  // Tooling Select
  TSV2_MACHINES:      `${apiUrl}api/tooling-select/machines`,
  TSV2_INVENTORY_TABLES: `${apiUrl}api/tooling-select/inventory-tables`,
  TSV2_INVENTORY:       `${apiUrl}api/tooling-select/inventory`,
  TSV2_COLUMNS:       `${apiUrl}api/tooling-select/columns`,
  TSV2_LIMITS:        `${apiUrl}api/tooling-select/machines`,
  TSV2_FORMULAS:      `${apiUrl}api/tooling-select/machines`,
  TSV2_TOOLINGS:      `${apiUrl}api/tooling-select/machines`,
  TSV2_FORMULA_ITEM:  `${apiUrl}api/tooling-select/formulas`,
  TSV2_LIMIT_ITEM:    `${apiUrl}api/tooling-select/limits`,
  TSV2_SEARCH_RULES:  `${apiUrl}api/tooling-select/machines`,
  TSV2_RULE_ITEM:     `${apiUrl}api/tooling-select/search-rules`,
  TSV2_FORMULA_TEST:  `${apiUrl}api/tooling-select/formula/test`,
  TSV2_SEARCH:        `${apiUrl}api/tooling-select/search`,
  MTC_TOOLING_SPEC: `${apiUrl}api/tooling-select/spec`,
  MTC_TOOLING_SPEC_COUNTS: `${apiUrl}api/tooling-select/spec/counts`,
  MTC_TOOLING_SPEC_FACTORY_PREVIEW: `${apiUrl}api/tooling-select/spec/factory-preview`,
  MTC_TOOLING_SPEC_SYNC: `${apiUrl}api/tooling-select/spec/sync`,
  MTC_TOOLING_SPEC_SYNC_NEW: `${apiUrl}api/tooling-select/spec/sync-new`,
  MTC_SDS_V2_SEARCH: `${apiUrl}api/sds/v2/search`,
  MTC_SDS_V2_PDF: `${apiUrl}api/sds/v2/pdf`,
  MTC_SDS_V2_ADMIN_MACHINE_TYPES: `${apiUrl}api/sds/v2/admin/machine-types`,
  MTC_SDS_V2_ADMIN_MAPPINGS: `${apiUrl}api/sds/v2/admin/mappings`,
  MTC_SDS_V2_ADMIN_MACHINE_TOOLS: `${apiUrl}api/sds/v2/admin/machine-tools`,
  MTC_SDS_V2_ADMIN_MACHINE_TOOLS_COMBOS: `${apiUrl}api/sds/v2/admin/machine-tools/combos`,
  MTC_SDS_V2_ADMIN_MACHINE_TOOLS_BULK: `${apiUrl}api/sds/v2/admin/machine-tools/bulk`,
  MTC_SDS_V2_ADMIN_MACHINE_TOOLS_COMBO_DEL: `${apiUrl}api/sds/v2/admin/machine-tools/combo`,
  MTC_SDS_V2_ADMIN_PARAMETERS: `${apiUrl}api/sds/v2/admin/parameters`,
  MTC_SDS_V2_ADMIN_PARAMETERS_BULK: `${apiUrl}api/sds/v2/admin/parameters/bulk`,
  MTC_SDS_V2_ADMIN_AUDIT: `${apiUrl}api/sds/v2/admin/audit/data-integrity`,
  MTC_SDS_V2_ADMIN_AUDIT_CONFIG: `${apiUrl}api/sds/v2/admin/audit/config`,
  MTC_SDS_V2_ADMIN_AUDIT_PROCESS_MASTER: `${apiUrl}api/sds/v2/admin/audit/process-master`,
  MTC_SDS_V2_ADMIN_VISIBLE_MACHINES: `${apiUrl}api/sds/v2/admin/visible-machines`,
  MTC_SDS_V2_ADMIN_MACHINE_CODES: `${apiUrl}api/sds/v2/admin/machine-codes`,
  MTC_SDS_V2_ADMIN_CN_HISTORY: `${apiUrl}api/sds/v2/admin/cn-history`,
  MTC_SDS_V2_PRODUCTION_SUMMARY: `${apiUrl}api/sds/v2/admin/production-summary`,
  MTC_SDS_V2_IMAGES_TOOLING: `${apiUrl}api/sds/v2/images/tooling`,
  MTC_SDS_V2_IMAGES_TOOLING_SEARCH: `${apiUrl}api/sds/v2/images/tooling/search`,
  MTC_SDS_V2_IMAGES_GRINDING: `${apiUrl}api/sds/v2/images/grinding`,
  MTC_SDS_V2_REPORT_COVERAGE: `${apiUrl}api/sds/v2/report/coverage`,
  MTC_SDS_V2_REPORT_ACCESS_LOG: `${apiUrl}api/sds/v2/report/access-log`,
  MTC_SDS_V2_REPORT_BULK_IMPORT: `${apiUrl}api/sds/v2/report/parameters/bulk-import`,
  // -------------------- ECNT --------------------
  ECR_REQUIRE_CREATE: `${apiUrl}api/ecr/create`,
  ECR_REQUIRE_GETLIST: `${apiUrl}api/ecr/getlist`,
  ECR_REQUIRE_SEND_EMAIL: `${apiUrl}api/send-email`,
  GMAIL_CONNECT: `${apiUrl}auth/google`,
  GMAIL_STATUS: `${apiUrl}api/gmail-status`,

  // -------------------- Tumble --------------------
  TUMBLE_GET_MRP: `${apiUrl}pc/mrp/getAllDataByLotNo/`,
  TUMBLE_GET_ALL_CONDITION: `${apiUrl}api/tumble/getAllCondition`,
  TUMBLE_CREATE_CONDITION: `${apiUrl}api/tumble/createCondition`,
  TUMBLE_UPDATE_CONDITION: `${apiUrl}api/tumble/updateCondition/`,
  TUMBLE_DELETE_CONDITION: `${apiUrl}api/tumble/deleteCondition/`,
  TUMBLE_GET_ALL_MODEL: `${apiUrl}api/tumble/getAllModel`,
  TUMBLE_CREATE_MODEL: `${apiUrl}api/tumble/createModel`,
  TUMBLE_UPDATE_MODEL: `${apiUrl}api/tumble/updateModel/`,
  TUMBLE_DELETE_MODEL: `${apiUrl}api/tumble/deleteModel/`,

  // -------------------- System Engineer (v2 with RBAC) --------------------
  SYSTEM_GET_PROJECT: `${apiUrl}api/system/get_project`,
  SYSTEM_GET_PROJECT_BY_ID: `${apiUrl}api/system/get_project`,
  SYSTEM_CREATE_PROJECT: `${apiUrl}api/system/create_project`,
  SYSTEM_UPDATE_PROJECT: `${apiUrl}api/system/update_project`,
  SYSTEM_DELETE_PROJECT: `${apiUrl}api/system/delete_project`,
  SYSTEM_CLOSE_PROJECT: `${apiUrl}api/system/close_project`,
  SYSTEM_GET_PROJECT_STATS: `${apiUrl}api/system/get_project_stats`,
  SYSTEM_GET_DASHBOARD_DATA: `${apiUrl}api/system/get_dashboard_data`,
  SYSTEM_GET_DASHBOARD_DETAIL: `${apiUrl}api/system/get_dashboard_detail`,

  // Project Members
  SYSTEM_GET_PROJECT_MEMBERS: `${apiUrl}api/system/get_project_members`,
  SYSTEM_ADD_PROJECT_MEMBER: `${apiUrl}api/system/add_project_member`,
  SYSTEM_REMOVE_PROJECT_MEMBER: `${apiUrl}api/system/remove_project_member`,

  // Tasks
  SYSTEM_GET_TODOLIST: `${apiUrl}api/system/get_todolist`,
  SYSTEM_GET_TASKS: `${apiUrl}api/system/get_tasks`,
  SYSTEM_CREATE_TODOLIST: `${apiUrl}api/system/create_todolist`,
  SYSTEM_CREATE_TASK: `${apiUrl}api/system/create_task`,
  SYSTEM_UPDATE_TODOLIST: `${apiUrl}api/system/update_todolist`,
  SYSTEM_UPDATE_TASK: `${apiUrl}api/system/update_task`,
  SYSTEM_DELETE_TODOLIST: `${apiUrl}api/system/delete_todolist`,
  SYSTEM_DELETE_TASK: `${apiUrl}api/system/delete_task`,
  SYSTEM_REORDER_TODOLIST: `${apiUrl}api/system/reorder_todolist`,
  SYSTEM_REORDER_TASKS: `${apiUrl}api/system/reorder_tasks`,

  // Templates
  SYSTEM_GET_TEMPLATES: `${apiUrl}api/system/get_templates`,
  SYSTEM_GET_TEMPLATE_ITEMS: `${apiUrl}api/system/get_template_items`,
  SYSTEM_CREATE_TEMPLATE: `${apiUrl}api/system/create_template`,
  SYSTEM_APPLY_TEMPLATE: `${apiUrl}api/system/apply_template`,

  // -------------------- System --------------------
  USER_LOGIN: `${apiUrl}api/login-user`,
  GET_ALL_USERS: `${apiUrl}api/get-all-users`,
  USER_GET_ALL: `${apiUrl}api/get-all-users`,
  UPDATE_USER_THEME: `${apiUrl}api/update-user-theme`,
  UPDATE_USER_PROFILE: `${apiUrl}api/update-user-profile`,
  GET_USER_INFO: `${apiUrl}api/get-user-info`,

  // -------------------- Kanban --------------------
  KANBAN_USERS: `${apiUrl}api/kanban/users`,
  KANBAN_PROJECTS: `${apiUrl}api/kanban/projects`,
  KANBAN_BOARDS: `${apiUrl}api/kanban/boards`,
  KANBAN_LISTS: `${apiUrl}api/kanban/lists`,
  KANBAN_LABELS: `${apiUrl}api/kanban/labels`,
  KANBAN_CARDS: `${apiUrl}api/kanban/cards`,
  KANBAN_TASK_LISTS: `${apiUrl}api/kanban/task-lists`,
  KANBAN_TASKS: `${apiUrl}api/kanban/tasks`,
  KANBAN_COMMENTS: `${apiUrl}api/kanban/comments`,
  KANBAN_ATTACHMENTS: `${apiUrl}api/kanban/attachments`,
  KANBAN_ISSUES: `${apiUrl}api/kanban/issues`,
  KANBAN_NOTIFICATIONS: `${apiUrl}api/kanban/notifications`,
  KANBAN_USER_PREFERENCES: `${apiUrl}api/kanban/user-preferences`,
  KANBAN_CUSTOM_FIELD_GROUPS: `${apiUrl}api/kanban/custom-field-groups`,
  KANBAN_BASE_CUSTOM_FIELD_GROUPS: `${apiUrl}api/kanban/base-custom-field-groups`,
  KANBAN_CUSTOM_FIELDS: `${apiUrl}api/kanban/custom-fields`,
  KANBAN_WEBHOOKS: `${apiUrl}api/kanban/webhooks`,
  KANBAN_NOTIFICATION_SERVICES: `${apiUrl}api/kanban/notification-services`,
  KANBAN_BACKGROUND_IMAGES: `${apiUrl}api/kanban/background-images`,
  KANBAN_STORAGE_USAGE: `${apiUrl}api/kanban/storage-usage`,
  KANBAN_TEMPLATES: `${apiUrl}api/kanban/templates`,
};

export const key_constance = {
  LOGIN_PASSED: "LOGIN_PASSED",
  USER_EMPNO: "USER_EMPNO",
  USER_NAME: "USER_NAME",
  USER_SECONDAUTH: "USER_SECONDAUTH",
  CONFIRM_TAG: "CONFIRM_TAG",
  STOCK_EXP: "STOCK_EXP",
  ROLE: "ROLE",
  USER_INFO: "USER_INFO",
  USER_DEPARTMENT: "USER_DEPARTMENT",
  USER_SECTION: "USER_SECTION",
  USER_AUTH: "USER_AUTH",
};

export const color = {
  H_GREEN: '#198754',
  L_GREEN: '#20c997',
  GREEN: '#52c41a',
  RED: '#f5222d',
  ORANGE: '#fd7e14',
  YELLOW: '#ffc107',
  BLUE: '#1890ff',
  INDIGO: '#6610f2',
  PURPLE: '#6f42c1',
  PING: '#d63384',
  WHITE: '#fff',
  GRAY100: '#f8f9fa',
  GRAY200: '#e9ecef',
  GRAY300: '#dee2e6',
  GRAY400: '#ced4da',
  GRAY500: '#adb5bd',
  GRAY600: '#6c757d',
  GRAY700: '#495057',
  GRAY800: '#343a40',
  GRAY900: '#212529',
  BLACK: '#000',
  BACKGROUND: '#f5f5f5',
}

export const mm_safety = {
  TOTAL_STOCK: "TOTAL_STOCK"
}
