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
  HOLIDAYS: 'holidays_date',

  // General DWG Request (New System)
  TR_REQUEST: 'tr_request',
  TR_WORKFLOW: 'tr_workflow',

  // SDS (Setup Data Sheet)
  SETUP_SHEET: 'setup_sheet',
  APPROVAL: 'approval',
  TEMPLATE: 'template',
  TEMPLATE_EXCEL_MAPPING: 'template_excel_mapping',
  SETUP_PARAMETER_VALUE: 'setup_parameter_value',

  // Tooling Selection & Rules
  MTC_SELECTION_RULES: 'mtc_selection_rules',
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

module.exports = {
  TABLES,
  PATHS,
};
