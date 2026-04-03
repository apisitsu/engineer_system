/**
 * ROD END General Drawing Request System
 * Enhanced Version with Config Sheet
 * Email และ Configuration อ่านจาก Google Sheet
 */

// ===== CONFIGURATION =====
const CONFIG = {
  SPREADSHEET_ID: '1ScMsP8ZuZuHnigceg2k0Xc2HqvPvYsuYZUCaTm2gVKM',
  SHEET_NAMES: {
    REQUESTS: 'Requests',
    ENG_CHECK: 'Eng_Check',
    DRAFT_MAN: 'Draft_Man',
    DWG_CHECK: 'DWG_Check',
    ENG_REVIEW: 'Eng_Review',
    ENG_APPROVE: 'Eng_Approve',
    ENG_INFORM: 'Eng_Inform',
    TRACKING: 'Tracking',
    MASTER_DATA: 'Master_Data',
    CONFIG: 'Config',
    MACHINE: 'Machine',
    HOLIDAY: 'Holiday'
  },
  UPLOAD_FOLDER_NAME: 'ROD_Request_Attachments'
};

/**
 * Get Spreadsheet - ใช้ openById สำหรับ Web App
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * ฟังก์ชันอ่าน Email Configuration จาก Config Sheet
 */
function getEmailConfig() {
  try {
    // ใช้ CacheService เพื่อลดการอ่าน Sheet ซ้ำ
    const cache = CacheService.getScriptCache();
    const cached = cache.get('emailConfig');
    if (cached) {
      return JSON.parse(cached);
    }

    const ss = getSpreadsheet();
    const configSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);

    if (!configSheet) {
      Logger.log('Config sheet not found, using default values');
      return getDefaultEmailConfig();
    }

    const data = configSheet.getDataRange().getValues();
    const emailConfig = {};

    // อ่านข้อมูลจาก Sheet (Row 4-16 สำหรับ Email Config)
    // Row 3 เป็น header "EMAIL CONFIGURATION"
    // Row 4-16 เป็นข้อมูลจริง (13 config keys)
    for (let i = 3; i <= 15; i++) {  // แถว 4-16 (index 3-15)
      const configKey = data[i][0];  // Column A: Config Key
      const emails = data[i][1];      // Column B: Email Addresses

      if (configKey && emails) {
        // แปลง string emails เป็น array (คั่นด้วย comma หรือ semicolon)
        emailConfig[configKey] = emails.toString()
          .split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email.length > 0);
      }
    }

    // ถ้าไม่มีข้อมูลเลย ให้ใช้ค่า default
    if (Object.keys(emailConfig).length === 0) {
      Logger.log('No email config found, using default values');
      return getDefaultEmailConfig();
    }

    // Cache ไว้ 1 ชั่วโมง (3600 วินาที)
    cache.put('emailConfig', JSON.stringify(emailConfig), 3600);

    return emailConfig;

  } catch (error) {
    Logger.log('Error reading email config: ' + error.toString());
    return getDefaultEmailConfig();
  }
}

/**
 * ฟังก์ชันอ่าน Due Days Configuration จาก Config Sheet
 */
function getDueDaysConfig() {
  try {
    const ss = getSpreadsheet();
    const configSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
    
    if (!configSheet) {
      return getDefaultDueDays();
    }
    
    const data = configSheet.getDataRange().getValues();
    const dueDays = {};
    
    // อ่านจาก Row 15-17 (index 14-16) สำหรับ Due Days
    // Row 14 เป็น header "DUE DAYS CONFIGURATION"
    // Row 15-17 เป็นข้อมูลจริง
    for (let i = 14; i <= 16; i++) {  // แถว 15-17 (index 14-16)
      const requestType = data[i][0];  // Column A: Request Type
      const days = data[i][1];         // Column B: Days
      
      if (requestType && days && !isNaN(days)) {
        dueDays[requestType] = parseInt(days);
      }
    }
    
    // ถ้าไม่มีข้อมูลเลย ให้ใช้ค่า default
    if (Object.keys(dueDays).length === 0) {
      Logger.log('No due days config found, using default values');
      return getDefaultDueDays();
    }
    
    return dueDays;
    
  } catch (error) {
    Logger.log('Error reading due days config: ' + error.toString());
    return getDefaultDueDays();
  }
}

/**
 * Default Email Configuration (Fallback)
 */
function getDefaultEmailConfig() {
  return {
    ENG_CHECK: ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com', 'PATTANAPONG.PROMYAI@minebea.com'],
    CC_ENG_CHECK: ['SURANAT.NAKA@minebea.com', 'THAPANON.PRASERTSOM@minebea.com', 'PHANUWACH.THONGPRADAB@minebea.com'],
    DRAFTMAN: ['SURANAT.NAKA@minebea.com'],
    CC_DRAFTMAN: ['APISIT.SUWANNAKATE@minebea.com', 'PATTANAPONG.PROMYAI@minebea.com'],
    DWG_CHECK: ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com'],
    CC_DWG_CHECK: ['PATTANAPONG.PROMYAI@minebea.com'],
    ENG_REVIEW: ['TEERAPOL.KANTAPOOM@minebea.com'],
    CC_ENG_REVIEW: ['SURANAT.NAKA@minebea.com', 'CHAIRAT.SRIPRATUENG@minebea.com'],
    ENG_APPROVE: ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com'],
    CC_ENG_APPROVE: ['PATTANAPONG.PROMYAI@minebea.com'],
    ENG_INFORM: ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com'],
    CC_ENG_INFORM: ['PATTANAPONG.PROMYAI@minebea.com'],
    ADMIN: ['APISIT.SUWANNAKATE@minebea.com']
  };
}

