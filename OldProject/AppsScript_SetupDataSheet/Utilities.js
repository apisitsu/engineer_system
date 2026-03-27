// ================================================================= //
//                 GENERAL UTILITIES & LOGGING                      //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Utilities Module
 * Contains helper functions and logging utilities
 */

/**
 * Log assignment for tracking
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} fromUser - User who assigned
 * @param {string} toUser - User who received assignment
 * @param {string} role - Role assigned
 */
function logAssignment(cn, processCode, fromUser, toUser, role) {
  try {
    let logSheet = dataSs.getSheetByName('AssignmentLog');
    
    // Create sheet if it doesn't exist
    if (!logSheet) {
      logSheet = dataSs.insertSheet('AssignmentLog');
      logSheet.getRange('A1:F1').setValues([[
        'Timestamp', 'CN', 'Process_Code', 'From_User', 'To_User', 'Role'
      ]]);
    }
    
    const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    logSheet.appendRow([
      timestamp, cn, processCode || '', fromUser, toUser, role
    ]);
    
    Logger.log(`Assignment logged: ${cn} -> ${toUser} for ${role}`);
  } catch (e) {
    Logger.log(`Failed to log assignment: ${e.message}`);
  }
}

/**
 * Get or create sheet by name
 * @param {string} sheetName - Sheet name
 * @returns {Sheet} Sheet object
 */
