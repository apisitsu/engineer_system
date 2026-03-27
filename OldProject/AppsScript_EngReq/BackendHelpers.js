/**
 * ================================================================
 * BACKEND HELPER FUNCTIONS
 * ================================================================
 * Additional backend functions for forms
 */

/**
 * Get request data for Eng Review
 */
function getRequestForEngReview(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === requestItem) {
      return {
        requestItem: data[i][0],           // Column 1: Request Item
        requestNo: data[i][19] || '',      // Column 20: Request No (Eng)
        department: data[i][3],            // Column 4: Department
        requester: data[i][5],             // Column 6: Requester
        typeOfRequest: data[i][7],         // Column 8: Type of Request
        category: data[i][8],              // Column 9: Category
        drawingRequired: data[i][9],       // Column 10: Drawing Required
        title: data[i][14],               // Column 15: Title
        detail: data[i][15]               // Column 16: Detail
      };
    }
  }
  return null;
}

/**
 * Get request data for Eng Inform
 */
function getRequestForEngInform(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === requestItem) {
      return {
        requestItem: data[i][0],              // Column 1: Request Item (ITEM-xxx)
        requestNo: data[i][19] || '-',        // Column 20: Request No (assigned by Eng Check, e.g., 25G0403)
        department: data[i][3],
        requester: data[i][5],
        requesterEmail: data[i][6],
        typeOfRequest: data[i][7],
        title: data[i][14],
        detail: data[i][15]
      };
    }
  }
  return null;
}

/**
 * Get Draft Man data
 */
function getDraftManData(requestNo) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DRAFT_MAN);

  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();

  // Find the latest entry for this request
  for (let i = data.length - 1; i >= 1; i--) {
    const sheetValue = String(data[i][0] || '').trim();
    const searchValue = String(requestNo || '').trim();

    if (sheetValue === searchValue) {
      return {
        requestNo: String(data[i][0] || ''),
        timestamp: data[i][1] ? new Date(data[i][1]).toISOString() : '',
        draftman: String(data[i][2] || ''),
        draftmanEmail: String(data[i][3] || ''),
        dwgFiles: String(data[i][4] || '')
      };
    }
  }
  return null;
}

/**
 * Get Eng Review data
 */
function getEngReviewData(requestNo) {
  Logger.log('getEngReviewData called with: "' + requestNo + '"');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_REVIEW);

  if (!sheet) {
    Logger.log('Eng_Review sheet not found');
    return null;
  }

  const data = sheet.getDataRange().getValues();
  Logger.log('Eng_Review sheet has ' + data.length + ' rows');

  // Find the latest entry for this request
  for (let i = data.length - 1; i >= 1; i--) {
    const sheetValue = String(data[i][0] || '').trim();
    const searchValue = String(requestNo || '').trim();

    if (sheetValue === searchValue) {
      Logger.log('Found Eng Review match at row ' + i);
      var result = {
        requestNo: String(data[i][0] || ''),
        timestamp: data[i][1] ? new Date(data[i][1]).toISOString() : '',
        reviewer: String(data[i][2] || ''),
        reviewerEmail: String(data[i][3] || ''),
        section: String(data[i][4] || ''),
        sparePartType: String(data[i][5] || ''),
        general: String(data[i][6] || ''),
        machinePart: String(data[i][7] || ''),
        gaugeType: String(data[i][8] || ''),
        noOfDwg: String(data[i][9] || ''),
        drawingNo: String(data[i][10] || ''),
        attachFiles: String(data[i][11] || '')
      };
      Logger.log('Returning Eng Review: ' + JSON.stringify(result));
      return result;
    }
  }
  Logger.log('No Eng Review match found for: "' + requestNo + '"');
  return null;
}

/**
 * Submit Eng Inform
 */
