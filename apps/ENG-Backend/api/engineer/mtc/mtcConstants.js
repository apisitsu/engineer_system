/**
 * MTC Module Constants
 * Centralized configuration for table names and system paths
 */
const path = require('path');

const TABLES = {
  // Tooling Inspection
  TI_LIST: 'ti_list',
  TI_DWG_JOB: 'ti_dwg_job',
  TI_RETURN: 'ti_return',
  WORK_CENTERS: 'work_centers',
  HOLIDAYS: 'holidays',
  HOLIDAY_COLUMN: 'date',

  // General DWG Request (New System)
  TR_REQUEST: 'tr_request',
  TR_WORKFLOW: 'tr_workflow',
  TR_EMAIL_CONFIG: 'tr_email_config',

  // SDS (Setup Data Sheet)
  SETUP_SHEET: 'setup_sheet',
  APPROVAL: 'approval',
  TEMPLATE: 'template',
  TEMPLATE_EXCEL_MAPPING: 'template_excel_mapping',
  SETUP_PARAMETER_VALUE: 'setup_parameter_value',

  // SDS v2 — New tables (lpb / rodpc schemas)
  LPB_ENG_BALL:           'lpb.eng_ball',
  LPB_ENG_BODY:           'lpb.eng_body',
  LPB_ENG_RACE:           'lpb.eng_race',
  LPB_ENG_SLEEVE:         'lpb.eng_sleeve',
  LPB_ENG_SPH:            'lpb.eng_sph',
  LPB_ENG_TOOLING:        'lpb.eng_tooling',
  LPB_ENG_R_PI_ITEM:      'lpb.eng_r_pi_item',
  LPB_ENG_R_PI_TOOL:      'lpb.eng_r_pi_tool',
  LPB_ENG_TEMP_PARTS:     'lpb.eng_temp_parts_name',
  RODPC_ENG_PRODUCTION:   'rodpc.kzwmaq_eng_production',
  RODPC_ENG_PROCESS:      'rodpc.kzwmaq_eng_process',
  RODPC_M_MATERIAL_CODE:  'rodpc.m_material_code',
  LPB_ENG_BOM:            'lpb.eng_bom',
  LPB_ENG_MCODE:          'lpb.eng_mcode',
  LPB_ENG_ITEM:           'lpb.eng_item',
  LPB_ENG_CAD_REV_DATA:   'lpb.eng_cad_rev_data',
  LPB_ENG_PROCESS_INFO:   'lpb.eng_process_info',

  // SDS v2 — Local tables (engPool / eng_system)
  SDS_MACHINE_TYPE_CODE:  'sds_machine_type_code',  // machine lookup + grinding_area_label
  SDS_EXCEL_MAPPING:      'sds_excel_mapping',       // cell_address → param_key per machine type
  SDS_PARAMETER:          'sds_parameter',           // manual params per (cn, machine_type_name)
  SDS_V2_TOOLING_IMAGE:   'sds_v2_tooling_image',   // tooling images by tool_dwg_no
  SDS_V2_GRINDING_IMAGE:  'sds_v2_grinding_image',  // grinding diagrams by cn_prefix
  SDS_V2_MACHINE_TOOL:    'sds_v2_machine_tool',    // tool ordering per (machine_type, process_code)

  // Tooling Selection & Rules
  MTC_SELECTION_RULES: 'mtc_selection_rules',
  MTC_MACHINE_CONFIG:  'mtc_machine_config',
  TOOLING_FORMULA:     'tooling_formula',
  SPEC_PROCESS: 'spec_process',

  // Specific Tooling Tables
  TOOLING_KS03A: 'tooling_ks03a',
  TOOLING_KSB22G: 'tooling_ksb22g',
  TOOLING_KSB80: 'tooling_ksb80',
  TOOLING_TSG300: 'tooling_tsg300',
  TOOLING_KS400B: 'tooling_ks400b',
  TOOLING_KS500RD: 'tooling_ks500rd',
  TOOLING_KS400B5: 'tooling_ks400b5',
  TOOLING_KS400B6: 'tooling_ks400b6',
};

const PATHS = {
  // Resolve the python executable path (can be a relative path to a venv)
  PYTHON_EXE: process.env.PYTHON_EXE 
    ? path.resolve(__dirname, '../../../', process.env.PYTHON_EXE)
    : 'python',
  // Resolve the script path relative to the root of the backend
  TOOLING_IMPORT_SCRIPT: process.env.TOOLING_IMPORT_SCRIPT 
    ? path.resolve(__dirname, '../../../', process.env.TOOLING_IMPORT_SCRIPT)
    : path.resolve(__dirname, 'src/importPCtooling.py'),
  EMAIL_RENDERER: path.join(__dirname, '../../../templates/email/emailRenderer'),
  SDS_TEMPLATE_DIR: process.env.SDS_TEMPLATE_DIR || path.join(__dirname, 'templates'),
};

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
  // Legacy or simplified status
  COMPLETE: 'Complete',
  PENDING: 'Pending',
};

const REQUEST_TYPES = {
  REGIST_DRAWING: 'Regist Drawing',
  DRAFT_DRAWING: 'Draft Drawing',
  PRINT_3D: '3D Print',
};

const CATEGORIES = {
  MACHINE_PART: 'Machine part',
  GAUGE: 'Gauge',
  OTHER: 'Other',
};

module.exports = {
  TABLES,
  PATHS,
  WORKFLOW_STATUS,
  REQUEST_TYPES,
  CATEGORIES,
};