function getOrCreateSheet(sheetName) {
  let sheet = dataSs.getSheetByName(sheetName);
  if (!sheet) {
    sheet = dataSs.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Get or create rejection folder in Google Drive
 * @returns {Folder} Folder object
 */
function getRejectionFolder() {
  const folderName = 'SDS_Rejection_Attachments';
  const folders = DriveApp.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

/**
 * Reset document status after rejection
 * @param {Sheet} sheet - Sheet object
 * @param {number} rowIndex - Row index to reset
 * @param {string} rev - Revision number to reset (required to reset only specific revision)
 */
function resetDocumentStatus(sheet, rowIndex, rev) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // [NEW] Get data Key (CN, ProcessCode, REV, Machine) before clear
  const cnIndex = headers.indexOf('CN');
  const processCodeIndex = headers.indexOf('Process_Code');
  const revIndex = headers.indexOf('Setup_Data_Sheet_REV');
  const machineIndex = headers.indexOf('Machine');
  const cn = (cnIndex > -1) ? sheet.getRange(rowIndex, cnIndex + 1).getValue() : null;
  const processCode = (processCodeIndex > -1) ? sheet.getRange(rowIndex, processCodeIndex + 1).getValue() : ''; // Use '' if no value
  const actualRev = rev || ((revIndex > -1) ? sheet.getRange(rowIndex, revIndex + 1).getValue() : 'NC');
  const machine = (machineIndex > -1) ? sheet.getRange(rowIndex, machineIndex + 1).getValue() : null;
  const sheetName = sheet.getName();

   // Clear Prepared data
  const prepByIndex = headers.indexOf('Prepared_By');
  const prepDateIndex = headers.indexOf('Prepared_Date');
   if (prepByIndex > -1) sheet.getRange(rowIndex, prepByIndex + 1).setValue('');
  if (prepDateIndex > -1) sheet.getRange(rowIndex, prepDateIndex + 1).setValue('');
   // Clear Checked data
  const chkByIndex = headers.indexOf('Checked_By');
  const chkDateIndex = headers.indexOf('Checked_Date');
   if (chkByIndex > -1) sheet.getRange(rowIndex, chkByIndex + 1).setValue('');
  if (chkDateIndex > -1) sheet.getRange(rowIndex, chkDateIndex + 1).setValue('');

  // [NEW] Get update Index to clean (with revision and machine)
  if (cn && sheetName) {
    try {
      resetMasterIndexRow(sheetName, cn, processCode, actualRev, machine);
      Logger.log(`resetMasterIndexRow called from resetDocumentStatus for CN=${cn}, REV=${actualRev}, Machine=${machine}`);
    } catch (e) {
      Logger.log(`Failed to call resetMasterIndexRow from resetDocumentStatus: ${e.message}`);
    }
  }
 }

/**
 * Log rejection for audit trail
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} sheetName - Sheet name
 * @param {string} rejectedBy - User who rejected
 * @param {string} reason - Reason for rejection
 * @param {Blob} fileBlob - Attached file (optional)
 * @returns {Object} Rejection ID and file URL
 */
function logRejection(cn, processCode, sheetName, rejectedBy, reason, fileBlob) {
  const logSheet = getOrCreateSheet('RejectionLog');
  const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
  const rejectId = Utilities.getUuid();
  
  let fileUrl = '';
  if (fileBlob) {
    // Upload file to Google Drive
    const folder = getRejectionFolder();
    const file = folder.createFile(fileBlob);
    fileUrl = file.getUrl();
  }
  
  logSheet.appendRow([
    timestamp,
    rejectId,
    cn,
    processCode,
    sheetName,
    rejectedBy,
    reason,
    fileUrl,
    'REJECTED'
  ]);
  
  return { rejectId: rejectId, fileUrl: fileUrl };
}

// ================================================================= //
//                    REVISION SYSTEM UTILITIES                     //
// ================================================================= //

/**
 * Setup or verify RevisionHistory sheet structure
 * Called during initialization or first use
 */
function setupRevisionHistorySheet() {
  try {
    let revSheet = dataSs.getSheetByName('RevisionHistory');

    // Create sheet if it doesn't exist
    if (!revSheet) {
      revSheet = dataSs.insertSheet('RevisionHistory');
      revSheet.getRange('A1:I1').setValues([[
        'ECN_Date', 'CN', 'REV', 'ECN_NO', 'DESCRIPTION', 'REMARK',
        'SHEET_NAME', 'PROCESS_CODE', 'CREATED_BY'
      ]]);

      // Format header row
      revSheet.getRange('A1:I1').setFontWeight('bold');
      revSheet.setFrozenRows(1);

      Logger.log('RevisionHistory sheet created successfully.');
      return { success: true, message: 'RevisionHistory sheet created.' };
    }

    return { success: true, message: 'RevisionHistory sheet already exists.' };
  } catch (e) {
    Logger.log(`setupRevisionHistorySheet Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get next revision number for a CN
 * REV Format: NC → A → B → ... → Z → AA → AB → ... → AZ → BA → ... → ZZ → AAA → ...
 * @param {string} sheetName - Sheet name
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code (optional)
 * @returns {string} Next revision number
 */
function getNextRevision(sheetName, cn, processCode, machine = null) {
  try {
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found.`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    // Find Setup_Data_Sheet_REV column (may not exist yet)
    const cnIndex = headers.indexOf('CN');
    const processCodeIndex = headers.indexOf('Process_Code');
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');
    const machineIndex = headers.indexOf('Machine');

    if (cnIndex === -1) {
      throw new Error('CN column not found in sheet.');
    }

    // If Setup_Data_Sheet_REV column doesn't exist, return 'A' as first revision
    if (revIndex === -1) {
      return 'A';
    }

    // Check if this sheet uses triple key
    const usesTripleKey = SHEETS_CONFIG.tripleKey && SHEETS_CONFIG.tripleKey.includes(sheetName);

    // Find all existing revisions for this CN (and optionally Process Code + Machine)
    const existingRevisions = [];
    data.forEach(row => {
      const isCnMatch = String(row[cnIndex]).trim() === String(cn).trim();
      const isProcessCodeMatch = processCodeIndex === -1 ||
                                 !processCode ||
                                 String(row[processCodeIndex]).trim() === String(processCode).trim();

      // [TRIPLE KEY] Filter by machine if triple key sheet and machine is provided
      const isMachineMatch = (usesTripleKey && machine && machineIndex > -1)
        ? (String(row[machineIndex]).trim() === String(machine).trim())
        : true;

      if (isCnMatch && isProcessCodeMatch && isMachineMatch) {
        const rev = String(row[revIndex]).trim().toUpperCase();
        if (rev && rev !== 'NC') {
          existingRevisions.push(rev);
        }
      }
    });

    // If no revisions exist, return 'A'
    if (existingRevisions.length === 0) {
      return 'A';
    }

    // Find the highest revision and increment
    const highestRev = getHighestRevision(existingRevisions);
    return incrementRevision(highestRev);

  } catch (e) {
    Logger.log(`getNextRevision Error: ${e.message}`);
    return 'A'; // Default to 'A' on error
  }
}

/**
 * Get highest revision from array of revisions
 * @param {Array} revisions - Array of revision strings
 * @returns {string} Highest revision
 */
function getHighestRevision(revisions) {
  // Sort revisions by length first, then alphabetically
  const sorted = revisions.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length; // Shorter first
    }
    return a.localeCompare(b); // Alphabetically
  });

  return sorted[sorted.length - 1]; // Return last (highest)
}