/**
 * Check if current user is Admin
 * Reads from ADMIN row in Config sheet
 */
function isAdmin() {
  try {
    const currentUserEmail = Session.getActiveUser().getEmail().toLowerCase();
    const emailConfig = getEmailConfig();

    // Check ADMIN email list
    const adminEmails = emailConfig.ADMIN || [];
    for (var i = 0; i < adminEmails.length; i++) {
      if (adminEmails[i] && adminEmails[i].toLowerCase() === currentUserEmail) {
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log('Error checking admin user: ' + error.toString());
    return false;
  }
}

/**
 * Check if current user is Admin (callable from frontend)
 */
function checkIsAdmin() {
  return isAdmin();
}

/**
 * Get current user's email and roles (callable from frontend)
 */
function getUserRoles() {
  try {
    const currentUserEmail = Session.getActiveUser().getEmail();
    const emailConfig = getEmailConfig();
    const roles = [];

    // Check each role
    const roleMapping = {
      'ADMIN': 'Admin',
      'ENG_CHECK': 'Eng Check',
      'DRAFTMAN': 'Draftman',
      'DWG_CHECK': 'DWG Check',
      'ENG_REVIEW': 'Eng Review',
      'ENG_APPROVE': 'Eng Approve',
      'ENG_INFORM': 'Eng Inform'
    };

    for (const [configKey, roleName] of Object.entries(roleMapping)) {
      const emails = emailConfig[configKey] || [];
      for (let i = 0; i < emails.length; i++) {
        if (emails[i] && emails[i].toLowerCase() === currentUserEmail.toLowerCase()) {
          roles.push(roleName);
          break;
        }
      }
    }

    return {
      email: currentUserEmail,
      roles: roles,
      isAdmin: roles.includes('Admin')
    };
  } catch (error) {
    Logger.log('Error getting user roles: ' + error.toString());
    return {
      email: 'Unknown',
      roles: [],
      isAdmin: false
    };
  }
}

/**
 * Default Due Days Configuration (Fallback)
 */
function getDefaultDueDays() {
  return {
    'Regist Drawing': 5,
    'Draft Drawing': 7,
    '3D Print': 10
  };
}

// ===== MAIN FUNCTIONS =====

/**
 * Create Web App Menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 Request System')
    .addItem('🆕 New Request Form', 'openNewRequestForm')
    .addItem('✅ Eng Check Form', 'openEngCheckForm')
    .addItem('📝 Draft Man Form', 'openDraftManForm')
    .addItem('🔍 DWG Check Form', 'openDWGCheckForm')
    .addItem('📊 Eng Review Form', 'openEngReviewForm')
    .addItem('✔️ Eng Approve Form', 'openEngApproveForm')
    .addItem('📧 Eng Inform Form', 'openEngInformForm')
    .addSeparator()
    .addItem('📈 Dashboard', 'openDashboard')
    .addItem('🔄 Initialize Sheets', 'initializeSheets')
    .addSeparator()
    .addItem('⚙️ Open Config Sheet', 'openConfigSheet')
    .addItem('✅ Validate Email Config', 'validateEmailConfig')
    .addToUi();
}

/**
 * Open Config Sheet
 */
function openConfigSheet() {
  const ss = getSpreadsheet();
  const configSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
  
  if (configSheet) {
    ss.setActiveSheet(configSheet);
    SpreadsheetApp.getUi().alert('Config Sheet opened!\n\nYou can edit email addresses and due days here.');
  } else {
    SpreadsheetApp.getUi().alert('Config Sheet not found!\n\nPlease run "Initialize Sheets" first.');
  }
}

/**
 * Serve HTML pages
 */
function doGet(e) {
  // Handle case when e is undefined (running from editor)
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page || 'dashboard';
  const requestNo = params.requestNo || '';
  const openModal = params.openModal || '';
  const baseUrl = ScriptApp.getService().getUrl();

  let template;

  const requestItem = params.requestItem || '';

  // Handle openModal=view by serving RequestDetails page directly
  if (openModal === 'view' && requestNo) {
    template = HtmlService.createTemplateFromFile('RequestDetails');
    template.baseUrl = baseUrl;
    template.requestItem = requestNo;
    return template.evaluate()
      .setTitle('ROD END Drawing Request System')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  switch(page) {
    case 'new-request':
      template = HtmlService.createTemplateFromFile('NewRequestForm');
      template.baseUrl = baseUrl;
      break;
    case 'request-details':
      template = HtmlService.createTemplateFromFile('RequestDetails');
      template.baseUrl = baseUrl;
      template.requestItem = requestItem;
      break;
    case 'dashboard':
    default:
      // All workflow forms are now handled via modals in Dashboard
      template = HtmlService.createTemplateFromFile('Dashboard');
      template.baseUrl = baseUrl;
      template.openModal = openModal;
      template.requestNo = requestNo;
      break;
  }

  return template.evaluate()
    .setTitle('ROD END Drawing Request System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include CSS/JS files
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== NEW REQUEST FUNCTIONS =====

/**
 * Generate new Request Item (auto-generated ID)
 */
function generateRequestItem() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return 'ITEM-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-001';
  }

  const lastRequestItem = sheet.getRange(lastRow, 1).getValue();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');

  if (lastRequestItem && lastRequestItem.includes(today)) {
    const num = parseInt(lastRequestItem.split('-')[2]) + 1;
    return 'ITEM-' + today + '-' + String(num).padStart(3, '0');
  } else {
    return 'ITEM-' + today + '-001';
  }
}

/**
 * Calculate due date based on type of request
 */
function calculateDueDate(typeOfRequest, startDate) {
  const dueDaysConfig = getDueDaysConfig();  // ← อ่านจาก Config Sheet
  const dueDays = dueDaysConfig[typeOfRequest] || 7;
  
  let dueDate = new Date(startDate);
  let addedDays = 0;
  
  while (addedDays < dueDays) {
    dueDate.setDate(dueDate.getDate() + 1);
    if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) {
      addedDays++;
    }
  }
  
  return dueDate;
}

/**
 * Submit new request
 */
function submitNewRequest(formData) {
  try {
    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);
    
    const requestItem = generateRequestItem();
    const timestamp = new Date();
    const dueDate = calculateDueDate(formData.typeOfRequest, timestamp);
    
    // Add to Requests sheet (column 20 = Request No, will be filled by Eng Check)
    requestSheet.appendRow([
      requestItem,
      timestamp,
      'Pending Eng Check',
      formData.department,
      formData.wc,
      formData.requester,
      formData.requesterEmail,
      formData.typeOfRequest,
      formData.category,
      formData.drawingRequired || 'N/A',
      formData.typeOfDrawing || 'N/A',
      formData.noOfMachine,
      formData.machineName,
      dueDate,
      formData.title,
      formData.detail,
      formData.attachmentUrls || '',
      'Eng Check',
      timestamp,
      ''  // Column 20: Request No (assigned by Eng Check)
    ]);

    // Add to Tracking sheet
    trackingSheet.appendRow([
      requestItem,
      formData.typeOfRequest,
      1,
      'Pending Eng Check',
      timestamp,
      '', '', '', '', '', '',
      '', '', '', '', '', '',
      dueDate,
      ''
    ]);

    const emailConfig = getEmailConfig();

    clearDashboardCache();

    return {
      success: true,
      requestItem: requestItem,
      message: 'Request submitted successfully!',
      emailParams: {
        type: 'new-request',
        requestNo: requestItem,
        data: formData,
        recipients: emailConfig.ENG_CHECK || [],
        ccRecipients: emailConfig.CC_ENG_CHECK || []
      }
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

// ===== ENG CHECK FUNCTIONS =====

/**
 * Get request data for Eng Check
 */
function getRequestForEngCheck(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === requestItem) {
      return {
        requestItem: data[i][0],           // Column 1: Request Item
        requestNo: data[i][19] || '',      // Column 20: Request No (assigned by Eng Check)
        department: data[i][3],
        requester: data[i][5],
        typeOfRequest: data[i][7],
        category: data[i][8],
        title: data[i][14],
        detail: data[i][15],
        attachFiles: data[i][16] || ''     // Column 17: Attachment URLs from Request
      };
    }
  }
  return null;
}

/**
 * Submit Eng Check
 */
function submitEngCheck(formData) {
  try {
    // === VALIDATION ===
    const validation = validateWorkflowSubmission(formData.requestItem, 'Pending Eng Check', 'ENG_CHECK');
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const engCheckSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_CHECK);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);

    const timestamp = new Date();

    // Get current user info automatically
    const currentUser = Session.getActiveUser().getEmail();
    const userName = currentUser.split('@')[0].replace('.', ' ');

    // Add to Eng Check sheet (with both Request Item and Request No)
    engCheckSheet.appendRow([
      formData.requestItem,      // Request Item (auto-generated)
      formData.requestNo,        // Request No (assigned by Eng Check)
      timestamp,
      userName,
      currentUser,
      formData.status,
      formData.comment || ''
    ]);

    // Update Requests sheet - find by Request Item (column 1)
    const requestData = requestSheet.getDataRange().getValues();
    for (let i = 1; i < requestData.length; i++) {
      if (requestData[i][0] === formData.requestItem) {
        if (formData.status === 'Approve') {
          requestSheet.getRange(i + 1, 3).setValue('Pending Draft Man');
          requestSheet.getRange(i + 1, 18).setValue('Draft Man');
        } else {
          requestSheet.getRange(i + 1, 3).setValue('Denied');
          requestSheet.getRange(i + 1, 18).setValue('Denied');
        }
        requestSheet.getRange(i + 1, 19).setValue(timestamp);
        // Save Request No to column 20
        requestSheet.getRange(i + 1, 20).setValue(formData.requestNo);
        break;
      }
    }

    // Update Tracking sheet - find by Request Item
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < trackingData.length; i++) {
      if (trackingData[i][0] === formData.requestItem) {
        trackingSheet.getRange(i + 1, 6).setValue(timestamp);

        const createdDate = new Date(trackingData[i][4]);
        const duration = calculateWorkingDays(createdDate, timestamp);
        trackingSheet.getRange(i + 1, 12).setValue(duration);

        if (formData.status === 'Approve') {
          trackingSheet.getRange(i + 1, 4).setValue('Pending Draft Man');
        } else {
          trackingSheet.getRange(i + 1, 4).setValue('Denied');
        }
        break;
      }
    }
    
    const emailConfig = getEmailConfig();
    var emailParams;
    if (formData.status === 'Approve') {
      emailParams = {
        type: 'eng-check-approved',
        requestNo: formData.requestItem,
        data: {...formData, requestNo: formData.requestNo},
        recipients: emailConfig.DRAFTMAN || [],
        ccRecipients: emailConfig.CC_DRAFTMAN || []
      };
    } else {
      const requestInfo = getRequestInfo(formData.requestItem);
      emailParams = {
        type: 'request-denied',
        requestNo: formData.requestItem,
        data: {...formData, ...requestInfo},
        recipients: [requestInfo.requesterEmail],
        ccRecipients: []
      };
    }

    clearDashboardCache();

    return {
      success: true,
      message: 'Eng Check submitted successfully!',
      emailParams: emailParams
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Calculate working days between two dates
 */
function calculateWorkingDays(startDate, endDate) {
  let count = 0;
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return count;
}

/**
 * Get request information
 */
function getRequestInfo(requestNo) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === requestNo) {
      return {
        requestNo: data[i][0],
        timestamp: data[i][1],
        status: data[i][2],
        department: data[i][3],
        requester: data[i][5],
        requesterEmail: data[i][6],
        typeOfRequest: data[i][7],
        title: data[i][14],
        dueDate: data[i][13]
      };
    }
  }
  return null;
}

