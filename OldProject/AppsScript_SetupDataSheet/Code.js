// ================================================================= //
//                      MAIN ENTRY POINT                             //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Main Script File
 * This file serves as the main entry point and contains
 * functions that need to be exposed to the frontend
 */

// ================================================================= //
//                 FRONTEND-EXPOSED FUNCTIONS                      //
// ================================================================= //

/**
 * List all sheet names in the spreadsheet
 */
function listAllSheets() {
  try {
    const sheets = dataSs.getSheets();
    Logger.log('=== All Sheets in Spreadsheet ===');
    sheets.forEach((sheet, index) => {
      Logger.log(`${index + 1}. ${sheet.getName()}`);
    });
    Logger.log('=================================');
    return sheets.map(s => s.getName());
  } catch (e) {
    Logger.log(`Error: ${e.message}`);
    return [];
  }
}

/**
 * Check headers in data sheets to find REV column name
 */
function checkRevColumnNames() {
  try {
    const sheets = dataSs.getSheets();
    const excludeSheets = ['AuthorizedUsers', 'MasterSearchIndex', 'AssignmentLog', 'RejectionLog', 'RevisionHistory'];

    Logger.log('=== Checking REV Column Names ===');

    sheets.forEach(sheet => {
      const name = sheet.getName();
      if (excludeSheets.includes(name)) return;

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const revColumns = headers.filter(h => String(h).toUpperCase().includes('REV'));

      if (revColumns.length > 0) {
        Logger.log(`${name}: ${revColumns.join(', ')}`);
      } else {
        Logger.log(`${name}: [NO REV COLUMN]`);
      }
    });

    Logger.log('===================================');
  } catch (e) {
    Logger.log(`Error: ${e.message}`);
  }
}

/**
 * Remove duplicate REV columns (keep only Setup_Data_Sheet_REV)
 * Run this to clean up sheets that have both REV and Setup_Data_Sheet_REV
 */
