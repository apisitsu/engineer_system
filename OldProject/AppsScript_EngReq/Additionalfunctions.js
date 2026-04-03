// ===== Additional Functions for Code.gs =====
// Add these functions to your main Code.gs file

// ===== VALIDATION HELPER FUNCTIONS =====

/**
 * Check if user has specific role (is in email config list)
 * @param {string} role - Role name (e.g., 'DRAFTMAN', 'DWG_CHECK', 'ENG_REVIEW', 'ENG_APPROVE')
 * @returns {Object} { hasRole: boolean, userEmail: string }
 */
function checkUserRole(role) {
  try {
    const userEmail = Session.getActiveUser().getEmail().toLowerCase();
    const emailConfig = getEmailConfig();

    // Get emails for this role
    const roleEmails = emailConfig[role] || [];
    const normalizedRoleEmails = roleEmails.map(e => e.toLowerCase());

    return {
      hasRole: normalizedRoleEmails.indexOf(userEmail) !== -1,
      userEmail: userEmail
    };
  } catch (error) {
    Logger.log('Error checking user role: ' + error.toString());
    return { hasRole: false, userEmail: '' };
  }
}

/**
 * Get current status of a request
 * @param {string} requestNo - Request number/item
 * @returns {Object} { found: boolean, status: string, currentStage: string }
 */
function getRequestStatus(requestNo) {
  try {
    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const data = requestSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === requestNo) {
        return {
          found: true,
          status: data[i][2] || '',
          currentStage: data[i][17] || ''
        };
      }
    }

    return { found: false, status: '', currentStage: '' };
  } catch (error) {
    Logger.log('Error getting request status: ' + error.toString());
    return { found: false, status: '', currentStage: '' };
  }
}

/**
 * Validate if user can submit for a specific workflow step
 * @param {string} requestNo - Request number
 * @param {string} requiredStatus - Required status (e.g., 'Pending Eng Approve')
 * @param {string} requiredRole - Required role (e.g., 'ENG_APPROVE')
 * @returns {Object} { valid: boolean, error: string }
 */
function validateWorkflowSubmission(requestNo, requiredStatus, requiredRole) {
  // Check role
  const roleCheck = checkUserRole(requiredRole);
  if (!roleCheck.hasRole) {
    return {
      valid: false,
      error: 'You do not have permission to perform this action. Required role: ' + requiredRole
    };
  }

  // Check status
  const statusCheck = getRequestStatus(requestNo);
  if (!statusCheck.found) {
    return {
      valid: false,
      error: 'Request not found: ' + requestNo
    };
  }

  if (statusCheck.status !== requiredStatus) {
    return {
      valid: false,
      error: 'Invalid request status. Current status: "' + statusCheck.status + '", Required: "' + requiredStatus + '"'
    };
  }

  return { valid: true, error: '' };
}

// ===== DRAFT MAN FUNCTIONS =====

/**
 * Get requests that Draftman can edit (their own submitted requests)
 */
function getDraftManEditableRequests() {
  try {
    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const draftManSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DRAFT_MAN);
    const currentUserEmail = Session.getActiveUser().getEmail().toLowerCase();

    const requestData = requestSheet.getDataRange().getValues();
    const draftManData = draftManSheet.getDataRange().getValues();

    // Find requests that this user has drafted
    const editableRequests = [];

    for (let i = 1; i < draftManData.length; i++) {
      const draftmanEmail = String(draftManData[i][3] || '').toLowerCase();
      if (draftmanEmail === currentUserEmail) {
        const requestItem = draftManData[i][0];

        // Find the request status
        for (let j = 1; j < requestData.length; j++) {
          if (requestData[j][0] === requestItem) {
            const status = requestData[j][2];
            const currentStage = requestData[j][17] || '';

            // Stages where Draftman can NO longer edit (after approval process)
            const nonEditableStages = ['Eng Approve', 'Eng Inform', 'Informed', 'Completed'];
            const isStageEditable = nonEditableStages.indexOf(currentStage) === -1;

            // Allow editing if:
            // 1. Status is not completed/denied
            // 2. Stage is still in editable range (before Eng Approve)
            if (status !== 'Completed' && status !== 'Completed & Informed' && status !== 'Denied' && isStageEditable) {
              editableRequests.push({
                requestItem: requestData[j][0],
                requestNo: requestData[j][19] || '',
                timestamp: requestData[j][1],
                requester: requestData[j][5],
                typeOfRequest: requestData[j][7],
                title: requestData[j][14],
                status: status,
                currentStage: currentStage,
                dwgFiles: draftManData[i][4] || '',
                draftTimestamp: draftManData[i][1]
              });
            }
            break;
          }
        }
      }
    }

    return editableRequests;
  } catch (error) {
    Logger.log('Error getting editable requests: ' + error.toString());
    return [];
  }
}