/**
 * Get all pending requests for a stage
 */
function getPendingRequests(stage) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const data = sheet.getDataRange().getValues();
  const pendingRequests = [];

  const stageMap = {
    'eng-check': 'Eng Check',
    'draft-man': 'Draft Man',
    'dwg-check': 'DWG Check',
    'eng-review': 'Eng Review',
    'eng-approve': 'Eng Approve',
    'eng-inform': 'Eng Inform'
  };

  const targetStage = stageMap[stage];

  for (let i = 1; i < data.length; i++) {
    let matches = false;

    // Check if current stage matches and status includes 'Pending'
    matches = data[i][17] === targetStage && String(data[i][2]).includes('Pending');

    if (matches) {
      // Get additional data for eng-inform
      let drawingNo = '';
      let completedDate = '';

      if (stage === 'eng-inform') {
        const reviewData = getEngReviewData(data[i][0]);
        if (reviewData) {
          drawingNo = reviewData.drawingNo;
        }
        completedDate = data[i][18]; // Last updated
      }

      pendingRequests.push({
        requestItem: data[i][0],         // Column 1: Request Item (auto-generated)
        requestNo: data[i][19] || '',    // Column 20: Request No (assigned by Eng Check)
        timestamp: data[i][1],
        requester: data[i][5],
        typeOfRequest: data[i][7],
        category: data[i][8],
        title: data[i][14],
        dueDate: data[i][13],
        drawingNo: drawingNo,
        completedDate: completedDate
      });
    }
  }

  return pendingRequests;
}

