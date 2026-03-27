/**
 * ================================================================
 * INITIALIZATION SCRIPT - ROD END Drawing Request System
 * ================================================================
 * Script นี้จะสร้าง Sheets ทั้งหมดพร้อม Headers และ Formatting
 * วิธีใช้: Extensions > Apps Script > Run > initializeAllSheets
 * ================================================================
 */

// Configuration
const SHEET_CONFIG = {
  REQUESTS: {
    name: 'Requests',
    color: '#4285F4',
    columns: [
      'Request No.', 'Timestamp', 'Status', 'Department', 'WC', 
      'Requester', 'Requester Email', 'Type of Request', 'Category', 
      'Drawing Required', 'Type of Drawing', 'No. of Machine', 
      'Machine Name', 'Req. Due Date', 'Title', 'Detail', 
      'Attachment URLs', 'Current Stage', 'Last Updated', 'Request No (Eng)'
    ]
  },
  ENG_CHECK: {
    name: 'Eng_Check',
    color: '#34A853',
    columns: [
      'Request No.', 'Timestamp', 'Checker', 'Checker Email', 
      'Status', 'Comment'
    ]
  },
  DRAFT_MAN: {
    name: 'Draft_Man',
    color: '#FBBC04',
    columns: [
      'Request No.', 'Timestamp', 'Draftman', 'Draftman Email', 
      'DWG Files'
    ]
  },
  DWG_CHECK: {
    name: 'DWG_Check',
    color: '#FF6D00',
    columns: [
      'Request No.', 'Timestamp', 'Checker', 'Checker Email', 
      'Status', 'Comment'
    ]
  },
  ENG_REVIEW: {
    name: 'Eng_Review',
    color: '#AB47BC',
    columns: [
      'Request No.', 'Timestamp', 'Reviewer', 'Reviewer Email', 
      'Section', 'Spare Part Type', 'General(01)', 'Machine part(02)', 
      'Gauge type(03)', 'No. of DWG.', 'Drawing No.', 'Attach File'
    ]
  },
  ENG_APPROVE: {
    name: 'Eng_Approve',
    color: '#EA4335',
    columns: [
      'Request No.', 'Timestamp', 'Approver', 'Approver Email', 
      'Judgement', 'Comment'
    ]
  },
  ENG_INFORM: {
    name: 'Eng_Inform',
    color: '#00897B',
    columns: [
      'Request No.', 'Timestamp', 'Cost', 'Evidence', 
      'Attach File', 'Sent to Requester'
    ]
  },
  TRACKING: {
    name: 'Tracking',
    color: '#9C27B0',
    columns: [
      'Request No.', 'Type of Request', 'No. of Drawings', 'Status',
      'Created Date', 'Eng Check Date', 'Draft Man Date', 'DWG Check Date',
      'Eng Review Date', 'Eng Approve Date', 'Completed Date',
      'Eng Check Duration (days)', 'Draft Man Duration (days)', 
      'DWG Check Duration (days)', 'Eng Review Duration (days)', 
      'Eng Approve Duration (days)', 'Total Duration (days)',
      'Due Date', 'On Time?'
    ]
  },
  MASTER_DATA: {
    name: 'Master_Data',
    color: '#757575',
    columns: ['Departments', 'Work Centers', 'Users']
  },
  CONFIG: {
    name: 'Config',
    color: '#673AB7',
    columns: ['SETTING', 'VALUE', 'DESCRIPTION']
  }
};

/**
 * ================================================================
 * MAIN INITIALIZATION FUNCTION
 * ================================================================
 */