/**
 * Increment revision number
 * A → B, Z → AA, AZ → BA, ZZ → AAA
 * @param {string} rev - Current revision
 * @returns {string} Next revision
 */
function incrementRevision(rev) {
  rev = rev.toUpperCase();

  // Convert to array of characters
  let chars = rev.split('');

  // Increment from right to left
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === 'Z') {
      chars[i] = 'A'; // Rollover to A
      if (i === 0) {
        // All positions rolled over, add new character
        chars.unshift('A');
        break;
      }
      // Continue to next position
    } else {
      // Increment this character
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      break;
    }
  }

  return chars.join('');
}

/**
 * Log revision creation to RevisionHistory sheet
 * @param {string} cn - Control Number
 * @param {string} rev - Revision number
 * @param {string} ecnNo - ECN Number
 * @param {string} description - ECN Description
 * @param {string} remark - ECN Remark
 * @param {string} sheetName - Sheet name
 * @param {string} processCode - Process Code (optional)
 * @param {string} createdBy - User email
 * @returns {Object} Success status
 */
function logRevisionHistory(cn, rev, ecnNo, ecnDate, description, remark, sheetName, processCode, createdBy) {
  try {
    // Ensure RevisionHistory sheet exists
    setupRevisionHistorySheet();

    const revSheet = dataSs.getSheetByName('RevisionHistory');
    if (!revSheet) {
      throw new Error('Failed to create RevisionHistory sheet.');
    }

    revSheet.appendRow([
      ecnDate || '',
      cn,
      rev,
      ecnNo || '',
      description || '',
      remark || '',
      sheetName,
      processCode || '',
      createdBy
    ]);

    Logger.log(`Revision logged: CN ${cn}, REV ${rev}, ECN ${ecnNo}, Date ${ecnDate}`);
    return { success: true };

  } catch (e) {
    Logger.log(`logRevisionHistory Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get revision history for a specific CN
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code (optional)
 * @returns {Object} Array of revision records
 */
function getRevisionHistory(cn, processCode) {
  try {
    const revSheet = dataSs.getSheetByName('RevisionHistory');
    if (!revSheet) {
      return { success: true, revisions: [] };
    }

    const data = revSheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    const cnIndex = headers.indexOf('CN');
    const processCodeIndex = headers.indexOf('Process_Code');
    const revIndex = headers.indexOf('REV');
    const ecnNoIndex = headers.indexOf('ECN_NO');
    const ecnDateIndex = headers.indexOf('ECN_Date');
    const descIndex = headers.indexOf('DESCRIPTION');
    const remarkIndex = headers.indexOf('REMARK');
    const sheetNameIndex = headers.indexOf('Sheet_Name');
    const createdByIndex = headers.indexOf('Created_By');

    const revisions = [];

    data.forEach(row => {
      const isCnMatch = String(row[cnIndex]).trim() === String(cn).trim();
      const isProcessCodeMatch = processCodeIndex === -1 ||
                                 !processCode ||
                                 String(row[processCodeIndex]).trim() === String(processCode).trim();

      if (isCnMatch && isProcessCodeMatch) {
        // [UPDATED] Return column names that match RevisionHistory table structure
        revisions.push({
          REV: row[revIndex] || '',
          ECN_NO: row[ecnNoIndex] || '',
          ECN_Date: row[ecnDateIndex] || '',
          DESCRIPTION: row[descIndex] || '',
          REMARK: row[remarkIndex] || '',
          Sheet_Name: row[sheetNameIndex] || '',
          Created_By: row[createdByIndex] || ''
        });
      }
    });

    // Sort by ECN_Date descending (newest first)
    revisions.sort((a, b) => String(b.ECN_Date).localeCompare(String(a.ECN_Date)));

    return { success: true, revisions: revisions };

  } catch (e) {
    Logger.log(`getRevisionHistory Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ================================================================= //
//                    TOOLING DATA UTILITIES                        //
// ================================================================= //

/**
 * Get tooling data from Grinding_Tooling sheet
 * @param {string} mainSheetName - Main sheet name (e.g., 'IDG_ks03a')
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {Array} Array of tooling objects
 */
function getToolingData(mainSheetName, cn, processCode, machine, rev) {
  try {
    // Check if this sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(mainSheetName)) {
      Logger.log(`Sheet '${mainSheetName}' does not have tooling data`);
      return [];
    }

    // Determine which tooling sheet to use based on machine type
    const machineType = MACHINE_TYPE_MAP[mainSheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];

    if (!toolingSheetName) {
      Logger.log(`No tooling sheet configured for machine type '${machineType}'`);
      return [];
    }

    // Open the appropriate tooling sheet
    const toolingSheet = dataSs.getSheetByName(toolingSheetName);

    if (!toolingSheet) {
      Logger.log(`Tooling sheet '${toolingSheetName}' not found`);
      return [];
    }

    Logger.log(`[getToolingData] Using tooling sheet: ${toolingSheetName} for ${mainSheetName}`);
    Logger.log(`[getToolingData] Search params: CN=${cn}, ProcessCode=${processCode}, Machine=${machine}, REV=${rev}`);

    // Read data
    const data = toolingSheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    // Find column indices
    const sheetNameIndex = headers.indexOf('Sheet_Name');
    const cnIndex = headers.indexOf('CN');
    const processCodeIndex = headers.indexOf('Process_Code');
    const machineIndex = headers.indexOf('Machine');
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');

    Logger.log(`[getToolingData] Column indices: Sheet_Name=${sheetNameIndex}, CN=${cnIndex}, Process_Code=${processCodeIndex}, Machine=${machineIndex}, REV=${revIndex}`);

    if (sheetNameIndex === -1 || cnIndex === -1) {
      Logger.log('Required columns (Sheet_Name, CN) not found in tooling sheet');
      return [];
    }

    // [DEBUG] Show first few rows to understand data structure
    Logger.log(`[getToolingData] Total rows in sheet: ${data.length}`);
    if (data.length > 0) {
      Logger.log(`[getToolingData] First row example: Sheet_Name='${data[0][sheetNameIndex]}', CN='${data[0][cnIndex]}', Machine='${machineIndex > -1 ? data[0][machineIndex] : 'N/A'}'`);
    }

    // Filter matching rows
    const matchingRows = data.filter(row => {
      const isSheetMatch = String(row[sheetNameIndex]) === String(mainSheetName);
      const isCnMatch = String(row[cnIndex]) === String(cn);
      const isProcessCodeMatch = (processCodeIndex === -1 || !processCode) ? true :
        (String(row[processCodeIndex]) === String(processCode));

      // [FIX] Don't match on Machine column - use Sheet_Name only
      // Because Machine column contains display name (e.g., "KVD350C")
      // but we search with sheet name (e.g., "HSG_kvd350")
      // Sheet_Name is the reliable identifier
      const isRevMatch = (revIndex === -1 || !rev) ? true :
        (String(row[revIndex]) === String(rev));

      // [DEBUG] Log each row's matching status for CN matches
      if (isCnMatch) {
        Logger.log(`[getToolingData] Row check: Sheet=${row[sheetNameIndex]}(${isSheetMatch}), CN=${row[cnIndex]}(${isCnMatch}), Machine=${machineIndex > -1 ? row[machineIndex] : 'N/A'}(ignored), ProcessCode=${processCodeIndex > -1 ? row[processCodeIndex] : 'N/A'}(${isProcessCodeMatch}), REV=${revIndex > -1 ? row[revIndex] : 'N/A'}(${isRevMatch})`);
      }

      return isSheetMatch && isCnMatch && isProcessCodeMatch && isRevMatch;
    });

    // Convert to objects
    const tooling = matchingRows.map(row => {
      const tool = {};
      headers.forEach((header, i) => {
        tool[header] = row[i];
      });
      return tool;
    });

    // Sort by Tool_Number
    tooling.sort((a, b) => {
      const aNum = String(a.Tool_Number || '');
      const bNum = String(b.Tool_Number || '');
      return aNum.localeCompare(bNum);
    });

    Logger.log(`[getToolingData] Found ${tooling.length} tools for Sheet=${mainSheetName}, CN=${cn}`);
    return tooling;

  } catch (e) {
    Logger.log(`getToolingData Error: ${e.message}`);
    return [];
  }
}

/**
 * Count tooling records for a setup (without loading full data)
 * Used for lazy loading - show count immediately, load details on demand
 * @param {string} mainSheetName - Main sheet name
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {number} Number of tooling records
 */
function countToolingForSetup(mainSheetName, cn, processCode, machine, rev) {
  try {
    // Check if this sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(mainSheetName)) {
      return 0;
    }

    // Determine which tooling sheet to use
    const machineType = MACHINE_TYPE_MAP[mainSheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];

    if (!toolingSheetName) {
      return 0;
    }

    // Open the tooling sheet
    const toolingSheet = dataSs.getSheetByName(toolingSheetName);
    if (!toolingSheet) {
      return 0;
    }

    // Read data
    const data = toolingSheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    // Find column indices
    const sheetNameIndex = headers.indexOf('Sheet_Name');
    const cnIndex = headers.indexOf('CN');
    const processCodeIndex = headers.indexOf('Process_Code');
    const machineIndex = headers.indexOf('Machine');
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');

    if (sheetNameIndex === -1 || cnIndex === -1) {
      return 0;
    }

    // Count matching rows
    let count = 0;
    data.forEach(row => {
      const isSheetMatch = String(row[sheetNameIndex]) === String(mainSheetName);
      const isCnMatch = String(row[cnIndex]) === String(cn);
      const isProcessCodeMatch = (processCodeIndex === -1 || !processCode) ? true :
        (String(row[processCodeIndex]) === String(processCode));
      const isMachineMatch = (machineIndex === -1 || !machine) ? true :
        (String(row[machineIndex]) === String(machine));
      const isRevMatch = (revIndex === -1 || !rev) ? true :
        (String(row[revIndex]) === String(rev));

      if (isSheetMatch && isCnMatch && isProcessCodeMatch &&
          isMachineMatch && isRevMatch) {
        count++;
      }
    });

    Logger.log(`[countToolingForSetup] Found ${count} tools for Sheet=${mainSheetName}, CN=${cn}`);
    return count;

  } catch (e) {
    Logger.log(`countToolingForSetup Error: ${e.message}`);
    return 0;
  }
}

/**
 * Parse tool number from string (handles "T01", "01", "1", etc.)
 * @param {string|number} toolNumber - Tool number in various formats
 * @returns {number} Parsed numeric tool number
 */
function parseToolNumber(toolNumber) {
  if (!toolNumber) return 0;

  const str = String(toolNumber).trim().toUpperCase();
  // Remove T prefix if exists
  const numStr = str.replace(/^T/, '');
  // Parse to integer
  const num = parseInt(numStr, 10);

  return isNaN(num) ? 0 : num;
}

/**
 * Convert tooling array to flat object - FIXED VERSION
 * Maps to actual Tool_Number positions (not sequential array index)
 *
 * @param {Object} setupData - Setup data object
 * @param {Array} toolingArray - Array of tooling objects
 * @param {number} maxTools - Maximum number of tools (default: 20 for grinding)
 */
function convertToolingToFlat(setupData, toolingArray, maxTools = 20) {
  try {
    const flatData = { ...setupData };

    // Initialize all positions as empty first
    for (let i = 1; i <= maxTools; i++) {
      flatData[`Tooling_No_${i}`] = '';
      flatData[`No_${i}_Maker`] = '';
      flatData[`Tool_Remarks_${i}`] = '';

      const paddedNum = String(i).padStart(2, '0');
      flatData[`tooling_no_${paddedNum}`] = '';
      flatData[`no_${paddedNum}_maker`] = '';
      flatData[`tool_remarks_${paddedNum}`] = '';
    }

    // Now populate based on actual Tool_Number
    toolingArray.forEach(tool => {
      const toolNum = parseToolNumber(tool.Tool_Number);

      if (toolNum < 1 || toolNum > maxTools) {
        Logger.log(`Warning: Tool_Number ${tool.Tool_Number} is out of range (1-${maxTools})`);
        return; // Skip this tool
      }

      // Populate actual position (removed Tool_Type and Grinding_Wheel_Spec)
      flatData[`Tooling_No_${toolNum}`] = tool.Tooling_No || '';
      flatData[`No_${toolNum}_Maker`] = tool.Maker || '';
      flatData[`Tool_Remarks_${toolNum}`] = tool.Remarks || '';

      const paddedNum = String(toolNum).padStart(2, '0');
      flatData[`tooling_no_${paddedNum}`] = tool.Tooling_No || '';
      flatData[`no_${paddedNum}_maker`] = tool.Maker || '';
      flatData[`tool_remarks_${paddedNum}`] = tool.Remarks || '';
    });

    Logger.log(`[convertToolingToFlat] Mapped ${toolingArray.length} tools to actual Tool_Number positions`);
    return flatData;

  } catch (e) {
    Logger.log(`convertToolingToFlat Error: ${e.message}`);
    return setupData;
  }
}

/**
 * Convert turning tooling array to flat object - FIXED VERSION
 * Maps to actual Tool_Number positions
 */
function convertTurningToolingToFlat(setupData, toolingArray, maxTools = 12) {
  try {
    const flatData = { ...setupData };

    // Initialize all positions as empty first
    for (let i = 1; i <= maxTools; i++) {
      flatData[`Tool_Name_${i}`] = '';
      flatData[`Tool_Number_${i}`] = '';
      flatData[`Tool_Detail_${i}`] = '';
      flatData[`Insert_Info_${i}`] = '';
      flatData[`Insert_I_${i}`] = '';
      flatData[`Insert_E_${i}`] = '';
      flatData[`Insert_Maker_${i}`] = '';
      flatData[`Holder_Info_${i}`] = '';
      flatData[`Holder_Maker_${i}`] = '';
      flatData[`Hand_${i}`] = '';
      flatData[`Overhang_${i}`] = '';
      flatData[`H_Width_${i}`] = '';
      flatData[`Rotation_${i}`] = '';
      flatData[`F_${i}`] = '';
      flatData[`AP_${i}`] = '';
      flatData[`Nose_R_${i}`] = '';
      flatData[`Usaged_${i}`] = '';

      const paddedNum = String(i).padStart(2, '0');
      flatData[`tool_name_${paddedNum}`] = '';
      flatData[`tool_detail_${paddedNum}`] = '';
      flatData[`insert_info_${paddedNum}`] = '';
      flatData[`insert_maker_${paddedNum}`] = '';
      flatData[`holder_info_${paddedNum}`] = '';
      flatData[`holder_maker_${paddedNum}`] = '';
      flatData[`overhang_${paddedNum}`] = '';
      flatData[`rotation_${paddedNum}`] = '';
      flatData[`f_${paddedNum}`] = '';
      flatData[`ap_${paddedNum}`] = '';
      flatData[`nose_r_${paddedNum}`] = '';
    }

    // Now populate based on actual Tool_Number
    toolingArray.forEach(tool => {
      const toolNum = parseToolNumber(tool.Tool_Number);
      
      if (toolNum < 1 || toolNum > maxTools) {
        Logger.log(`Warning: Tool_Number ${tool.Tool_Number} is out of range (1-${maxTools})`);
        return;
      }

      // Populate actual position
      flatData[`Tool_Name_${toolNum}`] = tool.Tool_Name || '';
      flatData[`Tool_Number_${toolNum}`] = tool.Tool_Number || '';
      flatData[`Tool_Detail_${toolNum}`] = tool.Tool_Detail || '';
      flatData[`Insert_Info_${toolNum}`] = tool.Insert_Info || '';
      flatData[`Insert_I_${toolNum}`] = tool.Insert_I || '';
      flatData[`Insert_E_${toolNum}`] = tool.Insert_E || '';
      flatData[`Insert_Maker_${toolNum}`] = tool.Insert_Maker || '';
      flatData[`Holder_Info_${toolNum}`] = tool.Holder_Info || '';
      flatData[`Holder_Maker_${toolNum}`] = tool.Holder_Maker || '';
      flatData[`Hand_${toolNum}`] = tool.Hand || '';
      flatData[`Overhang_${toolNum}`] = tool.Overhang || '';
      flatData[`H_Width_${toolNum}`] = tool.H_Width || '';
      flatData[`Rotation_${toolNum}`] = tool.Rotation || '';
      flatData[`F_${toolNum}`] = tool.F || '';
      flatData[`AP_${toolNum}`] = tool.AP || '';
      flatData[`Nose_R_${toolNum}`] = tool.Nose_R || '';
      flatData[`Usaged_${toolNum}`] = tool.Usaged || '';

      const paddedNum = String(toolNum).padStart(2, '0');
      flatData[`tool_name_${paddedNum}`] = tool.Tool_Name || '';
      flatData[`tool_detail_${paddedNum}`] = tool.Tool_Detail || '';
      flatData[`insert_info_${paddedNum}`] = tool.Insert_Info || '';
      flatData[`insert_maker_${paddedNum}`] = tool.Insert_Maker || '';
      flatData[`holder_info_${paddedNum}`] = tool.Holder_Info || '';
      flatData[`holder_maker_${paddedNum}`] = tool.Holder_Maker || '';
      flatData[`overhang_${paddedNum}`] = tool.Overhang || '';
      flatData[`rotation_${paddedNum}`] = tool.Rotation || '';
      flatData[`f_${paddedNum}`] = tool.F || '';
      flatData[`ap_${paddedNum}`] = tool.AP || '';
      flatData[`nose_r_${paddedNum}`] = tool.Nose_R || '';
    });

    Logger.log(`[convertTurningToolingToFlat] Mapped ${toolingArray.length} tools to actual Tool_Number positions`);
    return flatData;

  } catch (e) {
    Logger.log(`convertTurningToolingToFlat Error: ${e.message}`);
    return setupData;
  }
}