// ================================================================= //
//                         SEARCH FUNCTIONALITY                      //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Search Service Module
 * Handles all search operations and data retrieval
 */

/**
 * [OPTIMIZED] Search data using the MasterSearchIndex sheet.
 * This is much faster as it only queries one sheet.
 * Features: Smart caching with auto-invalidation, lazy tooling load
 * @param {string} searchTerm - Search term
 * @param {Object} viewerSession - (Optional) Viewer session with allowed_process_codes
 * @returns {Object} Search results
 */
function searchData(searchTerm, viewerSession = null) {
  if (!searchTerm || searchTerm.trim() === '') {
   return { success: false, error: 'Please enter a search term' };
}

  const searchPattern = searchTerm.toLowerCase().trim();

  // [PHASE 2: CACHING] Try cache first
  const cached = getCachedSearchResults(searchPattern);
  if (cached) {
    Logger.log(`[searchData] Returning cached results (${cached.count} items)`);
    return cached;
  }
  let allResults = [];
  const currentUser = getUserInfo();
  const userHasRoles = currentUser.roles && currentUser.roles.length > 0;

  // [NEW] Determine user role type
  const isWorkflowUser = userHasRole(currentUser, ROLES.PREPARED) ||
                         userHasRole(currentUser, ROLES.CHECKED) ||
                         userHasRole(currentUser, ROLES.APPROVED);
  const isViewerRole = isViewer(currentUser);
  const isGuestRole = isGuest(currentUser);

  // Parse allowed Process Codes (for Viewer role only)
  let allowedProcessCodes = null;

  // [NEW] Priority: viewerSession > currentUser.allowedProcessCodes
  if (isViewerRole) {
    if (viewerSession && viewerSession.allowed_process_codes) {
      // Use viewerSession from secondary authentication
      const codesStr = String(viewerSession.allowed_process_codes).trim();
      if (codesStr !== '*' && codesStr !== '') {
        allowedProcessCodes = codesStr.split(',').map(c => c.trim());
        Logger.log(`[searchData] Using viewerSession Process Codes: ${codesStr}`);
      }
    } else if (currentUser.allowedProcessCodes) {
      // Fallback to AuthorizedUsers (backward compatibility)
      const codesStr = String(currentUser.allowedProcessCodes).trim();
      if (codesStr !== '*' && codesStr !== '') {
        allowedProcessCodes = codesStr.split(',').map(c => c.trim());
        Logger.log(`[searchData] Using AuthorizedUsers Process Codes: ${codesStr}`);
      }
    }
  }
  
  try {
    // [OPTIMIZED] Search the single Master Index Sheet, not all sheets
    const indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
    if (!indexSheet) {
      throw new Error(`Critical Error: Sheet '${MASTER_INDEX_SHEET}' not found. Please run 'updateMasterIndex' function once to build it.`);
    }

    const data = indexSheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    // Find column indices in the index sheet
    const cnIndex = headers.indexOf('CN');
    const pnIndex = headers.indexOf('PN');
    const processIndex = headers.indexOf('Process');
    const processCodeIndex = headers.indexOf('Process_Code');
    const materialIndex = headers.indexOf('Material');
    const approvedByIndex = headers.indexOf('Approved_By');
    
    // Define searchable columns (by index)
    const searchableIndexes = [cnIndex, pnIndex, processIndex, processCodeIndex, materialIndex]
      .filter(index => index !== -1);

    const results = data.map((row, index) => {
      // Find matches in searchable columns
      const isMatch = searchableIndexes.some(index =>
        row[index] && String(row[index]).toLowerCase().includes(searchPattern)
      );

      if (!isMatch) return null; // Skip if no search match

      // === ACCESS CONTROL FILTERING ===
      // Three role types:
      // 1. Workflow Users (Prepared/Checked/Approved): See ALL documents, ALL Process Codes
      // 2. Viewer: See ONLY approved, LIMITED Process Codes (by Allowed_Process_Codes)
      // 3. Guest: See ONLY approved, ALL Process Codes

      if (isWorkflowUser) {
        // Workflow users: NO restrictions
        // Can see all documents (any status) and all Process Codes
        // Skip filtering - allow everything

      } else if (isViewerRole) {
        // Viewer: Approved only + Limited Process Codes

        // 1. Check approved status
        const isApproved = (approvedByIndex !== -1) &&
          row[approvedByIndex] &&
          String(row[approvedByIndex]).trim() !== '';
        if (!isApproved) {
          return null; // Viewers can only see approved documents
        }

        // 2. Check Process Code restriction
        if (allowedProcessCodes && allowedProcessCodes.length > 0) {
          const processCode = String(row[processCodeIndex] || '').trim();
          if (!allowedProcessCodes.includes(processCode)) {
            return null; // Viewer doesn't have access to this Process Code
          }
        }

      } else if (isGuestRole) {
        // Guest: Approved only + All Process Codes

        // Check approved status only
        const isApproved = (approvedByIndex !== -1) &&
          row[approvedByIndex] &&
          String(row[approvedByIndex]).trim() !== '';
        if (!isApproved) {
          return null; // Guests can only see approved documents
        }
        // No Process Code restriction for Guests

      } else {
        // Unknown role - deny access
        return null;
      }

      // Convert row array back to object using headers
      let resultObj = {};
      headers.forEach((header, i) => resultObj[header] = row[i]);

      // [OPTIMIZED] Get categorization data directly from index
      const pn = resultObj.PN || '';
      if (String(pn).startsWith('2K')) resultObj.category = 'Inner PB Ring Parts';
      else if (String(pn).startsWith('3L')) resultObj.category = 'Outer PB Ring Parts';
      else resultObj.category = 'General Part';

      return resultObj;
    }).filter(item => item !== null);
    
    allResults = results;

    // Format dates
    allResults.forEach(item => {
      for (const key in item) {
        if (item[key] instanceof Date) {
          item[key] = Utilities.formatDate(item[key], "GMT+7", "yyyy-MM-dd");
        }
      }
    });

    // === REVISION FILTERING & SORTING ===

    // Group results by CN + Process_Code + Machine (for tripleKey sheets)
    // or CN + Process_Code + actual_table (for compositeKey sheets)
    const groups = {};
    allResults.forEach(item => {
      // Check if this sheet uses tripleKey (CN + Process_Code + Machine)
      const usesTripleKey = SHEETS_CONFIG.tripleKey && SHEETS_CONFIG.tripleKey.includes(item.actual_table);

      // For tripleKey sheets: use Machine to separate different setups
      // For other sheets: use actual_table (sheet name)
      const machineKey = usesTripleKey ? (item.Machine || item.actual_table) : item.actual_table;
      const key = `${item.CN}|${item.Process_Code || ''}|${machineKey}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    // Process each group
    let processedResults = [];
    for (const key in groups) {
      const group = groups[key];

      // Sort by Setup_Data_Sheet_REV (oldest first: NC → A → B → ... → Z → AA → ...)
      group.sort((a, b) => {
        const revA = String(a.Setup_Data_Sheet_REV || 'NC').toUpperCase();
        const revB = String(b.Setup_Data_Sheet_REV || 'NC').toUpperCase();

        // NC always comes first
        if (revA === 'NC' && revB !== 'NC') return -1;
        if (revA !== 'NC' && revB === 'NC') return 1;
        if (revA === 'NC' && revB === 'NC') return 0;

        // Sort by length first, then alphabetically
        if (revA.length !== revB.length) {
          return revA.length - revB.length;
        }
        return revA.localeCompare(revB);
      });

      // Mark latest revision
      const latestIndex = group.length - 1;
      group.forEach((item, index) => {
        item.isLatestRevision = (index === latestIndex);
      });

      // Filter based on user authorization
      if (userHasRoles) {
        // Authorized users: see all revisions
        processedResults = processedResults.concat(group);
      } else {
        // Guest users: only see latest revision
        processedResults.push(group[latestIndex]);
      }
    }

    // Final sort: by CN, then by REV (oldest first within each CN)
    processedResults.sort((a, b) => {
      const cnCompare = String(a.CN).localeCompare(String(b.CN));
      if (cnCompare !== 0) return cnCompare;

      const revA = String(a.REV || 'NC').toUpperCase();
      const revB = String(b.REV || 'NC').toUpperCase();

      if (revA === 'NC' && revB !== 'NC') return -1;
      if (revA !== 'NC' && revB === 'NC') return 1;
      if (revA === 'NC' && revB === 'NC') return 0;

      if (revA.length !== revB.length) {
        return revA.length - revB.length;
      }
      return revA.localeCompare(revB);
    });

    // [PHASE 1: LAZY LOAD] Only count tooling, don't load full data
    processedResults.forEach(item => {
      const toolCount = countToolingForSetup(
        item.actual_table,           // Sheet name
        item.CN,
        item.Process_Code,
        item.Machine,
        item.Setup_Data_Sheet_REV
      );
      item.toolCount = toolCount;
      // Don't load full tooling here - use loadToolingForResult() on demand
    });

    const searchResults = {
      success: true,
      data: processedResults,
      count: processedResults.length
    };

    // [PHASE 2: CACHING] Store results in cache
    cacheSearchResults(searchPattern, searchResults);

    return searchResults;
} catch (e) {
    return { success: false, error: `Search failed: ${e.message}` };
}
}

/**
 * Load tooling data for a specific result (on-demand)
 * Used for lazy loading - call this when user clicks "View Details"
 * @param {string} sheetName - Sheet name
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {Object} Tooling data
 */
function loadToolingForResult(sheetName, cn, processCode, machine, rev) {
  try {
    Logger.log(`[loadToolingForResult] Loading tooling for CN=${cn}, Sheet=${sheetName}`);

    const tooling = getToolingData(sheetName, cn, processCode, machine, rev);

    return {
      success: true,
      tooling: tooling,
      count: tooling.length
    };
  } catch (e) {
    Logger.log(`[loadToolingForResult] Error: ${e.message}`);
    return {
      success: false,
      error: e.message,
      tooling: []
    };
  }
}

/**
 * [NEW] Rebuilds the MasterSearchIndex sheet.
 * NOTE: Run this function manually once to create the sheet.
 * Then, set up a time-based trigger (e.g., hourly) to run this function
 * to keep the search index up-to-date.
 */
function updateMasterIndex() {
  Logger.log('Starting Master Search Index update...');
  let indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
  if (!indexSheet) {
    indexSheet = dataSs.insertSheet(MASTER_INDEX_SHEET);
    Logger.log(`Sheet '${MASTER_INDEX_SHEET}' created.`);
  }

  // Define the headers for the index
  // These are the only columns we search or display in the results
  const indexHeaders = [
    'CN', 'Setup_Data_Sheet_REV', 'PN', 'Process', 'Machine', 'Process_Code', 'Material',
    'Prepared_By', 'Prepared_Date',
    'Checked_By', 'Checked_Date',
    'Approved_By', 'Approved_Date',
    'actual_table' // This is crucial for linking back
  ];
  
  // Clear old data (keep header row)
  indexSheet.clear();
  indexSheet.getRange(1, 1, 1, indexHeaders.length).setValues([indexHeaders]);
  
  let rowsToAppend = [];

  try {
    // Loop through all configured sheets (this is the slow part, but it runs offline)
    for (const type in SHEETS_CONFIG.search) {
      for (const sheetName of SHEETS_CONFIG.search[type]) {
        const sheet = dataSs.getSheetByName(sheetName);
if (!sheet) {
          Logger.log(`Skipping index for missing sheet: ${sheetName}`);
          continue;
        }
        
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) continue; // Skip empty sheets
        
        const headers = data.shift().map(h => String(h).trim());
        
        // Create a map of required headers to their column index
        const headerMap = {};
        indexHeaders.forEach(header => {
          headerMap[header] = headers.indexOf(header);
        });

        // Process each row
        data.forEach(row => {
          let newIndexRow = [];

          // Get CN, Process_Code, Machine, REV for tooling count
          const cn = row[headerMap['CN']] || '';
          const processCode = row[headerMap['Process_Code']] || '';
          const machine = row[headerMap['Machine']] || '';
          const rev = row[headerMap['Setup_Data_Sheet_REV']] || 'NC';

          indexHeaders.forEach(header => {
            if (header === 'actual_table') {
              newIndexRow.push(sheetName); // Add the sheet name
            } else if (header === 'Machine') {
              // Use Machine column from data sheet for display (or sheetName as fallback)
              const colIndex = headerMap[header];
              const machineValue = (colIndex !== -1 && row[colIndex]) ? row[colIndex] : sheetName;
              newIndexRow.push(machineValue);
            } else {
              const colIndex = headerMap[header];
              newIndexRow.push(colIndex !== -1 ? row[colIndex] : ''); // Get data or empty string
            }
          });

          rowsToAppend.push(newIndexRow);
        });
      }
    }
    
    // Write all data to the index sheet in one go
    if (rowsToAppend.length > 0) {
      indexSheet.getRange(2, 1, rowsToAppend.length, indexHeaders.length)
        .setValues(rowsToAppend);
      Logger.log(`Master Search Index updated with ${rowsToAppend.length} rows.`);
    } else {
      Logger.log('No data found to index.');
    }
    
  } catch (e) {
    Logger.log(`Failed to update MasterSearchIndex: ${e.message}`);
    throw e;
  }
}

/**
 * Update or insert a single row in MasterSearchIndex (for real-time updates)
 * @param {string} sheetName - Source sheet name
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} rev - Revision number
 * @param {string} machine - Machine name (optional, for triple key sheets)
 * @returns {Object} Success status
 */
function updateMasterIndexRow(sheetName, cn, processCode, rev, machine, data) {
  try {
    const indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
    if (!indexSheet) {
      Logger.log('MasterSearchIndex sheet not found. Run updateMasterIndex() first.');
      return { success: false, error: 'MasterSearchIndex not initialized' };
    }

    // Define index headers (must match updateMasterIndex)
    const indexHeaders = [
      'CN', 'Setup_Data_Sheet_REV', 'PN', 'Process', 'Machine', 'Process_Code', 'Material',
      'Prepared_By', 'Prepared_Date',
      'Checked_By', 'Checked_Date',
      'Approved_By', 'Approved_Date',
      'actual_table'
    ];

    // FIX: Use the data object passed in as an argument instead of re-reading
    if (!data) {
      return { success: false, error: 'No data provided to updateMasterIndexRow' };
    }
    const rowData = data;

    // Build new index row
    const newIndexRow = indexHeaders.map(header => {
      if (header === 'actual_table') {
        return sheetName;
      } else if (header === 'Machine') {
        // Use Machine column from data for display (or sheetName as fallback)
        return rowData[header] || sheetName;
      } else {
        return rowData[header] || '';
      }
    });

    // Find existing row in MasterSearchIndex
    const indexData = indexSheet.getDataRange().getValues();
    const indexHeaderRow = indexData[0].map(h => String(h).trim());

    const cnCol = indexHeaderRow.indexOf('CN') + 1;
    const pcCol = indexHeaderRow.indexOf('Process_Code') + 1;
    const revCol = indexHeaderRow.indexOf('Setup_Data_Sheet_REV') + 1;
    const tableCol = indexHeaderRow.indexOf('actual_table') + 1;
    const machineCol = indexHeaderRow.indexOf('Machine') + 1;

    const usesTripleKey = SHEETS_CONFIG.tripleKey && SHEETS_CONFIG.tripleKey.includes(sheetName);
    let foundRow = -1;

    // Search for matching row
    // Triple Key: CN + Process_Code + Machine + Setup_Data_Sheet_REV + actual_table
    // Composite Key: CN + Process_Code + Setup_Data_Sheet_REV + actual_table
    for (let i = 1; i < indexData.length; i++) {
      const row = indexData[i];

      let matchFound = false;

      if (usesTripleKey && machine && machineCol > 0) {
        // Triple key match
        matchFound = String(row[cnCol - 1]) === String(cn) &&
                     String(row[pcCol - 1]) === String(processCode) &&
                     String(row[machineCol - 1]) === String(machine) &&
                     String(row[revCol - 1]) === String(rev) &&
                     String(row[tableCol - 1]) === String(sheetName);
      } else {
        // Composite key or single key match
        matchFound = String(row[cnCol - 1]) === String(cn) &&
                     String(row[pcCol - 1]) === String(processCode) &&
                     String(row[revCol - 1]) === String(rev) &&
                     String(row[tableCol - 1]) === String(sheetName);
      }

      if (matchFound) {
        foundRow = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }

    if (foundRow !== -1) {
      // Update existing row
      indexSheet.getRange(foundRow, 1, 1, indexHeaders.length).setValues([newIndexRow]);
      Logger.log(`Updated MasterSearchIndex row ${foundRow} for CN=${cn}, REV=${rev}`);
    } else {
      // Append new row
      indexSheet.appendRow(newIndexRow);
      Logger.log(`Inserted new MasterSearchIndex row for CN=${cn}, REV=${rev}`);
    }

    return { success: true };

  } catch (e) {
    Logger.log(`updateMasterIndexRow Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Reset workflow status in MasterSearchIndex (for rejection)
 * Clears Prepared and Checked fields while keeping the row
 * @param {string} sheetName - Source sheet name
 * @param {string} cn - Control Number
 * @param {string} processCode - Process Code
 * @param {string} rev - Revision number (required to reset only specific revision)
 * @param {string} machine - Machine name (optional, for triple key sheets)
 * @returns {Object} Success status
 */
function resetMasterIndexRow(sheetName, cn, processCode, rev, machine) {
  try {
    const indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
    if (!indexSheet) {
      Logger.log('MasterSearchIndex sheet not found.');
      return { success: false, error: 'MasterSearchIndex not initialized' };
    }

    const indexData = indexSheet.getDataRange().getValues();
    const indexHeaders = indexData[0].map(h => String(h).trim());

    const cnCol = indexHeaders.indexOf('CN') + 1;
    const pcCol = indexHeaders.indexOf('Process_Code') + 1;
    const revCol = indexHeaders.indexOf('Setup_Data_Sheet_REV') + 1;
    const tableCol = indexHeaders.indexOf('actual_table') + 1;
    const machineCol = indexHeaders.indexOf('Machine') + 1;
    const prepByCol = indexHeaders.indexOf('Prepared_By') + 1;
    const prepDateCol = indexHeaders.indexOf('Prepared_Date') + 1;
    const chkByCol = indexHeaders.indexOf('Checked_By') + 1;
    const chkDateCol = indexHeaders.indexOf('Checked_Date') + 1;

    const usesTripleKey = SHEETS_CONFIG.tripleKey && SHEETS_CONFIG.tripleKey.includes(sheetName);

    // Find matching row with specific revision
    let rowFound = false;
    for (let i = 1; i < indexData.length; i++) {
      const row = indexData[i];
      const revMatch = rev ? (String(row[revCol - 1]).toUpperCase() === String(rev).toUpperCase()) : true;

      let matchFound = false;

      if (usesTripleKey && machine && machineCol > 0) {
        // Triple key match
        matchFound = String(row[cnCol - 1]) === String(cn) &&
                     String(row[pcCol - 1]) === String(processCode) &&
                     String(row[machineCol - 1]) === String(machine) &&
                     String(row[tableCol - 1]) === String(sheetName) &&
                     revMatch;
      } else {
        // Composite key or single key match
        matchFound = String(row[cnCol - 1]) === String(cn) &&
                     String(row[pcCol - 1]) === String(processCode) &&
                     String(row[tableCol - 1]) === String(sheetName) &&
                     revMatch;
      }

      if (matchFound) {
        // Reset workflow stamps (Prepared and Checked only, keep Approved)
        if (prepByCol > 0) indexSheet.getRange(i + 1, prepByCol).setValue('');
        if (prepDateCol > 0) indexSheet.getRange(i + 1, prepDateCol).setValue('');
        if (chkByCol > 0) indexSheet.getRange(i + 1, chkByCol).setValue('');
        if (chkDateCol > 0) indexSheet.getRange(i + 1, chkDateCol).setValue('');

        Logger.log(`Reset MasterSearchIndex row ${i + 1} for CN=${cn}, ProcessCode=${processCode}, Machine=${machine}, REV=${rev}`);
        rowFound = true;
      }
    }

    if (!rowFound && rev) {
      Logger.log(`Warning: No row found to reset for CN=${cn}, ProcessCode=${processCode}, REV=${rev}`);
    }

    return { success: true };

  } catch (e) {
    Logger.log(`resetMasterIndexRow Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get data by CN and Process Code using TextFinder for performance
 * @param {string} sheetName - Name of the sheet
 * @param {string} cn - Control Number
 * @param {string} process_code - Process Code
 * @param {string} rev - Revision (optional)
 * @param {string} machine - Machine name (optional, for triple key sheets)
 * @returns {Object} Success status and data
 */
function getDataByCnAndProcessCode(sheetName, cn, process_code, rev, machine) {
  try {
    Logger.log(`[getDataByCnAndProcessCode] Called with: sheetName=${sheetName}, CN=${cn}, ProcessCode=${process_code}, REV=${rev}, Machine=${machine}`);

    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, error: `Data sheet '${sheetName}' not found.` };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h).trim());
    const cnIndex = headers.indexOf('CN');
    const processCodeIndex = headers.indexOf('Process_Code');
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');
    const machineIndex = headers.indexOf('Machine');

    Logger.log(`[getDataByCnAndProcessCode] Column indices: CN=${cnIndex}, ProcessCode=${processCodeIndex}, REV=${revIndex}, Machine=${machineIndex}`);

    if (cnIndex === -1) {
      return { success: false, error: `'CN' column not found in ${sheetName}.` };
    }

    const usesCompositeKey = SHEETS_CONFIG.compositeKey.includes(sheetName);
    const usesTripleKey = SHEETS_CONFIG.tripleKey && SHEETS_CONFIG.tripleKey.includes(sheetName);
    let foundRowIndex = -1;
if (sheet.getLastRow() <= 1) {
      const errorMsg = 'No data rows found in ' + sheetName + ' to search.';
return { success: false, error: errorMsg };
    }
    
    const numDataRows = sheet.getLastRow() - 1;
const cnColumnRange = sheet.getRange(2, cnIndex + 1, numDataRows, 1);

    // Search using triple key (CN + Process_Code + Machine) if required
    // Machine is stored in a column within the sheet (not identified by sheetName)
    if (usesTripleKey && process_code && machine) {
      if (processCodeIndex === -1) {
        return {
          success: false,
          error: `Sheet '${sheetName}' uses triple key but 'Process_Code' column not found.`
        };
      }

      if (machineIndex === -1) {
        return {
          success: false,
          error: `Sheet '${sheetName}' uses triple key but 'Machine' column not found.`
        };
      }

      const foundCnCells = cnColumnRange.createTextFinder(String(cn))
        .matchEntireCell(true)
        .findAll();
      if (foundCnCells.length > 0) {
        for (const cell of foundCnCells) {
          const row = cell.getRow();
          const processCodeValue = sheet.getRange(row, processCodeIndex + 1).getValue();
          const machineValue = sheet.getRange(row, machineIndex + 1).getValue();
          const currentRevValue = revIndex !== -1 ? sheet.getRange(row, revIndex + 1).getValue() : 'N/A';
          Logger.log(`[getDataByCnAndProcessCode] Checking row ${row}: ProcessCode=${processCodeValue}, Machine=${machineValue}, REV=${currentRevValue}`);

          // Check both Process_Code and Machine match
          if (String(processCodeValue) === String(process_code) && String(machineValue) === String(machine)) {
            // Check REV if provided
            if (rev && revIndex !== -1) {
              const revValue = sheet.getRange(row, revIndex + 1).getValue();
              Logger.log(`[getDataByCnAndProcessCode] REV filter enabled: searching for ${rev}, found ${revValue}`);
              if (String(revValue).toUpperCase() === String(rev).toUpperCase()) {
                Logger.log(`[getDataByCnAndProcessCode] ✓ TRIPLE KEY MATCH FOUND at row ${row}`);
                foundRowIndex = row;
                break;
              } else {
                Logger.log(`[getDataByCnAndProcessCode] ✗ REV mismatch, continuing search...`);
              }
            } else {
              // No REV filter, take first match
              Logger.log(`[getDataByCnAndProcessCode] No REV filter, taking first triple key match at row ${row}`);
              foundRowIndex = row;
              break;
            }
          }
        }
      }

      // [FALLBACK] If triple key not found, try composite key (CN + Process_Code + REV only)
      if (foundRowIndex === -1) {
        Logger.log(`[getDataByCnAndProcessCode] Triple key match failed (machine mismatch), falling back to composite key...`);
      }
    }

    // Search using composite key (CN + Process_Code) if required
    // Also used as fallback when triple key fails
    if (foundRowIndex === -1 && usesCompositeKey && process_code) {
      if (processCodeIndex === -1) {
        return {
          success: false,
          error: `Sheet '${sheetName}' uses composite key but 'Process_Code' column not found.`
        };
      }

      const foundCnCells = cnColumnRange.createTextFinder(String(cn))
        .matchEntireCell(true)
        .findAll();
      if (foundCnCells.length > 0) {
        for (const cell of foundCnCells) {
          const row = cell.getRow();
          const processCodeValue = sheet.getRange(row, processCodeIndex + 1).getValue();
          const currentRevValue = revIndex !== -1 ? sheet.getRange(row, revIndex + 1).getValue() : 'N/A';
          Logger.log(`[getDataByCnAndProcessCode] Checking row ${row}: ProcessCode=${processCodeValue}, REV=${currentRevValue}`);

          if (String(processCodeValue) === String(process_code)) {
            // Check REV if provided
            if (rev && revIndex !== -1) {
              const revValue = sheet.getRange(row, revIndex + 1).getValue();
              Logger.log(`[getDataByCnAndProcessCode] REV filter enabled: searching for ${rev}, found ${revValue}`);
              if (String(revValue).toUpperCase() === String(rev).toUpperCase()) {
                Logger.log(`[getDataByCnAndProcessCode] ✓ COMPOSITE KEY MATCH FOUND at row ${row}`);
                foundRowIndex = row;
                break;
              } else {
                Logger.log(`[getDataByCnAndProcessCode] ✗ REV mismatch, continuing search...`);
              }
            } else {
              // No REV filter, take first match
              Logger.log(`[getDataByCnAndProcessCode] No REV filter, taking first composite key match at row ${row}`);
              foundRowIndex = row;
              break;
            }
          }
        }
      }
    } else if (foundRowIndex === -1) {
      // Simple search by CN only (last resort when no composite/triple key match)
      const foundCells = cnColumnRange.createTextFinder(String(cn))
        .matchEntireCell(true)
        .findAll();

      if (foundCells.length > 0) {
        // Check REV if provided
        if (rev && revIndex !== -1) {
          for (const cell of foundCells) {
            const row = cell.getRow();
            const revValue = sheet.getRange(row, revIndex + 1).getValue();
            if (String(revValue).toUpperCase() === String(rev).toUpperCase()) {
              foundRowIndex = row;
              break;
            }
          }
        } else {
          // No REV filter, take first match
          foundRowIndex = foundCells[0].getRow();
        }
      }
    }

    if (foundRowIndex !== -1) {
      const foundRowData = sheet.getRange(foundRowIndex, 1, 1, headers.length).getValues()[0];
      let resultObj = {};
      headers.forEach((header, i) => resultObj[header] = foundRowData[i]);

      // [NEW] Load tooling data from Grinding_Tooling sheet
      const toolingData = getToolingData(sheetName, cn, process_code, machine, rev);

      return {
        success: true,
        data: resultObj,
        tooling: toolingData,  // Added tooling array
        rowIndex: foundRowIndex
      };
    } else {
      const errorMsg = 'No data found for CN: ' + cn +
        (process_code ? ' and Process Code: ' + process_code : '');
      return { success: false, error: errorMsg };
    }
  } catch (e) {
    Logger.log(`Error in getDataByCnAndProcessCode: ${e.message}`);
return { success: false, error: e.message };
  }
}
// New versions are defined above (lines 263-397)
// [REMOVED] Old duplicate functions updateMasterIndexRow() and resetMasterIndexRow()