/**
 * Update Draft Man files (replace existing files)
 */
function updateDraftManFiles(formData) {
  try {
    const ss = getSpreadsheet();
    const draftManSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DRAFT_MAN);
    const currentUserEmail = Session.getActiveUser().getEmail().toLowerCase();

    const data = draftManSheet.getDataRange().getValues();
    let updated = false;

    // Find the row with matching requestItem and current user
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(formData.requestItem).trim()) {
        const draftmanEmail = String(data[i][3] || '').toLowerCase();
        if (draftmanEmail === currentUserEmail) {
          // Update the dwgFiles column
          draftManSheet.getRange(i + 1, 5).setValue(formData.dwgFiles);
          // Update timestamp
          draftManSheet.getRange(i + 1, 2).setValue(new Date());
          updated = true;
          break;
        }
      }
    }

    if (updated) {
      return {
        success: true,
        message: 'Files updated successfully!'
      };
    } else {
      return {
        success: false,
        message: 'Could not find your draft submission to update'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

/**
 * Submit Draft Man work
 */
function submitDraftMan(formData) {
  try {
    // === VALIDATION ===
    const validation = validateWorkflowSubmission(formData.requestItem, 'Pending Draft Man', 'DRAFTMAN');
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const draftManSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DRAFT_MAN);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);

    const timestamp = new Date();

    // Get current user automatically
    const draftmanEmail = Session.getActiveUser().getEmail();
    const draftman = draftmanEmail.split('@')[0]; // Use email username as name

    // Add to Draft Man sheet (use requestItem)
    draftManSheet.appendRow([
      formData.requestItem,
      timestamp,
      draftman,
      draftmanEmail,
      formData.dwgFiles || ''
    ]);

    // Update Requests sheet (search by Request Item - column 1)
    const requestData = requestSheet.getDataRange().getValues();
    for (let i = 1; i < requestData.length; i++) {
      if (requestData[i][0] === formData.requestItem) {
        requestSheet.getRange(i + 1, 3).setValue('Pending DWG Check');
        requestSheet.getRange(i + 1, 18).setValue('DWG Check');
        requestSheet.getRange(i + 1, 19).setValue(timestamp);
        break;
      }
    }

    // Update Tracking sheet
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < trackingData.length; i++) {
      if (trackingData[i][0] === formData.requestItem) {
        trackingSheet.getRange(i + 1, 7).setValue(timestamp); // Draft Man Date

        const engCheckDate = new Date(trackingData[i][5]);
        const duration = calculateWorkingDays(engCheckDate, timestamp);
        trackingSheet.getRange(i + 1, 13).setValue(duration); // Draft Man Duration

        trackingSheet.getRange(i + 1, 4).setValue('Pending DWG Check');
        break;
      }
    }

    const emailConfig = getEmailConfig();
    clearDashboardCache();

    return {
      success: true,
      message: 'Draft work submitted successfully!',
      emailParams: {
        type: 'draft-completed',
        requestNo: formData.requestItem,
        data: formData,
        recipients: emailConfig.DWG_CHECK || [],
        ccRecipients: emailConfig.CC_DWG_CHECK || []
      }
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

// ===== DWG CHECK FUNCTIONS =====

/**
 * Submit DWG Check
 */
function submitDWGCheck(formData) {
  try {
    // === VALIDATION ===
    const validation = validateWorkflowSubmission(formData.requestNo, 'Pending DWG Check', 'DWG_CHECK');
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const dwgCheckSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DWG_CHECK);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);

    const timestamp = new Date();

    // Get current user automatically
    const checkerEmail = Session.getActiveUser().getEmail();
    const checker = checkerEmail.split('@')[0];

    // Add to DWG Check sheet
    dwgCheckSheet.appendRow([
      formData.requestNo,
      timestamp,
      checker,
      checkerEmail,
      formData.status,
      formData.comment || ''
    ]);

    // Update Requests sheet
    const requestData = requestSheet.getDataRange().getValues();
    for (let i = 1; i < requestData.length; i++) {
      if (requestData[i][0] === formData.requestNo) {
        if (formData.status === 'Approve') {
          requestSheet.getRange(i + 1, 3).setValue('Pending Eng Review');
          requestSheet.getRange(i + 1, 18).setValue('Eng Review');
        } else {
          requestSheet.getRange(i + 1, 3).setValue('Pending Draft Man');
          requestSheet.getRange(i + 1, 18).setValue('Draft Man');
        }
        requestSheet.getRange(i + 1, 19).setValue(timestamp);
        break;
      }
    }

    // Update Tracking sheet
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < trackingData.length; i++) {
      if (trackingData[i][0] === formData.requestNo) {
        trackingSheet.getRange(i + 1, 8).setValue(timestamp); // DWG Check Date

        const draftManDate = new Date(trackingData[i][6]);
        const duration = calculateWorkingDays(draftManDate, timestamp);
        trackingSheet.getRange(i + 1, 14).setValue(duration); // DWG Check Duration

        if (formData.status === 'Approve') {
          trackingSheet.getRange(i + 1, 4).setValue('Pending Eng Review');
        } else {
          trackingSheet.getRange(i + 1, 4).setValue('Pending Draft Man');
        }
        break;
      }
    }

    const emailConfig = getEmailConfig();
    var emailParams;
    if (formData.status === 'Approve') {
      emailParams = {
        type: 'dwg-check-approved',
        requestNo: formData.requestNo,
        data: {...formData, checker, checkerEmail},
        recipients: emailConfig.ENG_REVIEW || [],
        ccRecipients: emailConfig.CC_ENG_REVIEW || []
      };
    } else {
      emailParams = {
        type: 'dwg-check-denied',
        requestNo: formData.requestNo,
        data: {...formData, checker, checkerEmail},
        recipients: emailConfig.DRAFTMAN || [],
        ccRecipients: emailConfig.CC_DRAFTMAN || []
      };
    }

    clearDashboardCache();

    return {
      success: true,
      message: 'DWG Check submitted successfully!',
      emailParams: emailParams
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

// ===== ENG REVIEW FUNCTIONS =====

/**
 * Submit Eng Review
 */
function submitEngReview(formData) {
  try {
    // === VALIDATION ===
    const validation = validateWorkflowSubmission(formData.requestNo, 'Pending Eng Review', 'ENG_REVIEW');
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const engReviewSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_REVIEW);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);

    const timestamp = new Date();

    // Get current user automatically
    const reviewerEmail = Session.getActiveUser().getEmail();
    const reviewer = reviewerEmail.split('@')[0];

    // Add to Eng Review sheet
    engReviewSheet.appendRow([
      formData.requestNo,
      timestamp,
      reviewer,
      reviewerEmail,
      formData.section,
      formData.sparePartType || '',
      formData.general || '',
      formData.machinePart || '',
      formData.gaugeType || '',
      formData.noOfDwg,
      formData.drawingNo,
      formData.attachFiles || ''
    ]);

    // Update Requests sheet
    const requestData = requestSheet.getDataRange().getValues();
    for (let i = 1; i < requestData.length; i++) {
      if (requestData[i][0] === formData.requestNo) {
        requestSheet.getRange(i + 1, 3).setValue('Pending Eng Approve');
        requestSheet.getRange(i + 1, 18).setValue('Eng Approve');
        requestSheet.getRange(i + 1, 19).setValue(timestamp);
        break;
      }
    }

    // Update Tracking sheet
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < trackingData.length; i++) {
      if (trackingData[i][0] === formData.requestNo) {
        trackingSheet.getRange(i + 1, 9).setValue(timestamp); // Eng Review Date
        trackingSheet.getRange(i + 1, 3).setValue(formData.noOfDwg); // No. of Drawings

        const dwgCheckDate = new Date(trackingData[i][7]);
        const duration = calculateWorkingDays(dwgCheckDate, timestamp);
        trackingSheet.getRange(i + 1, 15).setValue(duration); // Eng Review Duration

        trackingSheet.getRange(i + 1, 4).setValue('Pending Eng Approve');
        break;
      }
    }

    const emailConfig = getEmailConfig();
    clearDashboardCache();

    return {
      success: true,
      message: 'Eng Review submitted successfully!',
      emailParams: {
        type: 'eng-review-completed',
        requestNo: formData.requestNo,
        data: {...formData, reviewer, reviewerEmail},
        recipients: emailConfig.ENG_APPROVE || [],
        ccRecipients: emailConfig.CC_ENG_APPROVE || []
      }
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

// ===== ENG APPROVE FUNCTIONS =====

/**
 * Submit Eng Approve
 */
function submitEngApprove(formData) {
  try {
    // === VALIDATION ===
    const validation = validateWorkflowSubmission(formData.requestNo, 'Pending Eng Approve', 'ENG_APPROVE');
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    const ss = getSpreadsheet();
    const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
    const engApproveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ENG_APPROVE);
    const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);

    const timestamp = new Date();

    // Get current user automatically
    const approverEmail = Session.getActiveUser().getEmail();
    const approver = approverEmail.split('@')[0];

    // Add to Eng Approve sheet
    engApproveSheet.appendRow([
      formData.requestNo,
      timestamp,
      approver,
      approverEmail,
      formData.judgement,
      formData.comment || ''
    ]);

    // Update Requests sheet
    const requestData = requestSheet.getDataRange().getValues();
    for (let i = 1; i < requestData.length; i++) {
      if (requestData[i][0] === formData.requestNo) {
        if (formData.judgement === 'Approve') {
          // Set to Pending Eng Inform instead of Completed
          requestSheet.getRange(i + 1, 3).setValue('Pending Eng Inform');
          requestSheet.getRange(i + 1, 18).setValue('Eng Inform');
        } else {
          requestSheet.getRange(i + 1, 3).setValue('Denied by Approve');
          requestSheet.getRange(i + 1, 18).setValue('Denied');
        }
        requestSheet.getRange(i + 1, 19).setValue(timestamp);
        break;
      }
    }

    // Update Tracking sheet
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < trackingData.length; i++) {
      if (trackingData[i][0] === formData.requestNo) {
        trackingSheet.getRange(i + 1, 10).setValue(timestamp); // Eng Approve Date

        const engReviewDate = new Date(trackingData[i][8]);
        const duration = calculateWorkingDays(engReviewDate, timestamp);
        trackingSheet.getRange(i + 1, 16).setValue(duration); // Eng Approve Duration

        if (formData.judgement === 'Approve') {
          trackingSheet.getRange(i + 1, 4).setValue('Pending Eng Inform');
        } else {
          // Calculate total duration for denied requests
          const createdDate = new Date(trackingData[i][4]);
          const totalDuration = calculateWorkingDays(createdDate, timestamp);
          trackingSheet.getRange(i + 1, 17).setValue(totalDuration);

          // Check if on time
          const dueDate = new Date(trackingData[i][18]);
          const onTime = timestamp <= dueDate ? 'Yes' : 'No';
          trackingSheet.getRange(i + 1, 19).setValue(onTime);

          trackingSheet.getRange(i + 1, 4).setValue('Denied');
        }
        break;
      }
    }

    const emailConfig = getEmailConfig();
    const requestInfo = getRequestInfo(formData.requestNo);
    var emailParams;

    if (formData.judgement === 'Approve') {
      var engInformRecipients = emailConfig.ENG_INFORM || [];
      if (!engInformRecipients || engInformRecipients.length === 0) {
        engInformRecipients = emailConfig.ENG_CHECK || [];
      }
      emailParams = {
        type: 'eng-approve-completed',
        requestNo: formData.requestNo,
        data: {...formData, ...requestInfo, approver, approverEmail},
        recipients: engInformRecipients,
        ccRecipients: emailConfig.CC_ENG_INFORM || []
      };
    } else {
      emailParams = {
        type: 'request-denied-final',
        requestNo: formData.requestNo,
        data: {...formData, ...requestInfo, approver, approverEmail},
        recipients: [requestInfo.requesterEmail],
        ccRecipients: []
      };
    }

    clearDashboardCache();

    return {
      success: true,
      message: 'Eng Approve submitted successfully!',
      emailParams: emailParams
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error: ' + error.toString()
    };
  }
}