/**
 * Clear dashboard cache - เรียกหลัง submit เพื่อให้ข้อมูลอัพเดท
 */
function clearDashboardCache() {
  CacheService.getScriptCache().remove('dashboardData');
}

/**
 * Fire-and-forget email sending - เรียกจาก frontend หลัง submit สำเร็จ
 */
function sendFormEmail(emailParams) {
  try {
    if (!emailParams) return;
    if (emailParams.isEngInform) {
      sendEngInformEmail(emailParams.formData, emailParams.requestInfo, emailParams.reviewData);
    } else {
      sendEmailNotification(emailParams.type, emailParams.requestNo, emailParams.data, emailParams.recipients || [], emailParams.ccRecipients || []);
    }
  } catch (e) {
    Logger.log('sendFormEmail error: ' + e.toString());
  }
}

/**
 * Send email notifications
 */
function sendEmailNotification(type, requestNo, data, recipients, ccRecipients) {
  try {
    let subject = '';
    let body = '';
    const webAppUrl = ScriptApp.getService().getUrl();

    switch(type) {
      case 'new-request':
        subject = `[New Request] ${requestNo} - ${data.title}`;
        body = `
          <h2>New Drawing Request</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Requester:</strong> ${data.requester}</p>
          <p><strong>Department:</strong> ${data.department}</p>
          <p><strong>Type:</strong> ${data.typeOfRequest}</p>
          <p><strong>Title:</strong> ${data.title}</p>
          <p><strong>Detail:</strong> ${data.detail}</p>
          <hr>
          <p>Please review and approve this request:</p>
          <p><a href="${webAppUrl}?openModal=eng-check&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Click here to review</a></p>
        `;
        break;

      case 'eng-check-approved':
        subject = `[Approved] ${requestNo} - Ready for Draft`;
        body = `
          <h2>Request Approved - Ready for Drafting</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Request No:</strong> ${data.requestNo || 'N/A'}</p>
          <p><strong>Type:</strong> ${data.typeOfRequest || 'N/A'}</p>
          <p>This request has been approved and is ready for drafting.</p>
          <p><a href="${webAppUrl}?openModal=draft-man&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Click here to start drafting</a></p>
        `;
        break;

      case 'request-denied':
        subject = `[Denied] ${requestNo} - ${data.title}`;
        body = `
          <h2>Request Denied</h2>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Reason:</strong> ${data.comment}</p>
          <p>Please contact the engineering team for more information.</p>
        `;
        break;

      case 'draft-completed':
        subject = `[Draft Complete] ${requestNo} - Ready for DWG Check`;
        body = `
          <h2>Draft Work Completed</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Request No:</strong> ${data.requestNo || 'N/A'}</p>
          <p><strong>Draftman:</strong> ${data.draftman || 'N/A'}</p>
          <p>The drafting work has been completed and is ready for DWG Check.</p>
          <p><a href="${webAppUrl}?openModal=dwg-check&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Review Drawing</a></p>
        `;
        break;

      case 'dwg-check-approved':
        subject = `[DWG Approved] ${requestNo} - Ready for Eng Review`;
        body = `
          <h2>DWG Check Approved</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Request No:</strong> ${data.requestNo || 'N/A'}</p>
          <p><strong>Checked by:</strong> ${data.checker || 'N/A'}</p>
          <p>The drawing has been checked and approved. Please proceed with Engineering Review.</p>
          <p><a href="${webAppUrl}?openModal=eng-review&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Start Review</a></p>
        `;
        break;

      case 'dwg-check-denied':
        subject = `[DWG Revision Required] ${requestNo}`;
        body = `
          <h2>DWG Check - Revision Required</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Request No:</strong> ${data.requestNo || 'N/A'}</p>
          <p><strong>Checked by:</strong> ${data.checker || 'N/A'}</p>
          <p><strong>Comment:</strong> ${data.comment || 'N/A'}</p>
          <p>Please revise the drawing and resubmit.</p>
          <p><a href="${webAppUrl}?openModal=draft-man&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#FFA000; color:white; text-decoration:none; border-radius:6px;">Revise Drawing</a></p>
        `;
        break;

      case 'eng-review-completed':
        subject = `[Review Complete] ${requestNo} - Ready for Final Approval`;
        body = `
          <h2>Engineering Review Completed</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Request No:</strong> ${data.requestNo || 'N/A'}</p>
          <p><strong>Drawing No:</strong> ${data.drawingNo || 'N/A'}</p>
          <p><strong>Reviewed by:</strong> ${data.reviewer || 'N/A'}</p>
          <p>The engineering review is complete. Please proceed with final approval.</p>
          <p><a href="${webAppUrl}?openModal=eng-approve&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Approve Now</a></p>
        `;
        break;

      case 'eng-approve-completed':
        subject = `[Approved] ${requestNo} - Ready to Inform Requester`;
        body = `
          <h2>Engineering Approval Completed</h2>
          <p><strong>Request Item:</strong> ${requestNo}</p>
          <p><strong>Request No:</strong> ${data.requestNo || 'N/A'}</p>
          <p><strong>Title:</strong> ${data.title || 'N/A'}</p>
          <p><strong>Approved by:</strong> ${data.approver || 'N/A'}</p>
          <p>The request has been approved. Please inform the requester.</p>
          <p><a href="${webAppUrl}?openModal=eng-inform&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4CAF50; color:white; text-decoration:none; border-radius:6px;">Send Notification</a></p>
        `;
        break;

      case 'request-completed':
        subject = `[Completed] ${requestNo} - ${data.title || 'Drawing Request'}`;
        body = `
          <div style="background:#E8F5E9; padding:20px; border-left:5px solid #4CAF50; margin-bottom:20px;">
            <h2 style="color:#2E7D32; margin:0;">Request Completed!</h2>
          </div>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Title:</strong> ${data.title || 'N/A'}</p>
          <p><strong>Drawing No:</strong> ${data.drawingNo || 'See attached files'}</p>
          <p>Your drawing request has been completed and approved.</p>
          <hr style="border:none; border-top:1px solid #ddd; margin:20px 0;">
          <p style="color:#666; font-size:12px;">Thank you for using the ROD END Drawing Request System.</p>
        `;
        break;

      case 'request-denied-final':
        subject = `[Not Approved] ${requestNo} - ${data.title || 'Drawing Request'}`;
        body = `
          <div style="background:#FFEBEE; padding:20px; border-left:5px solid #F44336; margin-bottom:20px;">
            <h2 style="color:#C62828; margin:0;">Request Not Approved</h2>
          </div>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Title:</strong> ${data.title || 'N/A'}</p>
          <p><strong>Reason:</strong> ${data.comment || 'No comment provided'}</p>
          <p>Please contact the engineering team for more information.</p>
        `;
        break;

      default:
        subject = `[Notification] ${requestNo}`;
        body = `
          <h2>Request Update</h2>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p>There has been an update to this request.</p>
          <p><a href="${webAppUrl}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">View Dashboard</a></p>
        `;
        break;
    }

    // Only send if there are recipients
    if (!recipients || recipients.length === 0 || !recipients.join(',').trim()) {
      Logger.log('No recipients for email type: ' + type);
      return;
    }

    const mailOptions = {
      to: recipients.join(','),
      subject: subject,
      htmlBody: body
    };

    // Only add CC if there are CC recipients
    if (ccRecipients && ccRecipients.length > 0 && ccRecipients.join(',').trim()) {
      mailOptions.cc = ccRecipients.join(',');
    }

    MailApp.sendEmail(mailOptions);

  } catch (error) {
    Logger.log('Error sending email: ' + error.toString());
  }
}