function submitEngInform(formData) {
  try {
    // === VALIDATION ===
    const validation = validateWorkflowSubmission(formData.requestNo, 'Pending Eng Inform', 'ENG_INFORM');
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const engInformSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_INFORM);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);

    const timestamp = new Date();

    // Add to Eng Inform sheet
    engInformSheet.appendRow([
      formData.requestNo,
      timestamp,
      formData.cost || 'N/A',
      formData.evidence || '',
      formData.attachFiles || '',
      timestamp  // Sent to Requester timestamp
    ]);

    // Update Requests sheet - mark as informed
    const requestData = requestSheet.getDataRange().getValues();
    for (let i = 1; i < requestData.length; i++) {
      if (requestData[i][0] === formData.requestNo) {
        requestSheet.getRange(i + 1, 3).setValue('Completed & Informed');
        requestSheet.getRange(i + 1, 18).setValue('Informed');
        requestSheet.getRange(i + 1, 19).setValue(timestamp);
        break;
      }
    }

    // Update Tracking sheet
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < trackingData.length; i++) {
      if (trackingData[i][0] === formData.requestNo) {
        trackingSheet.getRange(i + 1, 4).setValue('Completed');
        trackingSheet.getRange(i + 1, 11).setValue(timestamp); // Completed Date

        // Calculate total duration
        const createdDate = new Date(trackingData[i][4]);
        const totalDuration = calculateWorkingDays(createdDate, timestamp);
        trackingSheet.getRange(i + 1, 17).setValue(totalDuration); // Total Duration

        // Check if on time
        const dueDate = new Date(trackingData[i][17]); // Due Date is in column 18 (index 17)
        const onTime = timestamp <= dueDate ? 'Yes' : 'No';
        trackingSheet.getRange(i + 1, 19).setValue(onTime); // On Time?
        break;
      }
    }

    const requestInfo = getRequestInfo(formData.requestNo);
    const reviewData = getEngReviewData(formData.requestNo);

    clearDashboardCache();

    return {
      success: true,
      message: 'Requester has been notified successfully!',
      emailParams: {
        isEngInform: true,
        formData: formData,
        requestInfo: requestInfo,
        reviewData: reviewData
      }
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

/**
 * Send Eng Inform email to requester
 */
function sendEngInformEmail(formData, requestInfo, reviewData) {
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    const emailConfig = getEmailConfig();

    let body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50, #2E7D32); padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">✅ Drawing Request Completed!</h1>
        </div>

        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Request Details</h2>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; font-weight: bold; width: 40%;">Request Item:</td>
              <td style="padding: 10px;">${formData.requestNo}</td>
            </tr>
            <tr style="background: #fff;">
              <td style="padding: 10px; font-weight: bold;">Title:</td>
              <td style="padding: 10px;">${requestInfo.title}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">Type:</td>
              <td style="padding: 10px;">${requestInfo.typeOfRequest}</td>
            </tr>
            ${reviewData ? `
            <tr style="background: #fff;">
              <td style="padding: 10px; font-weight: bold;">Drawing No:</td>
              <td style="padding: 10px;">${reviewData.drawingNo}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">Request No:</td>
              <td style="padding: 10px;">${requestInfo.requestNo || '-'}</td>
            </tr>
            <tr style="background: #fff;">
              <td style="padding: 10px; font-weight: bold;">No. of DWG:</td>
              <td style="padding: 10px;">${reviewData.noOfDwg}</td>
            </tr>
            ` : ''}
            ${formData.cost ? `
            <tr>
              <td style="padding: 10px; font-weight: bold;">Cost:</td>
              <td style="padding: 10px;">${formData.cost}</td>
            </tr>
            ` : ''}
          </table>

          ${formData.evidence ? `
          <h3 style="color: #333;">Evidence / Notes:</h3>
          <p style="background: #fff; padding: 15px; border-radius: 6px;">${formData.evidence}</p>
          ` : ''}

          ${formData.attachFiles ? `
          <h3 style="color: #333;">📎 Attached Files:</h3>
          <div style="background: #fff; padding: 15px; border-radius: 6px;">
            ${formData.attachFiles.split('\n').map((file, i) => {
              if (!file.trim()) return '';
              var fileStr = file.trim();
              var fileName, url;
              if (fileStr.indexOf('|') !== -1) {
                var parts = fileStr.split('|');
                fileName = parts[0];
                url = parts[1];
              } else {
                url = fileStr;
                fileName = 'File ' + (i + 1);
              }
              return `<a href="${url}" style="color: #4285F4; display: block; margin: 5px 0;">📄 ${fileName}</a>`;
            }).join('')}
          </div>
          ` : ''}

          <div style="margin-top: 30px; padding: 20px; background: #E8F5E9; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #2E7D32; font-weight: bold;">
              Your drawing request has been completed and approved!
            </p>
            <a href="${webAppUrl}?openModal=view&requestNo=${formData.requestNo}"
               style="display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              📋 View Request Details
            </a>
          </div>
        </div>

        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from ROD END Drawing Request System.</p>
          <p>If you have any questions, please contact the Engineering team.</p>
        </div>
      </div>
    `;

    // Exclude sender from recipient list
    const senderEmail = Session.getActiveUser().getEmail().toLowerCase();

    // Build recipient list: requester + ENG_INFORM config (exclude sender)
    const toRecipients = [formData.requesterEmail];
    if (emailConfig.ENG_INFORM && emailConfig.ENG_INFORM.length > 0) {
      toRecipients.push(...emailConfig.ENG_INFORM);
    }
    const filteredToRecipients = toRecipients.filter(email => email.toLowerCase() !== senderEmail);

    // Build CC list from config (exclude sender)
    const ccRecipients = (emailConfig.CC_ENG_INFORM || []).filter(email => email.toLowerCase() !== senderEmail);

    const emailOptions = {
      to: filteredToRecipients.join(','),
      subject: `[Completed] ${formData.requestNo} - ${requestInfo.title}`,
      htmlBody: body
    };

    if (ccRecipients.length > 0) {
      emailOptions.cc = ccRecipients.join(',');
    }

    MailApp.sendEmail(emailOptions);

  } catch (error) {
    Logger.log('Error sending eng inform email: ' + error.toString());
  }
}

/**
 * Get Request Details with User Info - combined call for RequestDetails page
 */
function getRequestDetailsWithUserInfo(requestItem) {
  const userRoles = getUserRoles();
  const flowDetails = getRequestFlowDetails(requestItem);

  return {
    userInfo: userRoles,
    isDraftman: userRoles.roles.includes('Draftman'),
    ...flowDetails
  };
}

/**
 * Get Request Flow Details with permission control
 * Requestor and users not in Config sheet can only see Request and Eng Approve steps
 */
function getRequestFlowDetails(requestItem) {
  try {
    // ลองดึงจาก cache ก่อน (cache 60 วินาที per request)
    const cache = CacheService.getScriptCache();
    const cacheKey = 'reqFlow_' + String(requestItem || '').trim();
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const ss = getSpreadsheet();
    const currentUserEmail = Session.getActiveUser().getEmail().toLowerCase();

    // Check if user is in Config sheet (authorized users)
    const canViewAllFlows = isAuthorizedUser(currentUserEmail);

    // Get main request data
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const requestData = requestSheet.getDataRange().getValues();

    let mainRequest = null;
    const searchItem = String(requestItem || '').trim();

    for (let i = 1; i < requestData.length; i++) {
      const sheetItem = String(requestData[i][0] || '').trim();
      if (sheetItem === searchItem) {
        mainRequest = {
          requestItem: requestData[i][0],
          requestNo: requestData[i][19] || '',
          timestamp: requestData[i][1],
          status: requestData[i][2],
          department: requestData[i][3],
          requester: requestData[i][5],
          requesterEmail: requestData[i][6],
          typeOfRequest: requestData[i][7],
          title: requestData[i][14],
          detail: requestData[i][15],
          attachFiles: requestData[i][16] || '',
          currentStage: requestData[i][17]
        };
        break;
      }
    }

    if (!mainRequest) {
      return null;
    }

    // Allow requestor to view their own request (limited view)
    const isRequestor = mainRequest.requesterEmail && mainRequest.requesterEmail.toLowerCase() === currentUserEmail;

    // Helper function to convert Date to ISO string
    function toISOString(val) {
      if (val instanceof Date) {
        return val.toISOString();
      }
      return val || '';
    }

    // Build result object
    var result = {
      requestItem: String(mainRequest.requestItem || ''),
      requestNo: String(mainRequest.requestNo || ''),
      requester: String(mainRequest.requester || ''),
      typeOfRequest: String(mainRequest.typeOfRequest || ''),
      title: String(mainRequest.title || ''),
      status: String(mainRequest.status || ''),
      canViewAllFlows: canViewAllFlows,

      // Request data (always visible)
      requestData: {
        completed: true,
        timestamp: toISOString(mainRequest.timestamp),
        detail: String(mainRequest.detail || ''),
        attachFiles: String(mainRequest.attachFiles || '')
      }
    };

    // Get Eng Check data
    const engCheckData = getEngCheckDataByRequestItem(requestItem);
    if (engCheckData) {
      result.engCheckData = {
        completed: true,
        timestamp: toISOString(engCheckData.timestamp),
        checker: String(engCheckData.userName || ''),
        status: String(engCheckData.status || ''),
        comment: String(engCheckData.comment || '')
      };
    } else if (mainRequest.currentStage === 'Eng Check') {
      result.engCheckData = { current: true };
    }

    // Get Draft Man data
    const draftManData = getDraftManData(requestItem);
    if (draftManData) {
      result.draftManData = {
        completed: true,
        timestamp: toISOString(draftManData.timestamp),
        draftman: String(draftManData.draftman || ''),
        dwgFiles: String(draftManData.dwgFiles || '')
      };
    } else if (mainRequest.currentStage === 'Draft Man') {
      result.draftManData = { current: true };
    }

    // Get DWG Check data
    const dwgCheckData = getDWGCheckDataByRequestItem(requestItem);
    if (dwgCheckData) {
      result.dwgCheckData = {
        completed: true,
        timestamp: toISOString(dwgCheckData.timestamp),
        checker: String(dwgCheckData.checker || ''),
        status: String(dwgCheckData.status || ''),
        comment: String(dwgCheckData.comment || '')
      };
    } else if (mainRequest.currentStage === 'DWG Check') {
      result.dwgCheckData = { current: true };
    }

    // Get Eng Review data
    const engReviewData = getEngReviewData(requestItem);
    if (engReviewData && engReviewData.drawingNo) {
      result.engReviewData = {
        completed: true,
        timestamp: toISOString(engReviewData.timestamp),
        reviewer: String(engReviewData.reviewer || ''),
        drawingNo: String(engReviewData.drawingNo || ''),
        noOfDwg: String(engReviewData.noOfDwg || ''),
        section: String(engReviewData.section || ''),
        attachFiles: String(engReviewData.attachFiles || '')
      };
    } else if (mainRequest.currentStage === 'Eng Review') {
      result.engReviewData = { current: true };
    }

    // Get Eng Approve data (always visible for requestor)
    const engApproveData = getEngApproveDataByRequestItem(requestItem);
    if (engApproveData) {
      result.engApproveData = {
        completed: true,
        timestamp: toISOString(engApproveData.timestamp),
        approver: String(engApproveData.approver || ''),
        judgement: String(engApproveData.judgement || ''),
        comment: String(engApproveData.comment || '')
      };
    } else if (mainRequest.currentStage === 'Eng Approve') {
      result.engApproveData = { current: true };
    }

    // Get Eng Inform data
    const engInformData = getEngInformDataByRequestItem(requestItem);
    if (engInformData) {
      result.engInformData = {
        completed: true,
        timestamp: toISOString(engInformData.timestamp),
        informed: true,
        cost: String(engInformData.cost || ''),
        evidence: String(engInformData.evidence || '')
      };
    } else if (mainRequest.currentStage === 'Eng Inform') {
      result.engInformData = { current: true };
    }

    // Cache ไว้ 60 วินาที
    cache.put(cacheKey, JSON.stringify(result), 60);

    return result;

  } catch (error) {
    return null;
  }
}

/**
 * Check if current user is a Draftman
 */
function isDraftmanUser() {
  try {
    const currentUserEmail = Session.getActiveUser().getEmail().toLowerCase();
    const emailConfig = getEmailConfig();

    // Check DRAFTMAN email list
    const draftmanEmails = emailConfig.DRAFTMAN || [];
    for (var i = 0; i < draftmanEmails.length; i++) {
      if (draftmanEmails[i] && draftmanEmails[i].toLowerCase() === currentUserEmail) {
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log('Error checking draftman user: ' + error.toString());
    return false;
  }
}

/**
 * Check if user is authorized (in Config sheet email lists)
 */
function isAuthorizedUser(email) {
  try {
    const emailConfig = getEmailConfig();
    const normalizedEmail = email.toLowerCase();

    // Check all email config arrays
    const allAuthorizedEmails = [];
    Object.keys(emailConfig).forEach(function(key) {
      const emails = emailConfig[key];
      if (emails && Array.isArray(emails)) {
        emails.forEach(function(e) {
          if (e) allAuthorizedEmails.push(e.toLowerCase());
        });
      }
    });

    return allAuthorizedEmails.indexOf(normalizedEmail) !== -1;
  } catch (error) {
    Logger.log('Error checking authorized user: ' + error.toString());
    return false;
  }
}

/**
 * Get Eng Check data by Request Item
 */
function getEngCheckDataByRequestItem(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_CHECK);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(requestItem).trim()) {
      return {
        timestamp: data[i][2],
        userName: data[i][3],
        userEmail: data[i][4],
        status: data[i][5],
        comment: data[i][6] || ''
      };
    }
  }
  return null;
}

/**
 * Get DWG Check data by Request Item
 */
function getDWGCheckDataByRequestItem(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DWG_CHECK);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(requestItem).trim()) {
      return {
        timestamp: data[i][1],
        checker: data[i][2],
        checkerEmail: data[i][3],
        status: data[i][4],
        comment: data[i][5] || ''
      };
    }
  }
  return null;
}

/**
 * Get Eng Approve data by Request Item
 */
function getEngApproveDataByRequestItem(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_APPROVE);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(requestItem).trim()) {
      return {
        timestamp: data[i][1],
        approver: data[i][2],
        approverEmail: data[i][3],
        judgement: data[i][4],
        comment: data[i][5] || ''
      };
    }
  }
  return null;
}

/**
 * Get Eng Inform data by Request Item
 */
function getEngInformDataByRequestItem(requestItem) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_INFORM);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(requestItem).trim()) {
      return {
        timestamp: data[i][1],
        cost: data[i][2],
        evidence: data[i][3],
        attachFiles: data[i][4]
      };
    }
  }
  return null;
}

/**
 * Enhanced getPendingRequests to support eng-inform
 */
function getPendingRequestsEnhanced(stage) {
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
    'eng-inform': 'Completed'  // Look for completed but not informed
  };

  const targetStage = stageMap[stage];

  for (let i = 1; i < data.length; i++) {
    let matches = false;

    if (stage === 'eng-inform') {
      // For eng-inform, find completed requests that haven't been informed yet
      matches = data[i][2] === 'Completed' && data[i][17] !== 'Informed';
    } else {
      matches = data[i][17] === targetStage && data[i][2].includes('Pending');
    }

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
        requestNo: data[i][0],
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

// ================================================================
// ADMIN UPDATE FUNCTIONS
// ================================================================

/**
 * Admin: Update Request data in Requests sheet
 * @param {string} requestItem - Request Item (ITEM-xxx)
 * @param {string} field - Field name to update (status, currentStage, title, detail)
 * @param {string} value - New value
 */
function adminUpdateRequestData(requestItem, field, value) {
  try {
    // Check admin permission
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const data = sheet.getDataRange().getValues();

    // Column mapping for Requests sheet
    const columnMap = {
      'status': 3,        // Column C (index 2+1)
      'currentStage': 18, // Column R (index 17+1)
      'title': 15,        // Column O (index 14+1)
      'detail': 16,       // Column P (index 15+1)
      'attachFiles': 17   // Column Q (index 16+1)
    };

    const column = columnMap[field];
    if (!column) {
      return { success: false, message: 'Invalid field: ' + field };
    }

    // Find the row
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        sheet.getRange(i + 1, column).setValue(value);
        Logger.log('Admin updated Request ' + requestItem + ' field ' + field + ' to: ' + value);
        return { success: true, message: 'Updated successfully' };
      }
    }

    return { success: false, message: 'Request not found: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateRequestData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

/**
 * Admin: Update Eng Check data
 * @param {string} requestItem - Request Item
 * @param {object} data - { status, comment }
 */
function adminUpdateEngCheckData(requestItem, updateData) {
  try {
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_CHECK);
    const data = sheet.getDataRange().getValues();

    // Find the latest entry for this request
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        if (updateData.status !== undefined) {
          sheet.getRange(i + 1, 6).setValue(updateData.status); // Column F
        }
        if (updateData.comment !== undefined) {
          sheet.getRange(i + 1, 7).setValue(updateData.comment); // Column G
        }
        Logger.log('Admin updated Eng Check for ' + requestItem);
        return { success: true, message: 'Eng Check updated successfully' };
      }
    }

    return { success: false, message: 'Eng Check data not found for: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateEngCheckData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

/**
 * Admin: Update Draft Man data
 * @param {string} requestItem - Request Item
 * @param {object} data - { dwgFiles }
 */
function adminUpdateDraftManData(requestItem, updateData) {
  try {
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DRAFT_MAN);
    const data = sheet.getDataRange().getValues();

    // Find the latest entry for this request
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        if (updateData.dwgFiles !== undefined) {
          sheet.getRange(i + 1, 5).setValue(updateData.dwgFiles); // Column E
        }
        Logger.log('Admin updated Draft Man for ' + requestItem);
        return { success: true, message: 'Draft Man updated successfully' };
      }
    }

    return { success: false, message: 'Draft Man data not found for: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateDraftManData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

/**
 * Admin: Update DWG Check data
 * @param {string} requestItem - Request Item
 * @param {object} data - { status, comment }
 */
function adminUpdateDWGCheckData(requestItem, updateData) {
  try {
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DWG_CHECK);
    const data = sheet.getDataRange().getValues();

    // Find the latest entry for this request
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        if (updateData.status !== undefined) {
          sheet.getRange(i + 1, 5).setValue(updateData.status); // Column E
        }
        if (updateData.comment !== undefined) {
          sheet.getRange(i + 1, 6).setValue(updateData.comment); // Column F
        }
        Logger.log('Admin updated DWG Check for ' + requestItem);
        return { success: true, message: 'DWG Check updated successfully' };
      }
    }

    return { success: false, message: 'DWG Check data not found for: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateDWGCheckData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

/**
 * Admin: Update Eng Review data
 * @param {string} requestItem - Request Item
 * @param {object} data - { drawingNo, noOfDwg, section }
 */
function adminUpdateEngReviewData(requestItem, updateData) {
  try {
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_REVIEW);
    const data = sheet.getDataRange().getValues();

    // Find the latest entry for this request
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        if (updateData.section !== undefined) {
          sheet.getRange(i + 1, 5).setValue(updateData.section); // Column E
        }
        if (updateData.noOfDwg !== undefined) {
          sheet.getRange(i + 1, 10).setValue(updateData.noOfDwg); // Column J
        }
        if (updateData.drawingNo !== undefined) {
          sheet.getRange(i + 1, 11).setValue(updateData.drawingNo); // Column K
        }
        if (updateData.attachFiles !== undefined) {
          sheet.getRange(i + 1, 12).setValue(updateData.attachFiles); // Column L
        }
        Logger.log('Admin updated Eng Review for ' + requestItem);
        return { success: true, message: 'Eng Review updated successfully' };
      }
    }

    return { success: false, message: 'Eng Review data not found for: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateEngReviewData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

/**
 * Admin: Update Eng Approve data
 * @param {string} requestItem - Request Item
 * @param {object} data - { judgement, comment }
 */
function adminUpdateEngApproveData(requestItem, updateData) {
  try {
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_APPROVE);
    const data = sheet.getDataRange().getValues();

    // Find the latest entry for this request
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        if (updateData.judgement !== undefined) {
          sheet.getRange(i + 1, 5).setValue(updateData.judgement); // Column E
        }
        if (updateData.comment !== undefined) {
          sheet.getRange(i + 1, 6).setValue(updateData.comment); // Column F
        }
        Logger.log('Admin updated Eng Approve for ' + requestItem);
        return { success: true, message: 'Eng Approve updated successfully' };
      }
    }

    return { success: false, message: 'Eng Approve data not found for: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateEngApproveData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

/**
 * Admin: Update Eng Inform data
 * @param {string} requestItem - Request Item
 * @param {object} data - { cost, evidence }
 */
function adminUpdateEngInformData(requestItem, updateData) {
  try {
    if (!isAdmin()) {
      return { success: false, message: 'Permission denied. Admin access required.' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_INFORM);
    const data = sheet.getDataRange().getValues();

    // Find the latest entry for this request
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(requestItem).trim()) {
        if (updateData.cost !== undefined) {
          sheet.getRange(i + 1, 3).setValue(updateData.cost); // Column C
        }
        if (updateData.evidence !== undefined) {
          sheet.getRange(i + 1, 4).setValue(updateData.evidence); // Column D
        }
        Logger.log('Admin updated Eng Inform for ' + requestItem);
        return { success: true, message: 'Eng Inform updated successfully' };
      }
    }

    return { success: false, message: 'Eng Inform data not found for: ' + requestItem };
  } catch (error) {
    Logger.log('Error in adminUpdateEngInformData: ' + error.toString());
    return { success: false, message: 'Error: ' + error.toString() };
  }
}