function initializeAllSheets() {
  const ui = SpreadsheetApp.getUi();
  
  // Confirm with user
  const response = ui.alert(
    'Initialize System',
    'This will create/reset all sheets for the ROD END Drawing Request System.\n\n' +
    'Existing data will be preserved if sheets already exist.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const ss = getSpreadsheet();
  
  try {
    // Create all sheets
    createRequestsSheet(ss);
    createEngCheckSheet(ss);
    createDraftManSheet(ss);
    createDWGCheckSheet(ss);
    createEngReviewSheet(ss);
    createEngApproveSheet(ss);
    createEngInformSheet(ss);
    createTrackingSheet(ss);
    createMasterDataSheet(ss);
    createConfigSheet(ss);
    
    // Set default sheet to Requests
    const requestSheet = ss.getSheetByName(SHEET_CONFIG.REQUESTS.name);
    ss.setActiveSheet(requestSheet);
    
    ui.alert(
      '✅ Success!',
      'All sheets have been initialized successfully!\n\n' +
      'Sheets created:\n' +
      '• Requests\n' +
      '• Eng_Check\n' +
      '• Draft_Man\n' +
      '• DWG_Check\n' +
      '• Eng_Review\n' +
      '• Eng_Approve\n' +
      '• Eng_Inform\n' +
      '• Tracking\n' +
      '• Master_Data\n' +
      '• Config ⭐ (Configure emails here!)\n\n' +
      'Next steps:\n' +
      '1. Go to Config sheet and update email addresses\n' +
      '2. Use "Request System > Validate Email Config" to test\n' +
      '3. Deploy the Web App!\n',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert('❌ Error', 'Error initializing sheets: ' + error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * ================================================================
 * SHEET CREATION FUNCTIONS
 * ================================================================
 */

/**
 * Create Requests Sheet
 */
function createRequestsSheet(ss) {
  const config = SHEET_CONFIG.REQUESTS;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  // Set headers
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  
  // Set row height for header
  sheet.setRowHeight(1, 40);
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Status
  sheet.setColumnWidth(4, 120);  // Department
  sheet.setColumnWidth(5, 100);  // WC
  sheet.setColumnWidth(6, 150);  // Requester
  sheet.setColumnWidth(7, 200);  // Requester Email
  sheet.setColumnWidth(8, 130);  // Type of Request
  sheet.setColumnWidth(9, 120);  // Category
  sheet.setColumnWidth(10, 130); // Drawing Required
  sheet.setColumnWidth(11, 130); // Type of Drawing
  sheet.setColumnWidth(12, 120); // No. of Machine
  sheet.setColumnWidth(13, 150); // Machine Name
  sheet.setColumnWidth(14, 120); // Req. Due Date
  sheet.setColumnWidth(15, 200); // Title
  sheet.setColumnWidth(16, 300); // Detail
  sheet.setColumnWidth(17, 200); // Attachment URLs
  sheet.setColumnWidth(18, 120); // Current Stage
  sheet.setColumnWidth(19, 140); // Last Updated
  
  // Add filters
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  
  // Add data validation for Status column (column 3)
  const statusRange = sheet.getRange(2, 3, 1000, 1);
  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      'Pending Eng Check',
      'Pending Draft Man',
      'Pending DWG Check',
      'Pending Eng Review',
      'Pending Eng Approve',
      'Pending Eng Inform',
      'Completed',
      'Completed & Informed',
      'Denied',
      'Denied by Approve'
    ])
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusValidation);
  
  // Format timestamp columns
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  sheet.getRange(2, 14, 1000, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, 19, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Eng Check Sheet
 */
function createEngCheckSheet(ss) {
  const config = SHEET_CONFIG.ENG_CHECK;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Checker
  sheet.setColumnWidth(4, 200);  // Checker Email
  sheet.setColumnWidth(5, 100);  // Status
  sheet.setColumnWidth(6, 300);  // Comment
  
  // Add filters
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  
  // Format timestamp
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  // Data validation for Status
  const statusRange = sheet.getRange(2, 5, 1000, 1);
  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Approve', 'Deny'])
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusValidation);
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Draft Man Sheet
 */
function createDraftManSheet(ss) {
  const config = SHEET_CONFIG.DRAFT_MAN;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Draftman
  sheet.setColumnWidth(4, 200);  // Draftman Email
  sheet.setColumnWidth(5, 400);  // DWG Files
  
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create DWG Check Sheet
 */
function createDWGCheckSheet(ss) {
  const config = SHEET_CONFIG.DWG_CHECK;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Checker
  sheet.setColumnWidth(4, 200);  // Checker Email
  sheet.setColumnWidth(5, 100);  // Status
  sheet.setColumnWidth(6, 300);  // Comment
  
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  // Data validation for Status
  const statusRange = sheet.getRange(2, 5, 1000, 1);
  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Approve', 'Deny'])
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusValidation);
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Eng Review Sheet
 */
function createEngReviewSheet(ss) {
  const config = SHEET_CONFIG.ENG_REVIEW;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  
  sheet.setRowHeight(1, 50);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Reviewer
  sheet.setColumnWidth(4, 200);  // Reviewer Email
  sheet.setColumnWidth(5, 120);  // Section
  sheet.setColumnWidth(6, 130);  // Spare Part Type
  sheet.setColumnWidth(7, 120);  // General(01)
  sheet.setColumnWidth(8, 130);  // Machine part(02)
  sheet.setColumnWidth(9, 120);  // Gauge type(03)
  sheet.setColumnWidth(10, 100); // No. of DWG.
  sheet.setColumnWidth(11, 150); // Drawing No.
  sheet.setColumnWidth(12, 300); // Attach File
  
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Eng Approve Sheet
 */
function createEngApproveSheet(ss) {
  const config = SHEET_CONFIG.ENG_APPROVE;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Approver
  sheet.setColumnWidth(4, 200);  // Approver Email
  sheet.setColumnWidth(5, 100);  // Judgement
  sheet.setColumnWidth(6, 300);  // Comment
  
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  // Data validation for Judgement
  const judgementRange = sheet.getRange(2, 5, 1000, 1);
  const judgementValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Approve', 'Deny'])
    .setAllowInvalid(false)
    .build();
  judgementRange.setDataValidation(judgementValidation);
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Eng Inform Sheet
 */
function createEngInformSheet(ss) {
  const config = SHEET_CONFIG.ENG_INFORM;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 140);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Cost
  sheet.setColumnWidth(4, 200);  // Evidence
  sheet.setColumnWidth(5, 300);  // Attach File
  sheet.setColumnWidth(6, 140);  // Sent to Requester
  
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  sheet.getRange(2, 2, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  sheet.getRange(2, 6, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Tracking Sheet
 */
function createTrackingSheet(ss) {
  const config = SHEET_CONFIG.TRACKING;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(10)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  
  sheet.setRowHeight(1, 60);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 150);  // Request No.
  sheet.setColumnWidth(2, 120);  // Type of Request
  sheet.setColumnWidth(3, 100);  // No. of Drawings
  sheet.setColumnWidth(4, 150);  // Status
  sheet.setColumnWidth(5, 120);  // Created Date
  sheet.setColumnWidth(6, 120);  // Eng Check Date
  sheet.setColumnWidth(7, 120);  // Draft Man Date
  sheet.setColumnWidth(8, 120);  // DWG Check Date
  sheet.setColumnWidth(9, 120);  // Eng Review Date
  sheet.setColumnWidth(10, 120); // Eng Approve Date
  sheet.setColumnWidth(11, 120); // Completed Date
  sheet.setColumnWidth(12, 100); // Eng Check Duration
  sheet.setColumnWidth(13, 100); // Draft Man Duration
  sheet.setColumnWidth(14, 100); // DWG Check Duration
  sheet.setColumnWidth(15, 100); // Eng Review Duration
  sheet.setColumnWidth(16, 100); // Eng Approve Duration
  sheet.setColumnWidth(17, 100); // Total Duration
  sheet.setColumnWidth(18, 120); // Due Date
  sheet.setColumnWidth(19, 80);  // On Time?
  
  sheet.getRange(1, 1, 1, headers.length).createFilter();
  
  // Format date columns (5-11, 18)
  for (let col = 5; col <= 11; col++) {
    sheet.getRange(2, col, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  }
  sheet.getRange(2, 18, 1000, 1).setNumberFormat('dd/mm/yyyy');
  
  // Format duration columns (12-17)
  for (let col = 12; col <= 17; col++) {
    sheet.getRange(2, col, 1000, 1).setNumberFormat('0');
  }
  
  // Add conditional formatting for "On Time?" column
  const onTimeRange = sheet.getRange(2, 19, 1000, 1);
  
  // Green for "Yes"
  const yesRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Yes')
    .setBackground('#C8E6C9')
    .setFontColor('#2E7D32')
    .setRanges([onTimeRange])
    .build();
  
  // Red for "No"
  const noRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('No')
    .setBackground('#FFCDD2')
    .setFontColor('#C62828')
    .setRanges([onTimeRange])
    .build();
  
  sheet.setConditionalFormatRules([yesRule, noRule]);
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Master Data Sheet
 */
function createMasterDataSheet(ss) {
  const config = SHEET_CONFIG.MASTER_DATA;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  // Clear existing content
  sheet.clear();
  
  const headers = config.columns;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 200);  // Departments
  sheet.setColumnWidth(2, 200);  // Work Centers
  sheet.setColumnWidth(3, 300);  // Users
  
  // Add sample data for Departments
  const departments = [
    ['Production'],
    ['Maintenance'],
    ['Quality'],
    ['Engineering'],
    ['Planning'],
    ['Logistics'],
    ['Other']
  ];
  sheet.getRange(2, 1, departments.length, 1).setValues(departments);
  
  // Add sample data for Work Centers
  const workCenters = [
    ['WC001'],
    ['WC002'],
    ['WC003'],
    ['WC004'],
    ['WC005']
  ];
  sheet.getRange(2, 2, workCenters.length, 1).setValues(workCenters);
  
  // Add instructions
  sheet.getRange('A' + (departments.length + 4)).setValue('💡 Add more departments, work centers, and users as needed');
  sheet.getRange('A' + (departments.length + 4)).setFontStyle('italic').setFontColor('#666666');
  
  // Add borders to data sections
  sheet.getRange(1, 1, departments.length + 1, 1).setBorder(
    true, true, true, true, false, false,
    '#BDBDBD', SpreadsheetApp.BorderStyle.SOLID
  );
  
  sheet.getRange(1, 2, workCenters.length + 1, 1).setBorder(
    true, true, true, true, false, false,
    '#BDBDBD', SpreadsheetApp.BorderStyle.SOLID
  );
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * Create Config Sheet
 */
function createConfigSheet(ss) {
  const config = SHEET_CONFIG.CONFIG;
  let sheet = ss.getSheetByName(config.name);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
  }
  
  // Clear existing content
  sheet.clear();
  
  // Set up the structure
  const headers = [
    ['SETTING', 'VALUE', 'DESCRIPTION'],
    ['', '', ''],
    ['', '', ''],  // Row 3 will be merged for section header
    // Email Configuration Section (Rows 4-11)
    ['ENG_CHECK', 'engineer1@company.com, engineer2@company.com', 'Engineering Check team emails (comma separated)'],
    ['CC_ENG_CHECK', 'manager@company.com, supervisor@company.com', 'CC for Eng Check emails'],
    ['DRAFTMAN', 'draftman@company.com', 'Draftman email(s)'],
    ['CC_DRAFTMAN', 'engineer@company.com', 'CC for Draft Man emails'],
    ['DWG_CHECK', 'engineer1@company.com', 'DWG Check team emails'],
    ['CC_DWG_CHECK', 'supervisor@company.com', 'CC for DWG Check emails'],
    ['ENG_REVIEW', 'reviewer@company.com', 'Engineering Review team emails'],
    ['CC_ENG_REVIEW', 'team@company.com', 'CC for Eng Review emails'],
    ['ENG_APPROVE', 'approver@company.com', 'Engineering Approve team emails'],
    ['CC_ENG_APPROVE', 'manager@company.com', 'CC for Eng Approve emails'],
    ['', '', ''],
    ['', '', ''],  // Row 14 will be merged for section header
    // Due Days Configuration Section (Rows 15-17)
    ['Regist Drawing', '5', 'Working days for Regist Drawing'],
    ['Draft Drawing', '7', 'Working days for Draft Drawing'],
    ['3D Print', '10', 'Working days for 3D Print']
  ];
  
  // Set values
  sheet.getRange(1, 1, headers.length, 3).setValues(headers);
  
  // Format header row
  sheet.getRange(1, 1, 1, 3)
    .setFontWeight('bold')
    .setFontSize(11)
    .setBackground(config.color)
    .setFontColor('white')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 40);
  
  // Format section headers
  sheet.getRange('A3:C3')
    .merge()
    .setValue('📧 EMAIL CONFIGURATION')
    .setFontWeight('bold')
    .setFontSize(12)
    .setBackground('#E1BEE7')
    .setHorizontalAlignment('center');
  
  sheet.getRange('A14:C14')
    .merge()
    .setValue('⏰ DUE DAYS CONFIGURATION')
    .setFontWeight('bold')
    .setFontSize(12)
    .setBackground('#B39DDB')
    .setHorizontalAlignment('center');
  
  // Set column widths
  sheet.setColumnWidth(1, 200);  // Setting name
  sheet.setColumnWidth(2, 400);  // Value
  sheet.setColumnWidth(3, 350);  // Description
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Add borders to configuration sections
  sheet.getRange('A4:C13').setBorder(
    true, true, true, true, true, true,
    '#9575CD', SpreadsheetApp.BorderStyle.SOLID
  );
  
  sheet.getRange('A15:C17').setBorder(
    true, true, true, true, true, true,
    '#9575CD', SpreadsheetApp.BorderStyle.SOLID
  );
  
  // Add data validation for due days (must be numbers)
  const dueDaysRange = sheet.getRange('B15:B17');
  const numberValidation = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0)
    .setAllowInvalid(false)
    .setHelpText('Please enter a number greater than 0')
    .build();
  dueDaysRange.setDataValidation(numberValidation);
  
  // Add instructions
  const instructionRow = 19;
  sheet.getRange(instructionRow, 1, 1, 3).merge()
    .setValue('💡 Instructions: Edit the VALUE column to change settings. Email addresses can be comma or semicolon separated. Changes take effect immediately.')
    .setFontStyle('italic')
    .setFontColor('#666666')
    .setWrap(true)
    .setVerticalAlignment('top');
  
  sheet.setRowHeight(instructionRow, 60);
  
  // Add warning
  const warningRow = 20;
  sheet.getRange(warningRow, 1, 1, 3).merge()
    .setValue('⚠️ Warning: Do not delete or rename the SETTING column values. Only edit the VALUE column.')
    .setFontStyle('italic')
    .setFontColor('#D32F2F')
    .setBackground('#FFEBEE')
    .setWrap(true)
    .setVerticalAlignment('top');
  
  sheet.setRowHeight(warningRow, 50);
  
  // Add validation button instruction
  const validationRow = 22;
  sheet.getRange(validationRow, 1, 1, 3).merge()
    .setValue('✅ To validate your email configuration, go to: Request System > Validate Email Config')
    .setFontWeight('bold')
    .setFontColor('#2E7D32')
    .setBackground('#E8F5E9')
    .setWrap(true)
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(validationRow, 50);
  
  Logger.log('✅ Created: ' + config.name);
}

/**
 * ================================================================
 * UTILITY FUNCTIONS
 * ================================================================
 */

/**
 * Delete all existing sheets (use with caution!)
 */
function deleteAllSheets() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '⚠️ Warning',
    'This will DELETE all sheets and their data!\n\n' +
    'This action CANNOT be undone!\n\n' +
    'Are you absolutely sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  
  // Keep at least one sheet
  if (sheets.length === 1) {
    ui.alert('Cannot delete the last sheet!');
    return;
  }
  
  for (let i = sheets.length - 1; i >= 0; i--) {
    if (sheets.length > 1) {
      ss.deleteSheet(sheets[i]);
    }
  }
  
  ui.alert('All sheets deleted. Please run initializeAllSheets() to recreate them.');
}

/**
 * Add sample request data for testing
 */
function addSampleData() {
  const ss = getSpreadsheet();
  const requestSheet = ss.getSheetByName('Requests');
  
  if (!requestSheet) {
    SpreadsheetApp.getUi().alert('Please initialize sheets first!');
    return;
  }
  
  const today = new Date();
  const dueDate = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days later
  
  const sampleData = [
    [
      'REQ-20260116-001',
      today,
      'Pending Eng Check',
      'Production',
      'WC001',
      'Somchai Prasert',
      'somchai.p@minebea.com',
      'Draft Drawing',
      'Machine part',
      'N/A',
      'New Design',
      'MC-001',
      'CNC Machine A',
      dueDate,
      'New bracket for motor mount',
      'Need a new bracket design for mounting the motor. Must withstand vibration.',
      '',
      'Eng Check',
      today
    ],
    [
      'REQ-20260116-002',
      today,
      'Pending Eng Check',
      'Maintenance',
      'WC002',
      'Nuttapong Wongsa',
      'nuttapong.w@minebea.com',
      'Regist Drawing',
      'Gauge',
      'N/A',
      'N/A',
      'MC-015',
      'Inspection Station 3',
      new Date(today.getTime() + (5 * 24 * 60 * 60 * 1000)),
      'Register inspection gauge drawing',
      'Register existing inspection gauge into system',
      '',
      'Eng Check',
      today
    ]
  ];
  
  requestSheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
  
  SpreadsheetApp.getUi().alert('✅ Sample data added successfully!');
}

/**
 * Update Status Data Validation in Requests Sheet
 * Run this to add new status values without reinitializing
 */
function updateStatusValidation() {
  const ss = getSpreadsheet();
  const requestSheet = ss.getSheetByName('Requests');

  if (!requestSheet) {
    Logger.log('Requests sheet not found!');
    return;
  }

  // Update data validation for Status column (column 3)
  const statusRange = requestSheet.getRange(2, 3, 1000, 1);
  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      'Pending Eng Check',
      'Pending Draft Man',
      'Pending DWG Check',
      'Pending Eng Review',
      'Pending Eng Approve',
      'Pending Eng Inform',
      'Completed',
      'Completed & Informed',
      'Denied',
      'Denied by Approve'
    ])
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusValidation);

  Logger.log('✅ Status validation updated successfully!');

  // Also try to show alert if UI is available
  try {
    SpreadsheetApp.getUi().alert('✅ Status validation updated!\n\nNew statuses added:\n• Pending Eng Inform\n• Completed & Informed\n• Denied by Approve');
  } catch (e) {
    // UI not available (running from Web App)
  }
}

/**
 * Export sheet structure information
 */
function exportSheetStructure() {
  const ss = getSpreadsheet();
  let info = '=== ROD END Drawing Request System - Sheet Structure ===\n\n';
  
  Object.keys(SHEET_CONFIG).forEach(key => {
    const config = SHEET_CONFIG[key];
    info += `Sheet: ${config.name}\n`;
    info += `Color: ${config.color}\n`;
    info += `Columns (${config.columns.length}):\n`;
    config.columns.forEach((col, idx) => {
      info += `  ${idx + 1}. ${col}\n`;
    });
    info += '\n';
  });
  
  Logger.log(info);
  SpreadsheetApp.getUi().alert('Sheet structure exported to Apps Script logs (View > Logs)');
}