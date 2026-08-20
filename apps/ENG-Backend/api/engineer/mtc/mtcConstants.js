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
  LPB_ENG_PROCESS:        'lpb.eng_process',          // process_code → process_eng / process_name

  // SDS v2 — Local tables (engPool / eng_system)
  SDS_MACHINE_TYPE_CODE:  'sds_machine_type_code',  // machine lookup + grinding_area_label
  SDS_EXCEL_MAPPING:      'sds_excel_mapping',       // cell_address → param_key per machine type
  SDS_PARAMETER:          'sds_parameter',           // manual params per (cn, machine_type_name)
  SDS_V2_TOOLING_IMAGE:   'sds_tooling_image',   // tooling images by tool_dwg_no
  SDS_V2_GRINDING_IMAGE:  'sds_grinding_image',  // grinding diagrams by cn_prefix
  SDS_V2_MACHINE_TOOL:    'sds_machine_tool',    // tool ordering per (machine_type, process_code)
  SDS_MACHINE_CODE:       'sds_machine_code',    // factory floor code → machine type mapping
  SDS_ACCESS_LOG:         'sds_access_log',      // VIEW/PDF/ADMIN access tracking
  SDS_TEMPLATE_CSS_CONFIG: 'sds_template_css_config', // CSS variable overrides for Chrome PDF template
  SDS_GRID_TEMPLATE:      'sds_grid_template',      // named grid layouts (multi-template); one is_default
  SDS_APPROVAL:           'sds_approval',          // Prepared/Checked/Approved sign records per (cn, machine_type, process_code, sds_rev)
  SDS_APPROVAL_ROLE_CONFIG: 'sds_approval_role_config', // configurable: which users may sign each role
  LPB_PC_PRODUCTION:      'lpb.pc_production',   // factory production records

  // Tooling Selection & Rules
  MTC_SELECTION_RULES: 'tooling_selection_rules',
  MTC_MACHINE_CONFIG:  'tooling_machine_config',
  TOOLING_FORMULA:     'tooling_formula',
  SPEC_PROCESS: 'tooling_spec_process',

  // Specific Tooling Tables
  TOOLING_KS03A: 'tooling_ks03a',
  TOOLING_KSB22G: 'tooling_ksb22g',
  TOOLING_KSB80: 'tooling_ksb80',
  TOOLING_TSG300: 'tooling_tsg300',
  TOOLING_KS400B: 'tooling_ks400b',
  TOOLING_KS500RD: 'tooling_ks500rd',
  TOOLING_KS400B5: 'tooling_ks400b5',
  TOOLING_KS400B6: 'tooling_ks400b6',

  // Part-No → tool lookup for fixtures selected by workpiece part number (品番),
  // not by dimensional formula (e.g. ROTARY DRESSER 4800-42 on KS-400B5/B6).
  TOOLING_PARTNO_MAP: 'tooling_partno_map',
};

/**
 * Read a path from the environment, tolerating the JS-assignment style this project's
 * `.env` also uses.
 *
 * The file mixes two conventions — plain `KEY=value` alongside `KEY = 'value';` — and the
 * Gmail credentials are the second kind, which is why `emailHelper.cleanEnv()` exists.
 * Nothing signposts which kind a given key wants, so `TI_CSV_OUTPUT_DIR = 'D:\out';` was
 * a reasonable thing to write and produced a genuinely baffling failure: the quotes and
 * semicolon became part of the path, Node resolved it relative to the backend directory,
 * and the import died on
 *
 *     ENOENT: mkdir 'D:\00_system\EngineerSystem\apps\ENG-Backend\'D:\ToolingInspectionCSV';'
 *
 * — an error that names a path nobody typed. Accept either form rather than expect anyone
 * to remember which of two conventions a key belongs to.
 *
 * Only wrapping quotes and one trailing semicolon are stripped: a path may legitimately
 * end in a space-free quote-free string, and nothing here should silently rewrite the
 * middle of what someone configured.
 */