/**
 * Get ALL dashboard data in one call - user info + requests
 */
function getDashboardDataWithUserInfo() {
  const userRoles = getUserRoles();
  const dashboardData = getDashboardData();

  return {
    userInfo: userRoles,
    isDraftman: userRoles.roles.includes('Draftman'),
    ...dashboardData
  };
}

/**
 * Get dashboard data - optimized with cache
 */
function getDashboardData() {
  try {
    // ลองดึงจาก cache ก่อน (cache 30 วินาที)
    const cache = CacheService.getScriptCache();
    const cached = cache.get('dashboardData');
    if (cached) {
      return JSON.parse(cached);
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);

    if (!requestSheet) {
      return {
        summary: { total: 0, pending: 0, completed: 0, denied: 0, overdue: 0 },
        recentRequests: []
      };
    }

    const requestData = requestSheet.getDataRange().getValues();

    if (requestData.length <= 1) {
      return {
        summary: { total: 0, pending: 0, completed: 0, denied: 0, overdue: 0 },
        recentRequests: []
      };
    }

    const summary = {
      total: requestData.length - 1,
      pending: 0,
      completed: 0,
      denied: 0,
      overdue: 0
    };

    const recentRequests = [];
    const today = new Date();

    for (let i = 1; i < requestData.length; i++) {
      const status = requestData[i][2] ? String(requestData[i][2]) : '';
      const dueDate = requestData[i][13] ? new Date(requestData[i][13]) : new Date();

      if (status.includes('Pending')) {
        summary.pending++;
        if (today > dueDate) {
          summary.overdue++;
        }
      } else if (status === 'Completed' || status === 'Completed & Informed') {
        summary.completed++;
      } else if (status === 'Denied') {
        summary.denied++;
      }

      const timestamp = requestData[i][1];
      const dueDateVal = requestData[i][13];

      recentRequests.push({
        requestItem: requestData[i][0] || '',
        requestNo: requestData[i][19] || '',
        timestamp: timestamp instanceof Date ? timestamp.toISOString() : (timestamp || new Date().toISOString()),
        status: status,
        requester: requestData[i][5] || '',
        typeOfRequest: requestData[i][7] || '',
        title: requestData[i][14] || '',
        currentStage: requestData[i][17] || '',
        dueDate: dueDateVal instanceof Date ? dueDateVal.toISOString() : (dueDateVal || '')
      });
    }

    recentRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const result = {
      summary: summary,
      recentRequests: recentRequests.slice(0, 200)  // ส่งแค่ 200 รายการล่าสุด
    };

    // Cache ไว้ 30 วินาที
    cache.put('dashboardData', JSON.stringify(result), 30);

    return result;

  } catch (error) {
    Logger.log('Error in getDashboardData: ' + error.toString());
    return {
      summary: { total: 0, pending: 0, completed: 0, denied: 0, overdue: 0 },
      recentRequests: []
    };
  }
}

