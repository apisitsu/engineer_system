export const NETWORK_CONNECTION_MESSAGE = "Cannot connect to server, Please try again.";
export const NETWORK_TIMEOUT_MESSAGE = "A network timeout has occurred, Please try again.";
export const UPLOAD_PHOTO_FAIL_MESSAGE = "An error has occurred. The photo was unable to upload.";
export const NOT_CONNECT_NETWORK = "NOT_CONNECT_NETWORK";

// // // ----------- PROD -----------
// export const apiUrl = "http://plbmp130:2005/";


// // // ----------- DEV -----------
export const apiUrl = "http://localhost:2005/";
// export const apiUrl = "http://plbmp129:2005/";
// export const apiUrl = "http://plbmp118:2005/";

export const server = {
  API_URL: `${apiUrl}`,

  // USER_LOGIN: `${apiUrl}login`,

  //--------------------Master--------------------//

  //--------------------MAQ--------------------//

  //--------------------ECNT--------------------//
  UPLOAD_API: `${apiUrl}api/upload`,
  ECR_REQUIRE_CREATE: `${apiUrl}api/ecr/create`,
  ECR_REQUIRE_GETLIST: `${apiUrl}api/ecr/getlist`,
  ECR_REQUIRE_GET_BY_ID: `${apiUrl}api/ecr/`, // append id
  ECR_REQUIRE_STATUS: `${apiUrl}api/ecr/`, // append id/status
  ECR_REQUIRE_TASKS: `${apiUrl}api/ecr/`, // append id/tasks
  ECR_REQUIRE_ACK_TASK: `${apiUrl}api/ecr/tasks/`, // append taskId/ack
  ECR_USERS_BY_DEPT: `${apiUrl}api/ecr/users-by-dept/`, // append dept
  ECR_RESUBMIT: `${apiUrl}api/ecr/`, // append id/resubmit
  // Tooling Inspect (Legacy System)
  TOOLING_INSPECT_GETLIST: `${apiUrl}api/tooling_inspect/getlist`,
  TOOLING_INSPECT_API: `${apiUrl}api/engineer/mtc/tooling-inspect`,
  TOOLING_INSPECT_UPDATE: `${apiUrl}api/tooling_inspect/inspect_update`,
  TOOLING_INSPECT_STATUS_PREVIEW: `${apiUrl}api/tooling_inspect/status_preview`,
  TOOLING_RETURN_ADD: `${apiUrl}api/tooling_inspect/return_add`,
  TOOLING_SYNC_CSV: `${apiUrl}api/tooling_inspect/sync_csv`,

  // Legacy DWG Request (Old System - for tooling_dwg_require.jsx only)
  TOOLING_DWG_REQUEST_GETLIST: `${apiUrl}api/tooling_inspect/dwg_require_getlist`,
  TOOLING_DWG_REQUEST_ADD: `${apiUrl}api/tooling_inspect/dwg_require_add`,
  TOOLING_DWG_REQUEST_UPDATE: `${apiUrl}api/tooling_inspect/dwg_require_update`,
  MASTER_WC: `${apiUrl}api/master/wc`,

  // General DWG Request (New System - tr_request)
  MTC_TOOL_REQUESTS: `${apiUrl}api/engineer/mtc/tool-requests`,
  MTC_TOOL_REQUEST_DETAIL: `${apiUrl}api/engineer/mtc/tool-requests`,
  MTC_TOOL_REQUEST_DASHBOARD: `${apiUrl}api/engineer/mtc/tool-requests/dashboard`,
  MTC_TOOL_REQUEST_PERMISSIONS: `${apiUrl}api/engineer/mtc/tool-requests/permissions`,
  MTC_EMAIL_CONFIG: `${apiUrl}api/engineer/mtc/email-config`,
  TOOLING_DASHBOARD_STATS_GET: `${apiUrl}api/tooling_inspect/dashboard_stats`,
  TOOLING_RESULT_DASHBOARD: `${apiUrl}api/tooling_inspect/result_dashboard`,
  TOOLING_AVAILABLE_FYE: `${apiUrl}api/tooling_inspect/available_fye`,

  // Tooling Select
  TSV2_MACHINES: `${apiUrl}api/tooling-select/machines`,
  TSV2_INVENTORY_TABLES: `${apiUrl}api/tooling-select/inventory-tables`,
  TSV2_INVENTORY: `${apiUrl}api/tooling-select/inventory`,         // append /:table (GET) or /:table/:id (PUT/DELETE)
  TSV2_INVENTORY_LOOKUP: `${apiUrl}api/tooling-select/inventory-lookup`, // ?machine=&tooling_no= → dim row (SDS compare)
  TSV2_COLUMNS: `${apiUrl}api/tooling-select/columns`,
  TSV2_LIMITS: `${apiUrl}api/tooling-select/machines`,         // append /:id/limits
  TSV2_FORMULAS: `${apiUrl}api/tooling-select/machines`,         // append /:id/formulas
  TSV2_TOOLINGS: `${apiUrl}api/tooling-select/machines`,         // append /:id/toolings
  TSV2_FORMULA_ITEM: `${apiUrl}api/tooling-select/formulas`,         // append /:id
  TSV2_LIMIT_ITEM: `${apiUrl}api/tooling-select/limits`,           // append /:id
  TSV2_SEARCH_RULES: `${apiUrl}api/tooling-select/machines`,         // append /:id/search-rules
  TSV2_RULE_ITEM: `${apiUrl}api/tooling-select/search-rules`,     // append /:id
  TSV2_PARTNO_MAP: `${apiUrl}api/tooling-select/partno-map`,      // Part No → tool map; /meta for filters, /:id for PUT/DELETE
  TSV2_FORMULA_TEST: `${apiUrl}api/tooling-select/formula/test`,
  TSV2_FORMULA_ERRORS: `${apiUrl}api/tooling-select/formula/errors`,
  TSV2_SEARCH: `${apiUrl}api/tooling-select/search`,
  MTC_TOOLING_SPEC: `${apiUrl}api/tooling-select/spec`,
  MTC_TOOLING_SPEC_COUNTS: `${apiUrl}api/tooling-select/spec/counts`,
  MTC_TOOLING_SPEC_FACTORY_PREVIEW: `${apiUrl}api/tooling-select/spec/factory-preview`,
  MTC_TOOLING_SPEC_SYNC: `${apiUrl}api/tooling-select/spec/sync`,
  MTC_TOOLING_SPEC_SYNC_NEW: `${apiUrl}api/tooling-select/spec/sync-new`,
  MTC_SDS_V2_SEARCH: `${apiUrl}api/sds/v2/search`,
  MTC_SDS_V2_PDF: `${apiUrl}api/sds/v2/pdf`,
  MTC_SDS_V2_PDF_CHROME: `${apiUrl}api/sds/v2-headless/pdf-chrome`,
  MTC_SDS_V2_PDF_CHROME_BLANK: `${apiUrl}api/sds/v2-headless/pdf-chrome/blank`,
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
  MTC_SDS_V2_APPROVAL: `${apiUrl}api/sds/v2/approval`,
  MTC_SDS_V2_APPROVAL_ROLE_CONFIG: `${apiUrl}api/sds/v2/approval/role-config`,
  MTC_SDS_V2_PRODUCTION_SUMMARY: `${apiUrl}api/sds/v2/admin/production-summary`,
  MTC_SDS_V2_IMAGES_TOOLING: `${apiUrl}api/sds/v2/images/tooling`,
  MTC_SDS_V2_IMAGES_TOOLING_SEARCH: `${apiUrl}api/sds/v2/images/tooling/search`,
  MTC_SDS_V2_IMAGES_GRINDING: `${apiUrl}api/sds/v2/images/grinding`,
  MTC_SDS_V2_REPORT_COVERAGE: `${apiUrl}api/sds/v2/report/coverage`,
  MTC_SDS_V2_REPORT_CONFIG: `${apiUrl}api/sds/v2/report/config`,
  MTC_SDS_V2_REPORT_WC_OPTIONS: `${apiUrl}api/sds/v2/report/wc-options`,
  MTC_SDS_V2_REPORT_ACCESS_LOG: `${apiUrl}api/sds/v2/report/access-log`,
  MTC_SDS_V2_REPORT_BULK_IMPORT: `${apiUrl}api/sds/v2/report/parameters/bulk-import`,
  MTC_SDS_V2_ADMIN_TEMPLATE_CONFIG: `${apiUrl}api/sds/v2/admin/template-config`,
  MTC_SDS_V2_ADMIN_TEMPLATE_CONFIG_PARAMS: `${apiUrl}api/sds/v2/admin/template-config/common-params`,
  MTC_SDS_V2_ADMIN_TEMPLATE_GRID: `${apiUrl}api/sds/v2/admin/template-grid`,
  MTC_SDS_V2_ADMIN_TEMPLATE_GRID_FROM_XLSX: `${apiUrl}api/sds/v2/admin/template-grid/from-xlsx`,
  MTC_SDS_V2_PDF_CHROME_GRID: `${apiUrl}api/sds/v2-headless/pdf-chrome/grid`,

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
  // PDF Hub (Sign & Stamp)
  PDF_HUB_STAMPS: `${apiUrl}api/engineer/pdf-hub/stamps`,
  PDF_USAGE_LOG: `${apiUrl}api/engineer/pdf-hub/usage-log`,
  PDF_USAGE_STATS: `${apiUrl}api/engineer/pdf-hub/usage-stats`,
  PDF_USAGE_HISTORY: `${apiUrl}api/engineer/pdf-hub/usage-history`,
  PDF_WATERMARKS: `${apiUrl}api/engineer/pdf-hub/watermarks`,
  PDF_UNLOCK: `${apiUrl}api/engineer/pdf-hub/unlock`,
  PDF_REPAIR: `${apiUrl}api/engineer/pdf-hub/repair`,
  PDF_WATERMARK_LOG: `${apiUrl}api/engineer/pdf-hub/watermark-log`,
  PDF_WATERMARK_HISTORY: `${apiUrl}api/engineer/pdf-hub/watermark-history`,
  PDF_TO_IMAGE: `${apiUrl}api/engineer/pdf-hub/pdf-to-image`,

  GMAIL_CONNECT: `${apiUrl}auth/google`,
  GMAIL_STATUS: `${apiUrl}api/gmail-status`,

  //--------------------ECNT--------------------//
  TUMBLE_GET_MRP: `http://plb018.lb.minebea.local:2005/pc/mrp/getAllDataByLotNo/`,
  TUMBLE_GET_ALL_CONDITION: `${apiUrl}api/tumble/getAllCondition`,
  TUMBLE_CREATE_CONDITION: `${apiUrl}api/tumble/createCondition`,
  TUMBLE_UPDATE_CONDITION: `${apiUrl}api/tumble/updateCondition/`, // with /:id
  TUMBLE_DELETE_CONDITION: `${apiUrl}api/tumble/deleteCondition/`,  // with /:id
  TUMBLE_GET_ALL_MODEL: `${apiUrl}api/tumble/getAllModel`,
  TUMBLE_CREATE_MODEL: `${apiUrl}api/tumble/createModel`,
  TUMBLE_UPDATE_MODEL: `${apiUrl}api/tumble/updateModel/`, // with /:id
  TUMBLE_DELETE_MODEL: `${apiUrl}api/tumble/deleteModel/`,  // with /:id



  //--------------------System--------------------//
  USER_LOGIN: `${apiUrl}api/login-user`,
  GET_ALL_USERS: `${apiUrl}api/get-all-users`,
  USER_GET_ALL: `${apiUrl}api/get-all-users`,  // Alias
  UPDATE_USER_THEME: `${apiUrl}api/update-user-theme`,
  UPDATE_USER_PROFILE: `${apiUrl}api/update-user-profile`,
  GET_USER_INFO: `${apiUrl}api/get-user-info`,

  //--------------------Kanban--------------------//
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
  // New Feature endpoints
  KANBAN_SETTINGS: `${apiUrl}api/kanban/settings`,
  KANBAN_USER_PREFERENCES: `${apiUrl}api/kanban/user-preferences`,
  KANBAN_CUSTOM_FIELD_GROUPS: `${apiUrl}api/kanban/custom-field-groups`,
  KANBAN_BASE_CUSTOM_FIELD_GROUPS: `${apiUrl}api/kanban/base-custom-field-groups`,
  KANBAN_CUSTOM_FIELDS: `${apiUrl}api/kanban/custom-fields`,
  KANBAN_WEBHOOKS: `${apiUrl}api/kanban/webhooks`,
  KANBAN_NOTIFICATION_SERVICES: `${apiUrl}api/kanban/notification-services`,
  KANBAN_BACKGROUND_IMAGES: `${apiUrl}api/kanban/background-images`,
  KANBAN_STORAGE_USAGE: `${apiUrl}api/kanban/storage-usage`,
  KANBAN_WORKLOAD: `${apiUrl}api/kanban/workload/team-workload`,
  KANBAN_TEMPLATES: `${apiUrl}api/kanban/templates`,

  // Activity Tracking
  ACTIVITY_TRACK: `${apiUrl}api/activity/track`,
  ACTIVITY_SESSION_START: `${apiUrl}api/activity/session/start`,
  ACTIVITY_SESSION_HEARTBEAT: `${apiUrl}api/activity/session/heartbeat`,
  ACTIVITY_SESSION_END: `${apiUrl}api/activity/session/end`,
  ACTIVITY_LOGS: `${apiUrl}api/activity/logs`,
  ACTIVITY_STATS: `${apiUrl}api/activity/stats`,
  ACTIVITY_SESSIONS: `${apiUrl}api/activity/sessions`,
  ACTIVITY_MODULES: `${apiUrl}api/activity/modules`,
  ACTIVITY_USER: `${apiUrl}api/activity/user`,

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
  USER_PERMS: "USER_PERMS",
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

// Google Apps Script Web App URL (doGet endpoint for hidden iframe email notifications)
export const GAS_WEBAPP_URL = 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbxvX4smuNCm8k5x-fkAcurKRG2OfXB0wID0OKzATCreHHIn1BZu0kQDZzFvSfaYoHjCvw/exec';

// Google Apps Script Web App URL (doPost endpoint for Kanban Drive file attachments)
// ⚠️ Paste your deployed GAS URL here after deploying Code.gs

// By Everyone
export const GAS_DRIVE_URL = 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbyeg7I4oCoNEX5K36D44IHG8O0iWOtsiBigO-eGqc9c9Twe8PYys0iLsrJXwydm4vdC/exec';
// By me
// export const GAS_DRIVE_URL = 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbwJzagUw233ty6O8pMBAUtmRXLYXqdkdpQcrog5Wr_d5ERjPZEk4WK0pG5_OaXGLb7a/exec';