function envPath(key) {
  const raw = process.env[key];
  if (raw == null) return '';
  return String(raw)
    .trim()
    .replace(/;+$/, '')                 // trailing `;` from the JS-assignment style
    .trim()
    .replace(/^(['"])([\s\S]*)\1$/, '$2') // matched wrapping quotes, not stray ones
    .trim();
}

const PATHS = {
  EMAIL_RENDERER: path.join(__dirname, '../../../templates/email/emailRenderer'),
  SDS_TEMPLATE_DIR: process.env.SDS_TEMPLATE_DIR || path.join(__dirname, 'templates'),

  // Tooling Inspection import sources / output, used by services/toolingImportService.js.
  // All three are host-specific and none can be carried by git, so each is env-overridable:
  //  - the two sources are UNC shares the running account must have credentials for;
  //  - the output default is G:, which is GOOGLE DRIVE FOR DESKTOP, not a mapped network
  //    drive. Win32_LogicalDisk reports it DriveType 3 with an empty ProviderName, so
  //    **it has no UNC equivalent**. Drive is installed on all these machines, so G: is
  //    normally there — but it mounts per signed-in session, not per machine, and a write
  //    to it is a cloud sync rather than a disk write. Where the account running the
  //    backend cannot see it, point TI_CSV_OUTPUT_DIR at an ordinary folder — a real UNC
  //    share or local disk — and get the file to Drive some other way.
  //    (M: and N: on these machines ARE network drives, \\10.121.34.19\data_rod and
  //    \\sanlb01\MPA-DIV, which is why the two sources below are written as UNC.)
  //    Never point it inside apps/ENG-Backend: `npm run dev` is nodemon and its
  //    nodemonConfig.ignore covers only output/* and files/*, so a CSV written anywhere
  //    else here restarts the server mid-import and the request never returns.
  //    scripts/ti_check_paths.js reports all of this per host and per account.
  // The trailing "2026" in the source paths is the folder name on the share, not a computed
  // fiscal year (the Python originals hardcoded it the same way) — override on rollover.
  TI_INSP_REC_DIR: envPath('TI_INSP_REC_DIR')
    || String.raw`\\sanlb01\MPA-DIV\03-Purchase\02-Budget\INSP REC\2026`,
  TI_DWG_PRINT_FILE: envPath('TI_DWG_PRINT_FILE')
    || String.raw`\\10.121.34.19\data_rod\08-Engineer\14. Share file Back up\KUNPREAW\PC - Engineer\2026\2026 Record for drawing printed.xlsm`,
  TI_CSV_OUTPUT_DIR: envPath('TI_CSV_OUTPUT_DIR')
    || String.raw`G:\Shared drives\ROD-Engineer\ToolingInspection`,

  // Optional: mirror the two CSVs to Drive through an Apps Script web app instead of
  // relying on a Drive-for-Desktop letter. Unset means "don't", so a host that has not
  // been configured behaves exactly as before. docs/gas_ti_csv_doPost.gs is the script,
  // and explains why this exists rather than the Drive API (the OAuth token this project
  // holds carries only `gmail.send`).
  TI_CSV_GAS_URL: envPath('TI_CSV_GAS_URL'),
  TI_CSV_GAS_SECRET: envPath('TI_CSV_GAS_SECRET'),
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

// Legacy machines with hardcoded adapter logic in partDataMapper.js.
// New machines added via UI use the dynamic rules path and do NOT need to be listed here.
// Adding a new entry requires a matching adapter in partDataMapper.buildCalcMap().
const LEGACY_MACHINES = [
  'KS-B22G',
  'TSG-300',
  'KS400B',
  'KS-03A',
  'KS-500RD',
  'KS-400B5',
  'KS-400B6',
];

module.exports = {
  TABLES,
  PATHS,
  WORKFLOW_STATUS,
  REQUEST_TYPES,
  CATEGORIES,
  LEGACY_MACHINES,
};