/**
 * Test function to check email config
 */
function testEmailConfig() {
  const emailConfig = getEmailConfig();
  Logger.log('Email Configuration:');
  Logger.log(JSON.stringify(emailConfig, null, 2));

  const dueDays = getDueDaysConfig();
  Logger.log('Due Days Configuration:');
  Logger.log(JSON.stringify(dueDays, null, 2));
}

/**
 * Get current user information
 */
function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    var effectiveEmail = Session.getEffectiveUser().getEmail();

    // Try to get user name from email (before @)
    var name = email.split('@')[0];

    // Format name: capitalize first letter of each word
    name = name.split('.').map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');

    return {
      email: email || effectiveEmail,
      name: name,
      effectiveEmail: effectiveEmail
    };
  } catch (error) {
    Logger.log('Error getting current user: ' + error.toString());
    return {
      email: 'unknown@email.com',
      name: 'Unknown User',
      effectiveEmail: ''
    };
  }
}

// ===== MACHINE & WC FUNCTIONS =====

/**
 * Get Machine list from Machine sheet
 * Returns array of {code, name} objects
 */
function getMachineList() {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.MACHINE);

    if (!sheet) {
      Logger.log('Machine sheet not found');
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var machines = [];

    // Skip header row (index 0)
    for (var i = 1; i < data.length; i++) {
      var code = data[i][0]; // Machine_code
      var name = data[i][1]; // Machine_name

      if (code) {
        machines.push({
          code: code.toString(),
          name: name ? name.toString() : ''
        });
      }
    }

    return machines;
  } catch (error) {
    Logger.log('Error getting machine list: ' + error.toString());
    return [];
  }
}

