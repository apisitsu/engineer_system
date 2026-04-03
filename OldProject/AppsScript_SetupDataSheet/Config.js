// ================================================================= //
//                      CONFIGURATION & CONSTANTS                    //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Configuration Module
 * Contains all global constants and configuration settings
 */

// --- APPLICATION CONFIGURATION ---
const DATA_SHEET_ID = '1gym--dBa1WmAY6-1NOPu41S2mvwy5BVhIg42jLq2ZKE';
const TEMPLATE_SHEET_ID = '1cpfz5WeXeW2rG_ctUE8fCCetQF54ZF0jpr8gWnYAl-E';

// --- IMAGE FOLDER CONFIGURATION ---
// Google Drive folder ID for SDS_Images folder
// This folder should contain: Turning_Tool/ and Turning_Layout/ subfolders
// To get folder ID: Right-click folder → Get link → Copy ID from URL
// Example URL: https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
//                                                      ↑ This is the ID
const SDS_IMAGES_FOLDER_ID = '1_bMUV06FCwpRjbX2kexn4BI3-9YXyMzj'; // ✅ Folder ID only (not full URL)

// --- PDF CACHE CONFIGURATION ---
const PDF_CACHE_FOLDER_NAME = 'SDS_PDF_Cache';

// --- NEW ---
// Add a sheet with this name to your Data Spreadsheet (dataSs)
const MASTER_INDEX_SHEET = 'MasterSearchIndex';
// --- END NEW ---

// --- SHEETS CONFIGURATION ---
const SHEETS_CONFIG = {
  search: {
    'spherical_grinding': ['SPG_ks400b1', 'SPG_ks400b2', 'SPG_ks400b5', 'SPG_ks400b6', 'SPG_ks400b7', 'SPG_higrind-1-d', 'SPG_ks500rd', 'SPG_kn312a'],
    'id_grinding': ['IDG_ks03a', 'IDG_ksb22g', 'IDG_ksb80', 'IDG_15ksb80', 'IDG_ksb22rd', 'IDG_ksb22', 'IDG_ksr22s2'],
    'face_grinding': ['VSG_tsg300w', 'VSG_tsg300znc', 'HSG_kvd300', 'HSG_kvd350'],
    'groove_grinding': ['GVG_ksr80d', 'GVG_ks500rf', 'GVG_ks350r2', 'GVG_ksr22s2'],
    'super_finish' : ['SPF_ksh22', 'SPF_ksh70', 'SPF_ksh150'],
    'od_grinding': ['CGM_ohmiya18br150', 'CGM_ohmiya20br200', 'CGM_nissin', 'ODG_oc16a', 'ODG_oc18br150', 'ODG_oc20br200'],
    'surface_grinding': ['SGM_gs64pfii', 'SGM_psg64dx'],
    'turning': ['BFD_qsm150ms', 'BFD_qsm150ms400u', 'BFD_qsm200m', 'BFD_qt200_500u']
  },
  compositeKey: [
    'SPG_ks400b1', 'SPG_ks400b2', 'SPG_ks400b5', 'SPG_ks400b6', 'SPG_ks400b7', 'SPG_higrind-1-d', 'SPG_ks500rd', 'SPG_kn312a',
    'IDG_ks03a', 'IDG_ksb22g', 'IDG_ksb80', 'IDG_15ksb80', 'IDG_ksb22rd', 'IDG_ksb22', 'IDG_ksr22s2',
    'VSG_tsg300w', 'VSG_tsg300znc',
    'HSG_kvd300', 'HSG_kvd350',
    'GVG_ksr80d', 'GVG_ks500rf', 'GVG_ks350r2', 'GVG_ksr22s2',
    'SPF_ksh22', 'SPF_ksh70', 'SPF_ksh150',
    'CGM_ohmiya18br150', 'CGM_ohmiya20br200', 'ODG_oc16a', 'ODG_oc18br150', 'ODG_oc20br200', 'CGM_nissin',
    'SGM_gs64pfii', 'SGM_psg64dx',
    'BFD_qsm150ms', 'BFD_qsm150ms400u', 'BFD_qsm200m', 'BFD_qt200_500u'
  ],
  // Triple Key: CN + Process_Code + Machine
  // Use this for sheets where the same CN + Process_Code can have different setups per machine
  tripleKey: [
    'SPG_ks400b1', 'SPG_ks400b2', 'SPG_ks400b5', 'SPG_ks400b6', 'SPG_ks400b7', 'SPG_higrind-1-d', 'SPG_ks500rd', 'SPG_kn312a',
    'IDG_ks03a', 'IDG_ksb22g', 'IDG_ksb80', 'IDG_15ksb80', 'IDG_ksb22rd', 'IDG_ksb22',  'IDG_ksr22s2',
    'VSG_tsg300w', 'VSG_tsg300znc',
    'HSG_kvd300', 'HSG_kvd350',
    'GVG_ksr80d', 'GVG_ks500rf', 'GVG_ks350r2', 'GVG_ksr22s2',
    'SPF_ksh22', 'SPF_ksh70', 'SPF_ksh150',
    'CGM_ohmiya18br150', 'CGM_ohmiya20br200', 'ODG_oc16a', 'ODG_oc18br150', 'ODG_oc20br200', 'CGM_nissin',
    'SGM_gs64pfii', 'SGM_psg64dx',
    'BFD_qsm150ms', 'BFD_qsm150ms400u', 'BFD_qsm200m', 'BFD_qt200_500u'
  ]
};

