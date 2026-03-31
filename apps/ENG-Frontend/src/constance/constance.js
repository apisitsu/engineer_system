export const NETWORK_CONNECTION_MESSAGE = "Cannot connect to server, Please try again.";
export const NETWORK_TIMEOUT_MESSAGE = "A network timeout has occurred, Please try again.";
export const UPLOAD_PHOTO_FAIL_MESSAGE = "An error has occurred. The photo was unable to upload.";
export const NOT_CONNECT_NETWORK = "NOT_CONNECT_NETWORK";

// // // ----------- PROD -----------


// // // ----------- DEV -----------
export const apiUrl = "http://localhost:2005/";
// export const apiUrl = "http://plbmp129:2005/";

export const server = {
  API_URL: `${apiUrl}`,

  // USER_LOGIN: `${apiUrl}login`,

  //--------------------Master--------------------//

  //--------------------MAQ--------------------//

  //--------------------Tooling--------------------//
  TOOLING_INSPECT_GETLIST: `${apiUrl}api/tooling_inspect/getlist`,
  TOOLING_DWG_REQUEST_GETLIST: `${apiUrl}api/tooling_inspect/dwg_require_getlist`,
  TOOLING_DWG_REQUEST_ADD: `${apiUrl}api/tooling_inspect/dwg_require_add`,
  TOOLING_DASHBOARD_STATS_GET: `${apiUrl}api/tooling_inspect/dashboard_stats`,
  TOOLING_RETURN_ADD: `${apiUrl}api/tooling_inspect/return_add`,
  TOOLING_INSPECT_UPDATE: `${apiUrl}api/tooling_inspect/update`,
  MASTER_WC: `${apiUrl}api/master/wc`,

  // Tool Request System
  MTC_TOOL_REQUESTS: `${apiUrl}api/engineer/mtc/tool-requests`,
  MTC_TOOL_REQUEST_DETAIL: `${apiUrl}api/engineer/mtc/tool-requests`,  // with /:id
  MTC_TOOL_REQUEST_DASHBOARD: `${apiUrl}api/engineer/mtc/tool-requests/dashboard`,
  MTC_TOOL_REQUEST_PERMISSIONS: `${apiUrl}api/engineer/mtc/tool-requests/permissions`,

  // Tooling Select & SDS
  MTC_TOOLING_SELECT_SEARCH: `${apiUrl}api/tooling-select/search`,
  MTC_TOOLING_SELECT_RULES: `${apiUrl}api/tooling-select/rules`,
  MTC_TOOLING_SELECT_INIT_DB: `${apiUrl}api/tooling-select/init-db`,
  MTC_TOOLING_INVENTORY: `${apiUrl}api/tooling-select/inventory`,
  MTC_TOOLING_TABLES: `${apiUrl}api/tooling-select/tables`,
  MTC_TOOLING_NAMES: `${apiUrl}api/tooling-select/tooling-names`,
  MTC_TOOLING_CREATE_TABLE: `${apiUrl}api/tooling-select/create-table`,
  MTC_SDS_SEARCH: `${apiUrl}api/sds/search`,
  MTC_SDS_COUNTS: `${apiUrl}api/sds/counts`,
  MTC_SDS_PDF: `${apiUrl}api/sds/pdf`,
  MTC_SDS_TEMPLATES: `${apiUrl}api/sds/templates`,
  MTC_SDS_MAPPING: `${apiUrl}api/sds/mapping`,

  //--------------------ECNT--------------------//
  ECR_REQUIRE_CREATE: `${apiUrl}api/ecr/create`,
  ECR_REQUIRE_GETLIST: `${apiUrl}api/ecr/getlist`,
  ECR_REQUIRE_SEND_EMAIL: `${apiUrl}api/send-email`,
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


  //--------------------System Engineer (v2 with RBAC)--------------------//
  SYSTEM_GET_PROJECT: `${apiUrl}api/system/get_project`,
  SYSTEM_GET_PROJECT_BY_ID: `${apiUrl}api/system/get_project`,  // with /:id
  SYSTEM_CREATE_PROJECT: `${apiUrl}api/system/create_project`,
  SYSTEM_UPDATE_PROJECT: `${apiUrl}api/system/update_project`,  // with /:id
  SYSTEM_DELETE_PROJECT: `${apiUrl}api/system/delete_project`,  // with /:id
  SYSTEM_CLOSE_PROJECT: `${apiUrl}api/system/close_project`,  // with /:id
  SYSTEM_GET_PROJECT_STATS: `${apiUrl}api/system/get_project_stats`,  // with /:id
  SYSTEM_GET_DASHBOARD_DATA: `${apiUrl}api/system/get_dashboard_data`,
  SYSTEM_GET_DASHBOARD_DETAIL: `${apiUrl}api/system/get_dashboard_detail`,

  // Project Members
  SYSTEM_GET_PROJECT_MEMBERS: `${apiUrl}api/system/get_project_members`,  // with /:id
  SYSTEM_ADD_PROJECT_MEMBER: `${apiUrl}api/system/add_project_member`,  // with /:id
  SYSTEM_REMOVE_PROJECT_MEMBER: `${apiUrl}api/system/remove_project_member`,  // with /:id

  // Tasks
  SYSTEM_GET_TODOLIST: `${apiUrl}api/system/get_todolist`,  // with /:id
  SYSTEM_GET_TASKS: `${apiUrl}api/system/get_tasks`,  // with /:id
  SYSTEM_CREATE_TODOLIST: `${apiUrl}api/system/create_todolist`,
  SYSTEM_CREATE_TASK: `${apiUrl}api/system/create_task`,
  SYSTEM_UPDATE_TODOLIST: `${apiUrl}api/system/update_todolist`,  // with /:id
  SYSTEM_UPDATE_TASK: `${apiUrl}api/system/update_task`,  // with /:id
  SYSTEM_DELETE_TODOLIST: `${apiUrl}api/system/delete_todolist`,  // with /:id
  SYSTEM_DELETE_TASK: `${apiUrl}api/system/delete_task`,  // with /:id
  SYSTEM_REORDER_TODOLIST: `${apiUrl}api/system/reorder_todolist`,
  SYSTEM_REORDER_TASKS: `${apiUrl}api/system/reorder_tasks`,

  // Templates
  SYSTEM_GET_TEMPLATES: `${apiUrl}api/system/get_templates`,
  SYSTEM_GET_TEMPLATE_ITEMS: `${apiUrl}api/system/get_template_items`,  // with /:id
  SYSTEM_CREATE_TEMPLATE: `${apiUrl}api/system/create_template`,
  SYSTEM_APPLY_TEMPLATE: `${apiUrl}api/system/apply_template`,

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
  KANBAN_USER_PREFERENCES: `${apiUrl}api/kanban/user-preferences`,
  KANBAN_CUSTOM_FIELD_GROUPS: `${apiUrl}api/kanban/custom-field-groups`,
  KANBAN_BASE_CUSTOM_FIELD_GROUPS: `${apiUrl}api/kanban/base-custom-field-groups`,
  KANBAN_CUSTOM_FIELDS: `${apiUrl}api/kanban/custom-fields`,
  KANBAN_WEBHOOKS: `${apiUrl}api/kanban/webhooks`,
  KANBAN_NOTIFICATION_SERVICES: `${apiUrl}api/kanban/notification-services`,
  KANBAN_BACKGROUND_IMAGES: `${apiUrl}api/kanban/background-images`,
  KANBAN_STORAGE_USAGE: `${apiUrl}api/kanban/storage-usage`,

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