// ===== ENHANCED EMAIL TEMPLATES =====

/**
 * Enhanced email notification function with more templates
 */
function sendEmailNotificationEnhanced(type, requestNo, data, recipients, ccRecipients) {
  try {
    let subject = '';
    let body = '';
    const webAppUrl = ScriptApp.getService().getUrl();
    
    switch(type) {
      case 'draft-completed':
        subject = `[Draft Complete] ${requestNo} - Ready for DWG Check`;
        body = `
          <h2>Draft Work Completed</h2>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p>The drafting work has been completed and is ready for DWG Check.</p>
          <p><a href="${webAppUrl}?openModal=dwg-check&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Review Drawing</a></p>
        `;
        break;
        
      case 'dwg-check-approved':
        subject = `[DWG Approved] ${requestNo} - Ready for Eng Review`;
        body = `
          <h2>DWG Check Approved</h2>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p>The drawing has been checked and approved. Please proceed with Engineering Review.</p>
          <p><a href="${webAppUrl}?openModal=eng-review&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Start Review</a></p>
        `;
        break;
        
      case 'dwg-check-denied':
        subject = `[DWG Revision Required] ${requestNo}`;
        body = `
          <h2>DWG Check - Revision Required</h2>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Comment:</strong> ${data.comment}</p>
          <p>Please revise the drawing and resubmit.</p>
          <p><a href="${webAppUrl}?openModal=draft-man&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#FFA000; color:white; text-decoration:none; border-radius:6px;">Revise Drawing</a></p>
        `;
        break;
        
      case 'eng-review-completed':
        subject = `[Review Complete] ${requestNo} - Ready for Final Approval`;
        body = `
          <h2>Engineering Review Completed</h2>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Drawing No:</strong> ${data.drawingNo}</p>
          <p>The engineering review is complete. Please proceed with final approval.</p>
          <p><a href="${webAppUrl}?openModal=eng-approve&requestNo=${requestNo}" style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">Approve Now</a></p>
        `;
        break;
        
      case 'request-completed':
        subject = `[Completed] ${requestNo} - ${data.title}`;
        body = `
          <div style="background:#E8F5E9; padding:20px; border-left:5px solid #4CAF50; margin-bottom:20px;">
            <h2 style="color:#2E7D32; margin:0;">✅ Request Completed!</h2>
          </div>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Title:</strong> ${data.title}</p>
          <p>Your drawing request has been completed and approved.</p>
          <p><strong>Drawing No:</strong> ${data.drawingNo || 'See attached files'}</p>
          <hr style="border:none; border-top:1px solid #ddd; margin:20px 0;">
          <p style="color:#666; font-size:12px;">Thank you for using the ROD END Drawing Request System.</p>
        `;
        break;
        
      case 'request-denied-final':
        subject = `[Not Approved] ${requestNo} - ${data.title}`;
        body = `
          <div style="background:#FFEBEE; padding:20px; border-left:5px solid #F44336; margin-bottom:20px;">
            <h2 style="color:#C62828; margin:0;">❌ Request Not Approved</h2>
          </div>
          <p><strong>Request No:</strong> ${requestNo}</p>
          <p><strong>Title:</strong> ${data.title}</p>
          <p><strong>Reason:</strong> ${data.comment}</p>
          <p>Please contact the engineering team for more information.</p>
        `;
        break;
    }
    
    const mailOptions = {
      to: recipients.join(','),
      cc: ccRecipients.join(','),
      subject: subject,
      htmlBody: body
    };
    
    MailApp.sendEmail(mailOptions);
    
  } catch (error) {
    Logger.log('Error sending email: ' + error.toString());
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get summary statistics
 */
function getSummaryStatistics() {
  const ss = getSpreadsheet();
  const requestSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REQUESTS);
  const data = requestSheet.getDataRange().getValues();
  
  const stats = {
    totalRequests: data.length - 1,
    byType: {},
    byStatus: {},
    byDepartment: {},
    avgDuration: 0,
    onTimePercentage: 0
  };
  
  // Calculate statistics
  for (let i = 1; i < data.length; i++) {
    const type = data[i][7];
    const status = data[i][2];
    const dept = data[i][3];
    
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
  }
  
  return stats;
}

/**
 * Export tracking data to CSV
 */
function exportTrackingDataToCSV() {
  const ss = getSpreadsheet();
  const trackingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKING);
  
  const data = trackingSheet.getDataRange().getValues();
  let csv = '';
  
  // Convert to CSV
  data.forEach(row => {
    csv += row.map(cell => {
      // Escape quotes and commas
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',') + '\n';
  });
  
  return csv;
}