// --- TOOLING CONFIGURATION ---
// Tooling sheet names by machine type
const TOOLING_SHEETS = {
  grinding: 'Grinding_Tooling',
  turning: 'Turning_Tooling'
};

// Map each sheet to its machine type
const MACHINE_TYPE_MAP = {
  // Grinding machines
  'SPG_ks400b1': 'grinding',
  'SPG_ks400b2': 'grinding',
  'SPG_ks400b5': 'grinding',
  'SPG_ks400b6': 'grinding',
  'SPG_ks400b7': 'grinding', 
  'SPG_higrind-1-d': 'grinding',
  'SPG_ks500rd': 'grinding',
  'SPG_kn312a': 'grinding',
  'IDG_ks03a': 'grinding',
  'IDG_ksb22g': 'grinding',
  'IDG_ksb80': 'grinding',
  'IDG_15ksb80': 'grinding',
  'IDG_ksb22rd': 'grinding',
  'IDG_ksb22': 'grinding',
  'IDG_ksr22s2': 'grinding',
  'VSG_tsg300w': 'grinding',
  'VSG_tsg300znc': 'grinding',
  'HSG_kvd300': 'grinding',
  'HSG_kvd350': 'grinding',
  'GVG_ksr80d': 'grinding',
  'GVG_ks500rf': 'grinding',
  'GVG_ks350r2': 'grinding',
  'GVG_ksr22s2': 'grinding',
  'SPF_ksh22': 'grinding',
  'SPF_ksh70': 'grinding',
  'SPF_ksh150': 'grinding',
  'CGM_ohmiya18br150': 'grinding',
  'CGM_ohmiya20br200': 'grinding',
  'CGM_nissin': 'grinding',
  'ODG_oc16a': 'grinding',
  'ODG_oc18br150': 'grinding',
  'ODG_oc20br200': 'grinding',
  'SGM_gs64pfii': 'grinding',
  'SGM_psg64dx': 'grinding',

  // Turning machines
  'BFD_qsm150ms': 'turning',
  'BFD_qsm150ms400u': 'turning',
  'BFD_qsm200m': 'turning', 
  'BFD_qt200_500u': 'turning'
};

// All sheets that have tooling data
const SHEETS_WITH_TOOLING = [
    'SPG_ks400b1', 'SPG_ks400b2', 'SPG_ks400b5', 'SPG_ks400b6', 'SPG_ks400b7', 'SPG_higrind-1-d', 'SPG_ks500rd', 'SPG_kn312a',
    'IDG_ks03a', 'IDG_ksb22g', 'IDG_ksb80', 'IDG_15ksb80', 'IDG_ksb22rd', 'IDG_ksb22', 'IDG_ksr22s2',
    'VSG_tsg300w', 'VSG_tsg300znc',
    'HSG_kvd300', 'HSG_kvd350',
    'GVG_ksr80d', 'GVG_ks500rf', 'GVG_ks350r2', 'GVG_ksr22s2',
    'SPF_ksh22', 'SPF_ksh70', 'SPF_ksh150',
    'CGM_ohmiya18br150', 'CGM_ohmiya20br200', 'ODG_oc16a', 'ODG_oc18br150', 'ODG_oc20br200', 'CGM_nissin',
    'SGM_gs64pfii', 'SGM_psg64dx',
    'BFD_qsm150ms', 'BFD_qsm150ms400u', 'BFD_qsm200m', 'BFD_qt200_500u'
];

// Backward compatibility: Default tooling sheet name
const TOOLING_SHEET_NAME = TOOLING_SHEETS.grinding;

// Initialize spreadsheet objects
const dataSs = SpreadsheetApp.openById(DATA_SHEET_ID);
// [LAZY LOAD] Template spreadsheet - opened only when needed (PDF generation)
// This prevents "Service Spreadsheets failed" errors from affecting non-PDF functions
let _templateSs = null;
function getTemplateSs(forceRefresh) {
  if (!_templateSs || forceRefresh) {
    _templateSs = SpreadsheetApp.openById(TEMPLATE_SHEET_ID);
  }
  return _templateSs;
}
// --- STATUS CONSTANTS ---
const STATUS = {
  PENDING: 'pending',
  PREPARED: 'prepared', 
  CHECKED: 'checked',
  APPROVED: 'approved'
};
// --- ROLE CONSTANTS ---
const ROLES = {
  PREPARED: 'Prepared',
  CHECKED: 'Checked',
  APPROVED: 'Approved',
  VIEWER: 'Viewer',  // Read-only, approved only, limited Process Codes
  GUEST: 'Guest'     // [NEW] Read-only, approved only, all Process Codes
};
// --- EMAIL CONFIGURATION ---
const EMAIL_CONFIG = {
  SUBJECT_PREFIX: 'SDS Notification:',
  BULK_SUBJECT_PREFIX: '📋 SDS Notification:'
};