/**
 * Get Machine name by code
 */
function getMachineNameByCode(machineCode) {
  try {
    var machines = getMachineList();
    for (var i = 0; i < machines.length; i++) {
      if (machines[i].code === machineCode) {
        return machines[i].name;
      }
    }
    return '';
  } catch (error) {
    Logger.log('Error getting machine name: ' + error.toString());
    return '';
  }
}

/**
 * Get Department list from Department sheet
 * Returns array of {name} objects
 */
function getDepartmentList() {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Department');

    if (!sheet) {
      Logger.log('getDepartmentList: Department sheet not found');
      return [];
    }

    var data = sheet.getDataRange().getValues();
    Logger.log('getDepartmentList: found ' + data.length + ' rows');
    var departments = [];

    // Skip header row (index 0)
    for (var i = 1; i < data.length; i++) {
      var name = data[i][0]; // Department name in column A

      if (name) {
        departments.push({
          name: String(name)
        });
      }
    }

    Logger.log('getDepartmentList: returning ' + departments.length + ' departments');
    return departments;
  } catch (error) {
    Logger.log('Error getting department list: ' + error.toString());
    return [];
  }
}

/**
 * Get WC-Department mapping from Master_Data sheet
 * Assumes Master_Data has columns: WC, Department, WC_Name
 */
function getWCDepartmentMapping() {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.MASTER_DATA);

    if (!sheet) {
      Logger.log('Master_Data sheet not found');
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    // Find WC and Department column indices
    var wcIndex = -1;
    var wcNameIndex = -1;

    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase().trim();
      if (header === 'wc' || header === 'work_center' || header === 'workcenter' || header === 'work center') {
        wcIndex = i;
      }
      if (header === 'department' || header === 'departments' || header === 'dept') {
        wcNameIndex = i;
      }
    }

    if (wcIndex === -1 || wcNameIndex === -1) {
      Logger.log('WC or Department column not found in Master_Data');
      return [];
    }

    var mapping = [];

    // Skip header row
    for (var i = 1; i < data.length; i++) {
      var wc = data[i][wcIndex];
      var dept = data[i][wcNameIndex];

      if (wc) {
        mapping.push({
          wc: wc.toString(),
          wcName: dept ? dept.toString() : ''
        });
      }
    }

    return mapping;
  } catch (error) {
    Logger.log('Error getting WC-Department mapping: ' + error.toString());
    return [];
  }
}

/**
 * Get Department by WC
 */
function getDepartmentByWC(wc) {
  try {
    var mapping = getWCDepartmentMapping();
    for (var i = 0; i < mapping.length; i++) {
      if (mapping[i].wc === wc) {
        return mapping[i].wcName;
      }
    }
    return '';
  } catch (error) {
    Logger.log('Error getting WC Name by WC: ' + error.toString());
    return '';
  }
}

/**
 * Get Holiday list from Holiday sheet
 */
function getHolidayList() {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.HOLIDAY);

    if (!sheet) {
      Logger.log('Holiday sheet not found');
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var holidays = [];

    // Skip header row
    for (var i = 1; i < data.length; i++) {
      var date = data[i][0]; // Holiday_Date
      if (date) {
        // Convert to Date object if it's not already
        if (date instanceof Date) {
          holidays.push(date);
        } else {
          holidays.push(new Date(date));
        }
      }
    }

    return holidays;
  } catch (error) {
    Logger.log('Error getting holiday list: ' + error.toString());
    return [];
  }
}

// ===== FILE UPLOAD FUNCTIONS =====

/**
 * Get Shared Drive folder ID from Config sheet
 * Reads from row 20 (SHARED_DRIVE_FOLDER_ID)
 */
function getSharedDriveFolderId() {
  try {
    const ss = getSpreadsheet();
    const configSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);

    if (!configSheet) {
      return null;
    }

    const data = configSheet.getDataRange().getValues();

    // Look for SHARED_DRIVE_FOLDER_ID in config
    for (let i = 0; i < data.length; i++) {
      const key = String(data[i][0] || '').trim();
      if (key === '0AMiimYI30hVjUk9PVA' || key === '1_bMUV06FCwpRjbX2kexn4BI3-9YXyMzj') {
        return String(data[i][1] || '').trim() || null;
      }
    }

    return null;
  } catch (error) {
    Logger.log('Error reading Shared Drive folder ID: ' + error.toString());
    return null;
  }
}

