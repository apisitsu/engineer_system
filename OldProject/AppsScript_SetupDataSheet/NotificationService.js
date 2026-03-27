// ================================================================= //
//                 NOTIFICATION SYSTEM (EMAIL)                     //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Notification Service Module
 * Handles all email notifications and user communications
 */

/**
 * Enhanced individual notification with user preference
 */
function sendNotificationToSpecificUser(userEmail, cn, partNo, role) {
  try {
    const user = getUserInfo(userEmail);
    
    // Check user notification preference
    if (!user.notifyOnAssign) {
      Logger.log(`Individual notification skipped for ${userEmail}: User has notifications disabled`);
      return;
    }
  
    const webAppUrl = ScriptApp.getService().getUrl();
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
    const subject = `SDS Notification: Document for CN ${cn} requires your ${role} action`;
    const body = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 15px; border-radius: 8px; color: white; text-align: center;">
          <h2 style="margin: 0;">Document Requires Action</h2>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <p>Dear ${user.displayName},</p>
          <p>A document is waiting for your <strong>${role}</strong> review in the Setup Data Sheet System.</p>
          
          <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3498db;">
            <p style="margin: 5px 0;"><strong>CN:</strong> ${cn}</p>
            <p style="margin: 5px 0;"><strong>Part No:</strong> ${partNo || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Action Required:</strong> ${role}</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${documentUrl}" 
               style="background: #3498db; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Review Document for CN ${cn}
            </a>
          </div>
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            This link will automatically show all documents for CN ${cn}.
          </p>
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: userEmail,
      subject: subject,
      htmlBody: body,
      name: "SetupDataSheet System"
    });
    Logger.log(`Notification sent to ${userEmail} for CN ${cn}`);
    
  } catch (e) {
    Logger.log(`Failed to send notification to ${userEmail}: ${e.message}`);
  }
}

/**
 * Enhanced bulk notification with user preference checking
 * @param {string} userEmail - User email to notify
 * @param {Array} documents - Array of document objects
 * @param {string} role - Role requiring action
 */