function removeDuplicateRevColumns() {
  try {
    const sheets = dataSs.getSheets();
    const excludeSheets = ['AuthorizedUsers', 'MasterSearchIndex', 'AssignmentLog', 'RejectionLog', 'RevisionHistory'];

    Logger.log('=== Removing Duplicate REV Columns ===');

    let sheetsProcessed = 0;
    let columnsRemoved = 0;

    sheets.forEach(sheet => {
      const name = sheet.getName();
      if (excludeSheets.includes(name)) return;

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Find REV and Setup_Data_Sheet_REV columns
      const revIndex = headers.indexOf('REV');
      const setupRevIndex = headers.findIndex(h => String(h).trim() === 'Setup_Data_Sheet_REV');

      // If both columns exist, remove the REV column
      if (revIndex !== -1 && setupRevIndex !== -1) {
        Logger.log(`${name}: Found both REV (col ${revIndex + 1}) and Setup_Data_Sheet_REV (col ${setupRevIndex + 1})`);

        // Delete the REV column
        sheet.deleteColumn(revIndex + 1);
        columnsRemoved++;
        Logger.log(`  → Removed REV column from ${name}`);
      } else if (revIndex !== -1 && setupRevIndex === -1) {
        Logger.log(`${name}: Only has REV column (will keep it)`);
      } else if (setupRevIndex !== -1) {
        Logger.log(`${name}: Only has Setup_Data_Sheet_REV (OK)`);
      }

      sheetsProcessed++;
    });

    Logger.log('======================================');
    Logger.log(`Processed ${sheetsProcessed} sheets`);
    Logger.log(`Removed ${columnsRemoved} duplicate REV columns`);
    Logger.log('======================================');

    return {
      success: true,
      sheetsProcessed,
      columnsRemoved
    };

  } catch (e) {
    Logger.log(`Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Run this function ONCE to initialize revision system
 * Creates RevisionHistory sheet and adds REV column to all data sheets
 */
function setupRevisionSystem() {
  const result = initializeRevisionSystem();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Function to load users into dropdown (called from frontend)
 */
function loadUsersForRole(role, department) {
  try {
    const users = getUsersForDropdown(role, department);
    if (users.length === 0) {
      return {
        success: false,
        error: `No active users found for ${role} role in ${department} department`,
        users: []
      };
    }

    const activeUsers = users.filter(user => user.isActive);
    const inactiveUsers = users.filter(user => !user.isActive);

    return {
      success: true,
      users: activeUsers,
      inactiveCount: inactiveUsers.length,
      totalCount: users.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      users: []
    };
  }
}

// ================================================================= //
//                    BULK OPERATIONS (Exposed)                    //
// ================================================================= //

/**
 * TEST FUNCTION: Test single prepare to verify updateMasterIndexRow works
 */
function testSinglePrepare() {
  const testItems = [{
    actual_table: 'VSG_tsg300znc',
    CN: '310165',
    Process_Code: '1021',
    Setup_Data_Sheet_REV: 'A',
    Prepared_By: false,
    Checked_By: false,
    Approved_By: false
  }];

  const result = bulkPrepared(testItems, 'apisit.rai@bestfixholding.com');
  Logger.log('Test Result: ' + JSON.stringify(result));
  return result;
}

/**
 * Enhanced Bulk Prepared operation with better error handling
 * @param {Array} items - Items to process
 * @param {string} checkedAssignee - Assignee for Checked role
 * @returns {Object} Success status and detailed counts
 */
function bulkPrepared(items, checkedAssignee) {
  try {
    const user = getUserInfo();
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const failedItems = [];

    // Validate user permission
    if (!user.roles.includes('Prepared')) {
      return { 
        success: false, 
        error: 'No permission to perform Prepared action',
        processed: 0, failed: 0, skipped: items.length
      };
    }

    // Validate assignee
    const assigneeInfo = getUserInfo(checkedAssignee);
    if (!assigneeInfo.isActive || !assigneeInfo.roles.includes('Checked')) {
      return {
        success: false, error: 'Invalid Checked assignee selected',
        processed: 0, failed: 0, skipped: items.length
      };
    }

    const processedItems = [];

    items.forEach(item => {
      try {
        Logger.log(`[bulkPrepared] Processing item: CN=${item.CN}, ProcessCode=${item.Process_Code}, REV=${item.Setup_Data_Sheet_REV}, Prepared_By=${item.Prepared_By}`);

        if (item.Prepared_By) {
          Logger.log(`[bulkPrepared] Skipping item ${item.CN} - already prepared`);
          skipped++;
          return;
        }
        const stamps = { prepared: true, checked: false, approved: false };
        // Skip awareness notification (though Prepared rarely has special privileges)
        const rev = item.Setup_Data_Sheet_REV || 'NC';
        const machine = item.Machine || null;
        Logger.log(`[bulkPrepared] Calling recordStampStatus for CN=${item.CN}, REV=${rev}, Machine=${machine}`);
        recordStampStatus(item.actual_table, item.CN, item.Process_Code, stamps, user, rev, checkedAssignee, true, machine);
        processed++;
        processedItems.push(item);
      } catch (e) {
        Logger.log(`Bulk Prepared failed for ${item.CN}: ${e.message}`);
        failed++;
        failedItems.push({ cn: item.CN, processCode: item.Process_Code, error: e.message });
      }
    });

    // Send bulk TASK notification for all processed items
    if (processed > 0 && processedItems.length > 0) {
      sendBulkNotificationToUser(checkedAssignee, processedItems, 'Checked');
    }

    return { 
      success: true, 
      processed: processed, failed: failed, skipped: skipped,
      failedItems: failedItems,
      message: `Bulk Prepared completed: ${processed} successful, ${failed} failed, ${skipped} skipped`
    };

  } catch (e) {
    Logger.log(`Fatal error in bulkPrepared: ${e.message}`);
    return { 
      success: false, 
      error: `Server error: ${e.message}`,
      processed: 0, failed: items ? items.length : 0, skipped: 0
    };
  }
}

/**
 * Enhanced Bulk Checked operation with validation
 * @param {Array} items - Items to process
 * @param {string} approvedAssignee - Assignee for Approved role
 * @returns {Object} Success status and detailed counts
 */
function bulkChecked(items, approvedAssignee) {
  try {
    const user = getUserInfo();
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const failedItems = [];

    const hasCheckedRole = user.roles.includes('Checked') || user.roles.includes('Approved');
    const canCheckWithNotify = user.roles.includes('Prepared') && user.canCheckWithNotification; 

    if (!hasCheckedRole && !canCheckWithNotify) { // <--- แก้ไขเงื่อนไขตรงนี้
      return {
        success: false, error: 'No permission to perform Checked action',
        processed: 0, failed: 0, skipped: items.length
      };
    }

    const assigneeInfo = getUserInfo(approvedAssignee);
    if (!assigneeInfo.isActive || !assigneeInfo.roles.includes('Approved')) {
      return {
        success: false, error: 'Invalid Approved assignee selected',
        processed: 0, failed: 0, skipped: items.length
      };
    }

    const processedItems = [];
    const specialPrivilegeItems = [];

    items.forEach(item => {
      try {
        if (!item.Prepared_By || item.Checked_By) {
          skipped++;
          return;
        }
        const stamps = { prepared: false, checked: true, approved: false };
        // Skip awareness notification in recordStampStatus, we'll send bulk later
        const rev = item.Setup_Data_Sheet_REV || 'NC';
        const machine = item.Machine || null;
        const result = recordStampStatus(item.actual_table, item.CN, item.Process_Code, stamps, user, rev, approvedAssignee, true, machine);
        processed++;
        processedItems.push(item);

        // Track items that used special privilege
        if (result && result.usedSpecialPrivilege) {
          specialPrivilegeItems.push(item);
        }
      } catch (e) {
        Logger.log(`Bulk Checked failed for ${item.CN}: ${e.message}`);
        failed++;
        failedItems.push({ cn: item.CN, processCode: item.Process_Code, error: e.message });
      }
    });

    // Send bulk AWARENESS notification for special privilege items
    if (specialPrivilegeItems.length > 0) {
      // sendCheckNotificationToCheckers already sends to all PRIMARY Checked users at once
      sendCheckNotificationToCheckers(
        specialPrivilegeItems[0].CN,
        specialPrivilegeItems[0].Process_Code || '',
        user.email,
        `Checked with Notification (${specialPrivilegeItems.length} documents)`
      );
    }

    // Send bulk TASK notification for all processed items
    if (processed > 0 && processedItems.length > 0) {
      sendBulkNotificationToUser(approvedAssignee, processedItems, 'Approved');
    }

    return {
      success: true,
      processed: processed, failed: failed, skipped: skipped,
      failedItems: failedItems,
      message: `Bulk Checked completed: ${processed} successful, ${failed} failed, ${skipped} skipped`
    };

  } catch (e) {
    Logger.log(`Fatal error in bulkChecked: ${e.message}`);
    return { 
      success: false, 
      error: `Server error: ${e.message}`,
      processed: 0, failed: items ? items.length : 0, skipped: 0
    };
  }
}

/**
 * Enhanced Bulk Approved operation with flexible workflow
 * @param {Array} items - Items to process
 * @returns {Object} Success status and detailed counts
 */
function bulkApproved(items) {
  try {
    const user = getUserInfo();
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const failedItems = [];
    const specialPrivilegeItems = [];

    items.forEach(item => {
      try {
        if (!item.Checked_By || item.Approved_By) {
          skipped++;
          return;
        }

        const stamps = { prepared: false, checked: false, approved: true };
        // Skip awareness notification in recordStampStatus, we'll send bulk later
        const rev = item.Setup_Data_Sheet_REV || 'NC';
        const machine = item.Machine || null;
        const result = recordStampStatus(item.actual_table, item.CN, item.Process_Code, stamps, user, rev, null, true, machine);
        processed++;

        // Track items that used special privilege
        if (result && result.usedSpecialPrivilege) {
          specialPrivilegeItems.push(item);
        }
      } catch (e) {
        Logger.log(`Bulk Approved failed for ${item.CN}: ${e.message}`);
        failed++;
        failedItems.push({ cn: item.CN, processCode: item.Process_Code, error: e.message });
      }
    });

    // Send bulk AWARENESS notification for special privilege items
    if (specialPrivilegeItems.length > 0) {
      // sendApprovalNotificationToApprovers already sends to all PRIMARY Approved users at once
      sendApprovalNotificationToApprovers(
        specialPrivilegeItems[0].CN,
        specialPrivilegeItems[0].Process_Code || '',
        user.email,
        `Approved with Notification (${specialPrivilegeItems.length} documents)`
      );
    }

    return {
      success: true,
      processed: processed, failed: failed, skipped: skipped,
      approvedWithNotification: specialPrivilegeItems.length,
      failedItems: failedItems,
      message: `Bulk Approved completed: ${processed} successful (${specialPrivilegeItems.length} with notification), ${failed} failed, ${skipped} skipped`
    };

  } catch (e) {
    Logger.log(`Fatal error in bulkApproved: ${e.message}`);
    return { 
      success: false, 
      error: `Server error: ${e.message}`,
      processed: 0, failed: items ? items.length : 0, skipped: 0
    };
  }
}

/**
 * [NEW] Handle single document rejection from sds.html
 * @param {Object} formData - Form data containing cn, processCode, sheetName, reason, and file
 */
function rejectDocument(formData) {
  try {
    const user = getUserInfo(); // [UserService.gs]
    if (!user.roles || user.roles.length === 0) {
      throw new Error("User does not have permission.");
    }

    // 1. Find the document row (with revision if provided)
    // IMPORTANT: Default to 'NC' not null to ensure correct revision is found
    const rev = formData.rev || formData.Setup_Data_Sheet_REV || 'NC';
    const machine = formData.machine || null;
    Logger.log(`[rejectDocument] Received formData.rev=${formData.rev}, formData.Setup_Data_Sheet_REV=${formData.Setup_Data_Sheet_REV}, final rev=${rev}`);
    Logger.log(`[rejectDocument] Searching for: CN=${formData.cn}, ProcessCode=${formData.processCode}, REV=${rev}, Machine=${machine}`);

    const findResult = getDataByCnAndProcessCode(formData.sheetName, formData.cn, formData.processCode, rev, machine); // [DataService.gs]
    if (!findResult.success) {
      throw new Error(`Cannot find document to reject: ${findResult.error}`);
    }
    const preparedBy = findResult.data.Prepared_By || null;
    const checkedBy = findResult.data.Checked_By || null;
    const actualRev = findResult.data.Setup_Data_Sheet_REV || 'NC';

    Logger.log(`[rejectDocument] Found row: rowIndex=${findResult.rowIndex}, actualRev=${actualRev}`);

    // 2. Handle file attachment (if exists)
    let fileBlob = null;
    if (formData.file && formData.file.data) {
      fileBlob = Utilities.newBlob(
        Utilities.base64Decode(formData.file.data),
        formData.file.type,
        formData.file.name
      );
    }

    // 3. Log the rejection (will upload file to Drive)
    const logResult = logRejection( // [Utilities.gs]
      formData.cn,
      formData.processCode,
      formData.sheetName,
      user.email,
      formData.reason,
      fileBlob
    );
    const fileUrl = logResult.fileUrl; // URL of uploaded file (if any)

    // 4. Reset status in main data sheet
    const sheet = dataSs.getSheetByName(formData.sheetName);
    if (sheet) {
      resetDocumentStatus(sheet, findResult.rowIndex, actualRev); // [Utilities.gs]
    }

    // 5. Reset status in MasterSearchIndex (to show Pending status in search) - with revision
    resetMasterIndexRow(formData.sheetName, formData.cn, formData.processCode, actualRev, machine); // [SearchService.gs]

    // [PDF CACHE] Invalidate cached PDFs for this CN (rejection resets status)
    try {
      invalidatePdfCacheForCN(formData.cn);
    } catch (pdfCacheError) {
      Logger.log(`Failed to invalidate PDF cache: ${pdfCacheError.message}`);
    }

    // 6. Send rejection email notification to both PREPARED and CHECKED
    sendRejectionEmail( // [NotificationService.gs]
      formData.cn,
      formData.processCode,
      user.email,
      formData.reason,
      fileUrl,
      preparedBy,
      checkedBy
    );

    return { success: true, message: "Document rejected successfully." };

  } catch (e) {
    Logger.log(`Error in rejectDocument: ${e.message} (Data: ${JSON.stringify(formData)})`);
    return { success: false, error: e.message };
  }
}

/**
 * [NEW] Get pending items waiting for approval
 * @param {string} status - 'checked' or 'approved'
 * @returns {Object} Pending items list with count
 */
function getPendingItems(status) {
  try {
    const user = getUserInfo();

    // Permission check
    if (status === 'checked' && !userHasRole(user, 'Checked')) {
      return { success: false, error: 'No permission to view Checked pending items' };
    }
    if (status === 'approved' && !userHasRole(user, 'Approved')) {
      return { success: false, error: 'No permission to view Approved pending items' };
    }

    // Query MasterSearchIndex for better performance
    const indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
    if (!indexSheet) {
      throw new Error('MasterSearchIndex not found. Please run updateMasterIndex first.');
    }

    const data = indexSheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    // Find column indices
    const indices = {
      cn: headers.indexOf('CN'),
      pn: headers.indexOf('PN'),
      process: headers.indexOf('Process'),
      machine: headers.indexOf('Machine'),
      processCode: headers.indexOf('Process_Code'),
      material: headers.indexOf('Material'),
      preparedBy: headers.indexOf('Prepared_By'),
      preparedDate: headers.indexOf('Prepared_Date'),
      checkedBy: headers.indexOf('Checked_By'),
      checkedDate: headers.indexOf('Checked_Date'),
      approvedBy: headers.indexOf('Approved_By'),
      approvedDate: headers.indexOf('Approved_Date'),
      actualTable: headers.indexOf('actual_table')
    };

    // Filter based on status
    const filteredData = data.filter(row => {
      if (status === 'checked') {
        // Items that are Prepared but not Checked
        return row[indices.preparedBy] &&
               String(row[indices.preparedBy]).trim() !== '' &&
               (!row[indices.checkedBy] || String(row[indices.checkedBy]).trim() === '');
      } else if (status === 'approved') {
        // Items that are Checked but not Approved
        return row[indices.checkedBy] &&
               String(row[indices.checkedBy]).trim() !== '' &&
               (!row[indices.approvedBy] || String(row[indices.approvedBy]).trim() === '');
      }
      return false;
    });

    // Group by CN and count items
    const cnGroups = {};
    filteredData.forEach(row => {
      const cn = String(row[indices.cn]).trim();
      if (!cnGroups[cn]) {
        cnGroups[cn] = {
          cn: cn,
          count: 0,
          by: status === 'checked' ? row[indices.preparedBy] : row[indices.checkedBy],
          date: formatDateValue(status === 'checked' ? row[indices.preparedDate] : row[indices.checkedDate]),
          link: generateSearchLink(cn)
        };
      }
      cnGroups[cn].count++;
    });

    // Convert to array and sort by date (newest first)
    const pendingItems = Object.values(cnGroups).sort((a, b) => {
      return String(b.date).localeCompare(String(a.date));
    });

    return {
      success: true,
      count: filteredData.length,
      items: pendingItems,
      status: status
    };

  } catch (e) {
    Logger.log(`Error in getPendingItems: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Helper: Generate search link for direct access
 */
function generateSearchLink(cn) {
  const webAppUrl = ScriptApp.getService().getUrl();
  return `${webAppUrl}?search=${encodeURIComponent(cn)}&autoload=true`;
}

/**
 * Helper: Format date value
 */
function formatDateValue(dateValue) {
  if (!dateValue) return '';
  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, "GMT+7", "yyyy-MM-dd");
  }
  return String(dateValue);
}

/**
 * [NEW] Reject multiple documents from sds.html
 * @param {Object} formData - Form data containing items (JSON string), reason, and file
 */
function bulkRejectDocuments(formData) {
  let processed = 0;
  let failed = 0;
  const failedItems = [];
  
  try {
    const user = getUserInfo(); // [UserService.gs]
    if (!user.roles || user.roles.length === 0) {
      throw new Error("User does not have permission.");
    }
    
    const items = JSON.parse(formData.items);
    const reason = formData.reason;
    
    // 1. Handle file attachment (upload only once)
    let fileBlob = null;
    let fileUrl = ''; // This URL will be reused for all emails and logs
    
    if (formData.file && formData.file.data) {
      fileBlob = Utilities.newBlob(
        Utilities.base64Decode(formData.file.data), 
        formData.file.type, 
        formData.file.name
      );
      
      // Upload file to Drive and store the URL
      const folder = getRejectionFolder(); // [Utilities.gs]
      const file = folder.createFile(fileBlob);
      fileUrl = file.getUrl();
    }

    // 2. Loop through and process each item
    items.forEach(item => {
      try {
        // 2.1 Find data (with revision)
        const rev = item.Setup_Data_Sheet_REV || 'NC';
        const machine = item.Machine || null;
        const findResult = getDataByCnAndProcessCode(item.actual_table, item.CN, item.Process_Code, rev, machine); // [DataService.gs]
        if (!findResult.success) {
          throw new Error(findResult.error);
        }
        const preparedBy = findResult.data.Prepared_By || null;
        const checkedBy = findResult.data.Checked_By || null;
        const actualRev = findResult.data.Setup_Data_Sheet_REV || 'NC';

        // 2.2 Log rejection (send fileBlob as null to avoid duplicate uploads, but we'll log the URL ourselves)
        // Note: logRejection doesn't support passing URL directly, so we need to call logRejection
        // by sending the original Blob each time (which would create duplicate files) or send null
        // We'll send null blob and use the fileUrl we created for sending emails

        logRejection( // [Utilities.gs]
          item.CN,
          item.Process_Code,
          item.actual_table,
          user.email,
          reason,
          null // Send null blob to avoid duplicate uploads
        );

        // 2.3 Reset status in main data sheet
        const sheet = dataSs.getSheetByName(item.actual_table);
        if (sheet) {
          resetDocumentStatus(sheet, findResult.rowIndex, actualRev); // [Utilities.gs]
        }

        // 2.4 Reset status in MasterSearchIndex (with revision)
        resetMasterIndexRow(item.actual_table, item.CN, item.Process_Code, actualRev, machine); // [SearchService.gs]

        // [PDF CACHE] Invalidate cached PDFs for this CN
        try {
          invalidatePdfCacheForCN(item.CN);
        } catch (pdfCacheError) {
          Logger.log(`Failed to invalidate PDF cache for ${item.CN}: ${pdfCacheError.message}`);
        }

        // 2.5 Send email to both PREPARED and CHECKED (use the fileUrl we uploaded once)
        sendRejectionEmail( // [NotificationService.gs]
          item.CN,
          item.Process_Code,
          user.email,
          reason,
          fileUrl, // Use the same URL
          preparedBy,
          checkedBy
        );
        
        processed++;
        
      } catch (e) {
        Logger.log(`Failed to reject item ${item.CN} (${item.Process_Code}): ${e.message}`);
        failed++;
        failedItems.push(`${item.CN} (${item.Process_Code})`);
      }
    });

    return { 
      success: true, 
      processed: processed, 
      failed: failed, 
      message: `Processed: ${processed}, Failed: ${failed}.` 
    };

  } catch (e) {
    Logger.log(`Fatal error in bulkRejectDocuments: ${e.message}`);
    return { 
      success: false, 
      error: e.message, 
      processed: processed, 
      failed: (formData.items ? JSON.parse(formData.items).length : 0) - processed 
    };
  }
}