/**
 * Get or create upload folder in Google Drive or Shared Drive
 * If SHARED_DRIVE_FOLDER_ID is configured, uses that folder
 * Otherwise falls back to creating folder in user's My Drive
 */
function getUploadFolder() {
  // First, try to use Shared Drive folder if configured
  var sharedFolderId = getSharedDriveFolderId();

  if (sharedFolderId) {
    try {
      var sharedFolder = DriveApp.getFolderById(sharedFolderId);
      Logger.log('Using Shared Drive folder: ' + sharedFolder.getName());
      return sharedFolder;
    } catch (error) {
      Logger.log('Error accessing Shared Drive folder: ' + error.toString());
      // Fall back to My Drive
    }
  }

  // Fallback: use My Drive
  var folderName = CONFIG.UPLOAD_FOLDER_NAME;
  var folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

/**
 * Upload file to Google Drive
 * @param {Object} fileData - {name: string, mimeType: string, data: base64 string}
 * @param {string} requestNo - Request number for subfolder organization
 * @returns {Object} - {success: boolean, url: string, fileId: string, message: string}
 */
function uploadFile(fileData, requestNo) {
  try {
    Logger.log('uploadFile called for: ' + fileData.name + ', requestNo: ' + requestNo);

    // Validate input
    if (!fileData || !fileData.data) {
      Logger.log('Error: No file data provided');
      return {
        success: false,
        url: '',
        fileId: '',
        fileName: fileData ? fileData.name : '',
        message: 'No file data provided'
      };
    }

    // Sanitize filename - remove problematic characters
    var safeName = fileData.name.replace(/[<>:"/\\|?*]/g, '_');
    Logger.log('Safe filename: ' + safeName);

    // Get or create main upload folder
    var mainFolder = getUploadFolder();
    Logger.log('Got main folder: ' + mainFolder.getName());

    // Create subfolder for this request if requestNo is provided
    var targetFolder = mainFolder;
    if (requestNo) {
      // Sanitize folder name too
      var safeFolderName = requestNo.toString().replace(/[<>:"/\\|?*]/g, '_');
      var subfolders = mainFolder.getFoldersByName(safeFolderName);
      if (subfolders.hasNext()) {
        targetFolder = subfolders.next();
        Logger.log('Using existing subfolder: ' + safeFolderName);
      } else {
        targetFolder = mainFolder.createFolder(safeFolderName);
        Logger.log('Created new subfolder: ' + safeFolderName);
      }
    }

    // Decode base64 data
    Logger.log('Decoding base64 data, length: ' + fileData.data.length);
    var decodedData = Utilities.base64Decode(fileData.data);
    Logger.log('Decoded data length: ' + decodedData.length);

    // Create blob with sanitized name
    var mimeType = fileData.mimeType || 'application/octet-stream';
    var blob = Utilities.newBlob(decodedData, mimeType, safeName);
    Logger.log('Created blob with mimeType: ' + mimeType);

    // Create file in folder
    var file = targetFolder.createFile(blob);
    Logger.log('File created: ' + file.getId());

    // Try to set file to be viewable by anyone with the link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log('Sharing set successfully');
    } catch (shareError) {
      Logger.log('Could not set sharing (file still uploaded): ' + shareError.toString());
      // Continue - file is still uploaded, just not shared publicly
    }

    var fileUrl = file.getUrl();
    Logger.log('Upload complete, URL: ' + fileUrl);

    return {
      success: true,
      url: fileUrl,
      fileId: file.getId(),
      fileName: safeName,
      message: 'File uploaded successfully'
    };
  } catch (error) {
    Logger.log('Error uploading file "' + (fileData ? fileData.name : 'unknown') + '": ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return {
      success: false,
      url: '',
      fileId: '',
      fileName: fileData ? fileData.name : '',
      message: 'Upload error: ' + error.toString()
    };
  }
}

/**
 * Upload multiple files
 * @param {Array} filesData - Array of file data objects
 * @param {string} requestNo - Request number for subfolder organization
 * @returns {Object} - {success: boolean, files: Array, message: string}
 */
function uploadMultipleFiles(filesData, requestNo) {
  try {
    var results = [];

    for (var i = 0; i < filesData.length; i++) {
      var result = uploadFile(filesData[i], requestNo);
      results.push(result);
    }

    var allSuccess = results.every(function(r) { return r.success; });

    return {
      success: allSuccess,
      files: results,
      message: allSuccess ? 'All files uploaded successfully' : 'Some files failed to upload'
    };
  } catch (error) {
    Logger.log('Error uploading multiple files: ' + error.toString());
    return {
      success: false,
      files: [],
      message: 'Error uploading files: ' + error.toString()
    };
  }
}