function sendBulkNotificationToUser(userEmail, documents, role) {
  try {
    if (documents.length === 0) return;
    const user = getUserInfo(userEmail);
    
    // Check user notification preference
    if (!user.notifyOnAssign) {
      Logger.log(`Notification skipped for ${userEmail}: User has notifications disabled`);
      return;
    }
    
    const webAppUrl = ScriptApp.getService().getUrl();
    const firstCN = documents[0].CN;
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(firstCN)}&autoload=true`;
    
    let documentsList = '';
    documents.forEach((doc, index) => {
      documentsList += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${doc.CN}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${doc.Process_Code || 'N/A'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${doc.Process || 'N/A'}</td>
        </tr>
      `;
    });

    const subject = `📋 SDS Notification: ${documents.length} documents require your ${role} action`;
    const body = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Setup Data Sheet System</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Action Required Notification</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;">
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">Action Required</h3>
            <p style="margin: 0; color: #155724;">
              You have <strong>${documents.length} document(s)</strong> waiting for your <strong>${role}</strong> review.
            </p>
            </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin-bottom: 20px;">
            <h4 style="color: #495057; margin: 0 0 15px 0;">Documents List</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">#</th>
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">CN</th>
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Process Code</th>
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Process</th>
                </tr>
              </thead>
              <tbody>
                ${documentsList}
              </tbody>
            </table>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${documentUrl}" 
               style="background: linear-gradient(135deg, #3498db, #2980b9);
                      color: white; 
                      padding: 12px 25px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
                      transition: all 0.3s ease;">
              📋 Review All Documents (${documents.length})
            </a>
          </div>
          
          <div style="background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 13px;">
              <strong>Note:</strong> This link will automatically show all documents for CN ${firstCN} and related processes.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated notification from Setup Data Sheet System.</p>
          <p>If you wish to disable these notifications, please contact your system administrator.</p>
        </div>
      </div>
    `;
    
    MailApp.sendEmail({
      to: userEmail,
      subject: subject,
      htmlBody: body,
      name: "SetupDataSheet System"
    });
    
    Logger.log(`Bulk notification sent to ${userEmail} for ${documents.length} documents`);
    
  } catch (e) {
    Logger.log(`Failed to send bulk notification to ${userEmail}: ${e.message}`);
  }
}

/**
 * Send awareness notification to skipped users
 * @param {string} userEmail - User email to notify
 * @param {string} cn - Control Number
 * @param {string} partNo - Part Number
 * @param {string} action - Action performed
 * @param {string} performedBy - User who performed the action
 */
function sendAwarenessNotification(userEmail, cn, partNo, action, performedBy) {
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
    
    const subject = `SDS Awareness: Document for CN ${cn} - ${action} performed`;
    const body = `
      <p>Dear User,</p>
      <p>This is an awareness notification for document CN ${cn}.</p>
      <ul>
        <li><strong>CN:</strong> ${cn}</li>
        <li><strong>Part No:</strong> ${partNo || 'N/A'}</li>
        <li><strong>Action:</strong> ${action}</li>
        <li><strong>Performed By:</strong> ${performedBy}</li>
        <li><strong>Note:</strong> The workflow was optimized for efficiency</li>
      </ul>
      <p>You can view the document here (results will load automatically):</p>
      <p><a href="${documentUrl}">View Document for CN ${cn}</a></p>
      <br>
      <p>This is an automated awareness notification.</p>
    `;

    MailApp.sendEmail({ 
      to: userEmail, 
      subject: subject, 
      htmlBody: body,
      name: "SetupDataSheet System" 
    });
  } catch (e) {
    Logger.log(`Failed to send awareness notification: ${e.message}`);
  }
}

/**
 * Send approval notification to approvers (OPTIMIZED - Parallel Sending)
 * Filters recipients by notifyOnAssign preference and sends in bulk
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} approvedBy - User who approved
 * @param {string} reason - Reason for approval
 * @returns {Array} List of notified email addresses
 */
function sendApprovalNotificationToApprovers(cn, processCode, approvedBy, reason) {
  try {
    const approvers = getUsersByRole('Approved');
    if (approvers.length === 0) {
      Logger.log('[NOTIFY] No approvers found for approval notification');
      return [];
    }

    // Filter recipients by notifyOnAssign preference (Performance optimization)
    const eligibleRecipients = [];
    approvers.forEach(approver => {
      const userInfo = getUserInfo(approver.email);
      if (userInfo.notifyOnAssign) {
        eligibleRecipients.push(approver.email);
      } else {
        Logger.log(`[NOTIFY SKIP] ${approver.email} has notifications disabled`);
      }
    });

    if (eligibleRecipients.length === 0) {
      Logger.log('[NOTIFY] No eligible recipients with notifications enabled');
      return [];
    }

    const webAppUrl = ScriptApp.getService().getUrl();
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
    const subject = `🚨 Document Approval by Checked User - CN: ${cn}`;
    const body = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ff6b6b; border-radius: 10px;">
        <h2 style="color: #d63031;">Document Approval by Checked User</h2>

        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #856404;">Document Details</h3>
          <p><strong>CN:</strong> ${cn}</p>
          <p><strong>Process Code:</strong> ${processCode || 'N/A'}</p>
          <p><strong>Approved by:</strong> ${approvedBy}</p>
          <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          <p><strong>Date:</strong> ${Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm")}</p>
        </div>

        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #155724;">Additional Information</h3>
          <p>This document was approved by a Checked User with "Approve with Notification" privileges.</p>
          <p>The document status is now <strong>Approved</strong> and ready for use.</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${documentUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Document (Auto-load)
          </a>
        </div>
      </div>
    `;

    // Send to all eligible recipients in a single email (Parallel sending)
    const recipientString = eligibleRecipients.join(',');

    MailApp.sendEmail({
      to: recipientString,
      subject: subject,
      htmlBody: body,
      name: "SetupDataSheet System"
    });

    Logger.log(`[NOTIFY SUCCESS] Approval notification sent to ${eligibleRecipients.length} recipients: ${recipientString}`);
    return eligibleRecipients;

  } catch (e) {
    Logger.log(`[NOTIFY ERROR] Failed to send approval notification: ${e.message}`);
    return [];
  }
}

/**
 * Send awareness notification to Checked users when Prepared user checks (OPTIMIZED - Parallel Sending)
 * Filters recipients by notifyOnAssign preference and sends in bulk
 * @param {string} cn - CN number
 * @param {string} processCode - Process code
 * @param {string} checkedBy - User who checked
 * @param {string} reason - Reason for checking
 * @returns {Array} List of notified email addresses
 */
