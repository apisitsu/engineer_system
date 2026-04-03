// ================================================================= //
//                    WORKFLOW & STATUS MANAGEMENT                   //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Workflow Service Module
 * Handles document status tracking and approval workflow
 * (Version includes logical order fix for special permissions)
 */

/**
 * Enhanced record stamp status with flexible workflow
 * @param {string} sheetName - Name of the sheet
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {Object} stamps - Stamp status object
 * @param {Object} user - User information object
 * @param {string} rev - Revision number (Setup_Data_Sheet_REV)
 * @param {string} nextAssignee - Next assignee email (optional)
 * @param {boolean} skipAwarenessNotification - Skip sending awareness notifications (for bulk operations)
 * @returns {Object} Result with usedSpecialPrivilege flag
 */
function recordStampStatus(sheetName, cn, processCode, stamps, user, rev = 'NC', nextAssignee = null, skipAwarenessNotification = false, machine = null) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Wait up to 30 seconds for the lock

  try {
    // [DEBUG] Log function call
    Logger.log(`[recordStampStatus] Called with: sheetName=${sheetName}, CN=${cn}, ProcessCode=${processCode}, REV=${rev}, stamps=${JSON.stringify(stamps)}`);

    // --- 1. GET SHEET AND DATA ---
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`[recordStampStatus] ERROR: Sheet '${sheetName}' not found`);
      return;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());
    const cnIndex = headers.indexOf('CN');
    const processCodeIndex = headers.indexOf('Process_Code');
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');
    const pnIndex = headers.indexOf('PN');
    const machineIndex = headers.indexOf('Machine');

    Logger.log(`[recordStampStatus] Column indices: CN=${cnIndex}, ProcessCode=${processCodeIndex}, REV=${revIndex}, Machine=${machineIndex}`);

    // Check if this sheet uses triple key
    const usesTripleKey = SHEETS_CONFIG.tripleKey && SHEETS_CONFIG.tripleKey.includes(sheetName);

    // --- 2. FIND TARGET ROW (WITH REVISION AND MACHINE FILTER) ---
    const rowIndex = data.findIndex(row => {
      const isCnMatch = String(row[cnIndex]) === String(cn);
      const isProcessCodeMatch = processCode ? (String(row[processCodeIndex]) === String(processCode)) : true;
      // [NEW] Filter by revision (critical for multi-revision support)
      const isRevMatch = revIndex === -1 || String(row[revIndex]) === String(rev);
      // [TRIPLE KEY] Filter by machine if triple key sheet and machine is provided
      const isMachineMatch = (usesTripleKey && machine && machineIndex > -1)
        ? (String(row[machineIndex]) === String(machine))
        : true;

      // [DEBUG] Log row matching
      if (isCnMatch && isProcessCodeMatch) {
        Logger.log(`[recordStampStatus] Found CN match, checking REV: row REV='${row[revIndex]}' vs search REV='${rev}', match=${isRevMatch}, Machine match=${isMachineMatch}`);
      }

      return isCnMatch && isProcessCodeMatch && isRevMatch && isMachineMatch;
    });

    if (rowIndex === -1) {
      Logger.log(`[recordStampStatus] ERROR: Row not found for CN=${cn}, ProcessCode=${processCode}, REV=${rev}`);
      return; // Row not found
    }

    Logger.log(`[recordStampStatus] Found row at index ${rowIndex} (sheet row ${rowIndex + 2})`);
    
    // --- 3. PREPARE VARIABLES ---
    const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const rowNumber = rowIndex + 2;
    const partNo = data[rowIndex][pnIndex];
    let nextRoleToNotify = null;
    let notificationRecipients = [];
    let usedSpecialPrivilege = false;

    // Get current Prepared_By and Checked_By for approval notifications
    const prepByIndex = headers.indexOf('Prepared_By');
    const chkByIndex = headers.indexOf('Checked_By');
    const currentPreparedBy = prepByIndex > -1 ? data[rowIndex][prepByIndex] : '';
    const currentCheckedBy = chkByIndex > -1 ? data[rowIndex][chkByIndex] : '';

    // --- 4. WORKFLOW & PERMISSION LOGIC ---
    // CRITICAL: Special privileges (e.g., Prepared checking for Checked)
    // must be checked *before* standard roles.

    Logger.log(`[recordStampStatus] Workflow check: stamps.prepared=${stamps.prepared}, stamps.checked=${stamps.checked}, stamps.approved=${stamps.approved}`);
    Logger.log(`[recordStampStatus] User roles: ${JSON.stringify(user.roles)}`);

    // --- PREPARED ---
    if (stamps.prepared && userHasRole(user, 'Prepared')) {
      // Standard Prepared action
      Logger.log(`[recordStampStatus] Entering PREPARED workflow`);
      const prepByIndex = headers.indexOf('Prepared_By');
      const prepDateIndex = headers.indexOf('Prepared_Date');
      Logger.log(`[recordStampStatus] Column indices: Prepared_By=${prepByIndex}, Prepared_Date=${prepDateIndex}`);

      if (prepByIndex > -1) {
        sheet.getRange(rowNumber, prepByIndex + 1).setValue(user.email);
        Logger.log(`[recordStampStatus] Set Prepared_By to ${user.email} at row ${rowNumber}`);
      }
      if (prepDateIndex > -1) {
        sheet.getRange(rowNumber, prepDateIndex + 1).setValue(today);
        Logger.log(`[recordStampStatus] Set Prepared_Date to ${today} at row ${rowNumber}`);
      }

      nextRoleToNotify = 'Checked';
      
      // Determine next assignee for Checked role
      if (nextAssignee) {
        notificationRecipients = [nextAssignee];
      } else {
        const checkedUsers = getUsersByRole('Checked');
        if (checkedUsers.length > 0) {
          notificationRecipients = [checkedUsers[0].email];
        }
      }
      
    // --- CHECKED (FIXED ORDER) ---

    // [FIX 1] Check for 'Prepared' user using special 'Check' privilege FIRST
    } else if (stamps.checked && userHasRole(user, 'Prepared') && canCheckWithNotification(user)) {
      // 'Prepared' user is stamping 'Checked'
      const chkByIndex = headers.indexOf('Checked_By');
      const chkDateIndex = headers.indexOf('Checked_Date');
      if (chkByIndex > -1) sheet.getRange(rowNumber, chkByIndex + 1).setValue(`${user.email} (Prepared with Notification)`);
      if (chkDateIndex > -1) sheet.getRange(rowNumber, chkDateIndex + 1).setValue(today);

      nextRoleToNotify = 'Approved';
      usedSpecialPrivilege = true;

      // 1. Send AWARENESS notification to Primary Checked users (unless skipped for bulk)
      if (!skipAwarenessNotification) {
        sendCheckNotificationToCheckers(cn, processCode, user.email, 'Checked with Notification');
      }

      // 2. Determine next assignee for 'Approved' role (TASK notification)
      if (nextAssignee) {
        notificationRecipients = [nextAssignee];
      } else {
        const approvedUsers = getUsersByRole('Approved');
        if (approvedUsers.length > 0) {
          notificationRecipients = [approvedUsers[0].email];
        }
      }

    // [FIX 2] Check for standard 'Checked' role SECOND
    } else if (stamps.checked && userHasRole(user, 'Checked')) {
      // Standard Checked action
      const chkByIndex = headers.indexOf('Checked_By');
      const chkDateIndex = headers.indexOf('Checked_Date');
      if (chkByIndex > -1) sheet.getRange(rowNumber, chkByIndex + 1).setValue(user.email);
      if (chkDateIndex > -1) sheet.getRange(rowNumber, chkDateIndex + 1).setValue(today);

      nextRoleToNotify = 'Approved';

      // Determine next assignee for Approved role (TASK notification)
      if (nextAssignee) {
        notificationRecipients = [nextAssignee];
        if (nextAssignee.includes('user4') && user.email.includes('user2')) {
          sendAwarenessNotification('user3@company.com', cn, partNo, 'Checked', user.email);
        }
      } else {
        const approvedUsers = getUsersByRole('Approved');
        if (approvedUsers.length > 0) {
          notificationRecipients = [approvedUsers[0].email];
        }
      }

    // --- APPROVED (FIXED ORDER) ---

    // [FIX 3] Check for 'Checked' user using special 'Approve' privilege FIRST
    } else if (stamps.approved && userHasRole(user, 'Checked') && canApproveWithNotification(user)) {
      // 'Checked' user is stamping 'Approved'
      const appByIndex = headers.indexOf('Approved_By');
      const appDateIndex = headers.indexOf('Approved_Date');
      if (appByIndex > -1) sheet.getRange(rowNumber, appByIndex + 1).setValue(`${user.email} (Checked with Notification)`);
      if (appDateIndex > -1) sheet.getRange(rowNumber, appDateIndex + 1).setValue(today);

      usedSpecialPrivilege = true;

      // Send AWARENESS notification to Primary Approved users (unless skipped for bulk)
      if (!skipAwarenessNotification) {
        sendApprovalNotificationToApprovers(cn, processCode, user.email, 'Approved with Notification');
      }

      // [NEW] Send approval completion notification to Prepared and Checked users
      if (!skipAwarenessNotification) {
        sendApprovalCompletionNotification(cn, processCode, user.email, currentPreparedBy, currentCheckedBy, sheetName);
        Logger.log(`[recordStampStatus] Sent approval completion notification for CN=${cn}`);
      }

      nextRoleToNotify = null;
      notificationRecipients = [];

    // [FIX 4] Check for standard 'Approved' role SECOND
    } else if (stamps.approved && userHasRole(user, 'Approved')) {
      // Standard Approved action
      const appByIndex = headers.indexOf('Approved_By');
      const appDateIndex = headers.indexOf('Approved_Date');
      if (appByIndex > -1) sheet.getRange(rowNumber, appByIndex + 1).setValue(user.email);
      if (appDateIndex > -1) sheet.getRange(rowNumber, appDateIndex + 1).setValue(today);

      // [NEW] Send approval completion notification to Prepared and Checked users (unless skipped for bulk)
      if (!skipAwarenessNotification) {
        sendApprovalCompletionNotification(cn, processCode, user.email, currentPreparedBy, currentCheckedBy, sheetName);
        Logger.log(`[recordStampStatus] Sent approval completion notification for CN=${cn}`);
      }

      nextRoleToNotify = null;
      notificationRecipients = [];
    }
    
    // --- 5. NOTIFICATION & LOGGING ---

    // TASK notification will be sent as BULK by calling function (Code.gs)
    // Only log here for tracking
    if (nextRoleToNotify && notificationRecipients.length > 0) {
      Logger.log(`Task prepared for: ${notificationRecipients.join(', ')} for role ${nextRoleToNotify}`);
    }

    // Log the assignment/action
    logAssignment(cn, processCode, user.email, notificationRecipients[0] || '', nextRoleToNotify || 'Approved');

    // [AUTO-UPDATE] Update the MasterSearchIndex in real-time
    try {
      // FIX: Re-read the updated row to get the freshest data, then build an object to pass to the updater.
      // This prevents a race condition where the index might be updated with stale data.
      const updatedRowArray = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
      const updatedDataObject = {};
      headers.forEach((header, index) => {
        updatedDataObject[header] = updatedRowArray[index];
      });

      updateMasterIndexRow(sheetName, cn, processCode, rev, machine, updatedDataObject);
      Logger.log(`MasterSearchIndex updated after workflow action: CN=${cn}, REV=${rev}, Machine=${machine}`);
    } catch (indexError) {
      Logger.log(`Failed to update MasterSearchIndex after workflow: ${indexError.message}`);
      // Don't fail the whole workflow if index update fails
    }

    // [PDF CACHE] Invalidate cached PDFs for this CN (stamp changes affect PDF content)
    try {
      invalidatePdfCacheForCN(cn);
    } catch (pdfCacheError) {
      Logger.log(`Failed to invalidate PDF cache: ${pdfCacheError.message}`);
    }

    // Return result with usedSpecialPrivilege flag
    return {
      success: true,
      usedSpecialPrivilege: usedSpecialPrivilege,
      nextRoleToNotify: nextRoleToNotify
    };

  } catch (e) { // <-- This CATCH correctly matches the TRY block
    Logger.log(`Failed to record stamp status for CN ${cn}: ${e.message}`);
     throw e;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Save multiple status updates for batch processing
 * @param {Array} items - Array of items to update
 * @returns {Object} Success status and count summary
 */
function saveMultipleStatuses(items) {
  try {
    const currentUser = getUserInfo();
    if (!currentUser.roles || currentUser.roles.length === 0) {
      throw new Error('You do not have permission to save status.');
    }
    
    let successCount = 0;
    let errorCount = 0;

    items.forEach(item => {
      try {
        const wantsToStamp = item.stamps.prepared || item.stamps.checked || item.stamps.approved;
        if (wantsToStamp) {
          const rev = item.rev || item.Setup_Data_Sheet_REV || 'NC';
          recordStampStatus(item.sheetName, item.cn, item.process_code, item.stamps, currentUser, rev);
          successCount++;
        }
      } catch(e) {
        Logger.log(`Error processing item ${item.cn}: ${e.message}`);
        errorCount++;
      }
    });
    
    return { 
      success: true, 
      message: `Successfully saved ${successCount} items. Failed: ${errorCount}.` 
    };
  } catch (e) {
    Logger.log(`saveMultipleStatuses Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}