function sendCheckNotificationToCheckers(cn, processCode, checkedBy, reason) {
  try {
    const checkers = getUsersByRole('Checked');
    if (checkers.length === 0) {
      Logger.log('[NOTIFY] No checkers found for check notification');
      return [];
    }

    // Filter recipients by notifyOnAssign preference (Performance optimization)
    const eligibleRecipients = [];
    checkers.forEach(checker => {
      const userInfo = getUserInfo(checker.email);
      if (userInfo.notifyOnAssign) {
        eligibleRecipients.push(checker.email);
      } else {
        Logger.log(`[NOTIFY SKIP] ${checker.email} has notifications disabled`);
      }
    });

    if (eligibleRecipients.length === 0) {
      Logger.log('[NOTIFY] No eligible recipients with notifications enabled');
      return [];
    }

    const webAppUrl = ScriptApp.getService().getUrl();
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
    const subject = `🔔 Document Checked by Prepared User - CN: ${cn}`;
    const body = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #3498db; border-radius: 10px;">
        <h2 style="color: #2980b9;">Document Checked by Prepared User</h2>

        <div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #0c5460;">Document Details</h3>
          <p><strong>CN:</strong> ${cn}</p>
          <p><strong>Process Code:</strong> ${processCode || 'N/A'}</p>
          <p><strong>Checked by:</strong> ${checkedBy}</p>
          <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          <p><strong>Date:</strong> ${Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm")}</p>
        </div>

        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #155724;">Additional Information</h3>
          <p>This document was checked by a Prepared User with "Check with Notification" privileges.</p>
          <p>The document status is now <strong>Checked</strong> and ready for approval.</p>
          <p><em>This is for your awareness. No action is required.</em></p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${documentUrl}" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Document (Auto-load)
          </a>
        </div>
      </div>
    `;

    // Send to all eligible recipients in a single email (Parallel sending)
    const recipientString = eligibleRecipients.join(',');

    MailApp.sendEmail({
      to: recipientString,
      subject: subject,
      htmlBody: body,
      name: "SetupDataSheet System"
    });

    Logger.log(`[NOTIFY SUCCESS] Check notification sent to ${eligibleRecipients.length} recipients: ${recipientString}`);
    return eligibleRecipients;

  } catch (e) {
    Logger.log(`[NOTIFY ERROR] Failed to send check notification: ${e.message}`);
    return [];
  }
}

/**
 * Send approval completion notification to Prepared and Checked users
 * Notifies both users who prepared and checked the document that it has been approved
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} approvedBy - User who approved the document
 * @param {string} preparedBy - User who prepared the document
 * @param {string} checkedBy - User who checked the document
 * @param {string} sheetName - Sheet name for data lookup
 * @returns {Array} List of notified email addresses
 */
function sendApprovalCompletionNotification(cn, processCode, approvedBy, preparedBy, checkedBy, sheetName) {
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
    const subject = `✅ Document Approved - CN: ${cn}`;

    const body = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #2ecc71; border-radius: 10px;">
        <h2 style="color: #27ae60;">✅ Document Successfully Approved</h2>

        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #155724;">Document Details</h3>
          <p><strong>CN:</strong> ${cn}</p>
          <p><strong>Process Code:</strong> ${processCode || 'N/A'}</p>
          <p><strong>Approved by:</strong> ${approvedBy}</p>
          <p><strong>Date:</strong> ${Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm")}</p>
        </div>

        <div style="background: #cfe2ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #084298;">Workflow Status</h3>
          <p>This document has completed the full approval workflow:</p>
          <ul>
            <li>✅ Prepared by: ${preparedBy || 'N/A'}</li>
            <li>✅ Checked by: ${checkedBy || 'N/A'}</li>
            <li>✅ Approved by: ${approvedBy}</li>
          </ul>
          <p>The document is now <strong style="color: #27ae60;">APPROVED</strong> and ready for use in production.</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${documentUrl}" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Approved Document
          </a>
        </div>

        <div style="background: #f8f9fa; padding: 12px; border-radius: 5px; border-left: 4px solid #2ecc71;">
          <p style="margin: 0; color: #495057; font-size: 13px;">
            <strong>Note:</strong> This is a notification to inform you that the document you prepared/checked has been approved.
          </p>
        </div>
      </div>
    `;

    // Build recipient list: PREPARED + CHECKED
    const recipients = [];

    // Add PREPARED user
    if (preparedBy && preparedBy.trim() !== '') {
      const preparedUser = getUserInfo(preparedBy);
      if (preparedUser && preparedUser.notifyOnAssign) {
        recipients.push(preparedBy);
      } else {
        Logger.log(`[NOTIFY SKIP] ${preparedBy} has notifications disabled or user not found`);
      }
    }

    // Add CHECKED user
    if (checkedBy && checkedBy.trim() !== '') {
      // Remove any special privilege notation (e.g., "email (Prepared with Notification)")
      const checkedEmail = checkedBy.split(' ')[0].trim();

      if (!recipients.includes(checkedEmail)) {
        const checkedUser = getUserInfo(checkedEmail);
        if (checkedUser && checkedUser.notifyOnAssign) {
          recipients.push(checkedEmail);
        } else {
          Logger.log(`[NOTIFY SKIP] ${checkedEmail} has notifications disabled or user not found`);
        }
      }
    }

    if (recipients.length === 0) {
      Logger.log(`[NOTIFY] No recipients found for approval completion notification: CN ${cn}`);
      return [];
    }

    // Send notification to eligible recipients
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: subject,
      htmlBody: body,
      name: "SetupDataSheet System"
    });

    Logger.log(`[NOTIFY SUCCESS] Approval completion notification sent to: ${recipients.join(', ')} for CN ${cn}`);
    return recipients;

  } catch (e) {
    Logger.log(`[NOTIFY ERROR] Failed to send approval completion notification: ${e.message}`);
    return [];
  }
}

/**
 * Send rejection email notification to both PREPARED and CHECKED users
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} rejectedBy - User who rejected
 * @param {string} reason - Reason for rejection
 * @param {string} fileUrl - Attached file URL
 * @param {string} preparedBy - User who prepared the document
 * @param {string} checkedBy - User who checked the document
 */
function sendRejectionEmail(cn, processCode, rejectedBy, reason, fileUrl, preparedBy, checkedBy) {
  try {
    const subject = `❌ Document Rejected - CN: ${cn}`;
    const webAppUrl = ScriptApp.getService().getUrl();
    const documentUrl = `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
    
    let fileHtml = '';
    if (fileUrl && fileUrl !== '') {
      fileHtml = `
        <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #495057;">Attached File</h3>
          <p>A file was attached to this rejection. You can view it here:</p>
          <p><a href="${fileUrl}" style="background: #6c757d; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px;">View Attached File</a></p>
        </div>
      `;
    }

    const body = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ff6b6b; border-radius: 10px;">
        <h2 style="color: #d63031;">Document Rejected</h2>
        
        <div style="background: #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #e17055;">Document Details</h3>
          <p><strong>CN:</strong> ${cn}</p>
          <p><strong>Process Code:</strong> ${processCode || 'N/A'}</p>
          <p><strong>Rejected by:</strong> ${rejectedBy}</p>
        </div>
        
        <div style="background: #fab1a0; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #d63031;">Rejection Reason</h3>
          <p>${reason.replace(/\n/g, '<br>')}</p>
        </div>
        
        ${fileHtml}
        <div style="background: #fd79a8; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="color: #c44569;">Current Status</h3>
          <p>This document has been reset. Please review and correct the information.</p>
          <p>Status: <strong style="color: #d63031;">REJECTED</strong></p>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${documentUrl}" style="background: #e17055; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View and Edit Document (Auto-load)
          </a>
        </div>
      </div>
    `;
    
    // Build recipient list: PREPARED + CHECKED
    const recipients = [];

    // Add PREPARED users
    if (preparedBy) {
      recipients.push(preparedBy);
    } else {
      // If no specific preparedBy, send to all PRIMARY Prepared users
      const preparedUsers = getUsersByRole('Prepared');
      const primaryPrepared = preparedUsers.filter(u => u.priority === 'Primary');
      primaryPrepared.forEach(u => {
        if (!recipients.includes(u.email)) {
          recipients.push(u.email);
        }
      });
    }

    // Add CHECKED users - ALWAYS send to all PRIMARY Checked users
    const checkedUsers = getUsersByRole('Checked');
    const primaryChecked = checkedUsers.filter(u => u.priority === 'Primary');
    primaryChecked.forEach(u => {
      if (!recipients.includes(u.email)) {
        recipients.push(u.email);
      }
    });

    if (recipients.length === 0) {
      Logger.log(`No recipients found for rejection email: CN ${cn}`);
      return;
    }

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: subject,
      htmlBody: body,
      name: "SetupDataSheet System"
    });

    Logger.log(`Rejection email sent to: ${recipients.join(', ')} for CN ${cn}`);
  } catch (e) {
    Logger.log(`Failed to send rejection email: ${e.message}`);
  }
}