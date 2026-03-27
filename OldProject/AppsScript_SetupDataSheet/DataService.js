// ================================================================= //
//                      DATA OPERATIONS (CRUD)                       //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Data Service Module
 * Handles all CRUD operations and data management
 */

/**
 * Save new data to specified sheet
 * [UPDATED] Now handles separated tooling data
 * @param {Object} formData - Form data object
 * @returns {Object} Success status and message
 */
function saveData(formData) {
  try {
    const sheetName = formData.sheetName;
    if (!sheetName) {
      throw new Error("sheetName is missing from form data.");
    }

    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found.`);
    }

    // [NEW] Extract tooling data from form data
    const extracted = extractToolingFromFormData(formData, sheetName);
    const setupData = extracted.setupData;
    const toolingData = extracted.toolingData;

    Logger.log(`[saveData] Separated into ${Object.keys(setupData).length} setup fields and ${toolingData.length} tools`);

    // Map setup data to sheet columns (tooling fields excluded)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => setupData[header] || '');

    // Append new row with text formatting
    const newRowIndex = sheet.getLastRow() + 1;
    const newRange = sheet.getRange(newRowIndex, 1, 1, headers.length);
    newRange.setNumberFormat('@'); // Set text format
    newRange.setValues([newRow]);

    // [NEW] Save tooling data to appropriate tooling sheet
    const cn = setupData.CN || '';
    const processCode = setupData.Process_Code || '';
    const rev = setupData.Setup_Data_Sheet_REV || 'NC';
    const machine = setupData.Machine || null;

    if (toolingData.length > 0) {
      const toolingResult = saveToolingData(sheetName, cn, processCode, machine, rev, toolingData);
      if (!toolingResult.success) {
        Logger.log(`Warning: Failed to save tooling data: ${toolingResult.error}`);
        // Don't fail the whole operation, but log the error
      } else {
        Logger.log(`Successfully saved ${toolingData.length} tools`);
      }
    }

    // [AUTO-UPDATE] Update MasterSearchIndex for new row
    try {
      // FIX: Construct data object and pass to updater to prevent race condition
      const newDataObject = {};
      headers.forEach((header, index) => {
        newDataObject[header] = newRow[index];
      });
      updateMasterIndexRow(sheetName, cn, processCode, rev, machine, newDataObject);
      Logger.log(`MasterSearchIndex updated for CN: ${cn}, REV: ${rev}`);
    } catch (indexError) {
      Logger.log(`Failed to update MasterSearchIndex: ${indexError.message}`);
      // Don't fail the whole save operation if index update fails
    }

    // [PHASE 2: CACHE INVALIDATION] Clear cache for this CN
    try {
      invalidateCacheForCN(cn);
      Logger.log(`Cache invalidated for CN: ${cn}`);
    } catch (cacheError) {
      Logger.log(`Failed to invalidate cache: ${cacheError.message}`);
      // Don't fail the whole save operation if cache invalidation fails
    }

    // [PDF CACHE] Invalidate cached PDFs for this CN
    try {
      invalidatePdfCacheForCN(cn);
    } catch (pdfCacheError) {
      Logger.log(`Failed to invalidate PDF cache: ${pdfCacheError.message}`);
    }

    return {
      success: true,
      message: `Data saved successfully to ${sheetName}${toolingData.length > 0 ? ` with ${toolingData.length} tools` : ''}.`
    };
  } catch (e) {
    Logger.log(`saveData Error: ${e.message}`);
    Logger.log(e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Update existing data in specified sheet
 * [UPDATED] Now handles separated tooling data
 * Supports both regular update and save-as-new-revision
 * @param {Object} formData - Form data object
 * @returns {Object} Success status and message
 */
function updateData(formData) {
  try {
    // Check if this is a "Save as New Revision" request
    if (formData.saveAsNewRevision === true || formData.saveAsNewRevision === 'true') {
      return saveAsNewRevision(formData);
    }

    // Regular update logic
    const sheetName = formData.sheetName;
    if (!sheetName) throw new Error("sheetName is missing.");

    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet '${sheetName}' not found.`);

    // Find existing row by CN, Process Code, and Machine
    const machine = formData.Machine || null;
    const findResult = getDataByCnAndProcessCode(sheetName, formData.CN, formData.Process_Code, null, machine);
    if (!findResult.success) {
      throw new Error(`Cannot find row to update for CN: ${formData.CN}`);
    }

    const rowIndex = findResult.rowIndex;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // [NEW] Extract tooling data from form data
    const extracted = extractToolingFromFormData(formData, sheetName);
    const setupData = extracted.setupData;
    const toolingData = extracted.toolingData;

    Logger.log(`[updateData] Separated into ${Object.keys(setupData).length} setup fields and ${toolingData.length} tools`);

    // Build updated row preserving existing data for unchanged fields (setup data only)
    const updatedRow = headers.map(header => {
      if (setupData.hasOwnProperty(header)) {
        return setupData[header]; // Use new value from form
      } else {
        return findResult.data[header] || ''; // Keep existing value
      }
    });

    // Update the row with text formatting
    const rangeToUpdate = sheet.getRange(rowIndex, 1, 1, headers.length);
    rangeToUpdate.setNumberFormat('@');
    rangeToUpdate.setValues([updatedRow]);

    // [NEW] Update tooling data (delete old, save new)
    const cn = setupData.CN || formData.CN || '';
    const processCode = setupData.Process_Code || formData.Process_Code || '';
    const rev = findResult.data.Setup_Data_Sheet_REV || 'NC';

    // Save tooling data (this function deletes old data first)
    if (SHEETS_WITH_TOOLING.includes(sheetName)) {
      const toolingResult = saveToolingData(sheetName, cn, processCode, machine, rev, toolingData);
      if (!toolingResult.success) {
        Logger.log(`Warning: Failed to update tooling data: ${toolingResult.error}`);
        // Don't fail the whole operation
      } else {
        Logger.log(`Successfully updated tooling: ${toolingData.length} tools`);
      }
    }

    // [AUTO-UPDATE] Update MasterSearchIndex for updated row
    try {
      // FIX: Construct data object and pass to updater to prevent race condition
      const updatedDataObject = {};
      headers.forEach((header, index) => {
        updatedDataObject[header] = updatedRow[index];
      });
      updateMasterIndexRow(sheetName, cn, processCode, rev, machine, updatedDataObject);
      Logger.log(`MasterSearchIndex updated for CN: ${cn}, REV: ${rev}`);
    } catch (indexError) {
      Logger.log(`Failed to update MasterSearchIndex: ${indexError.message}`);
      // Don't fail the whole update operation if index update fails
    }

    // [PHASE 2: CACHE INVALIDATION] Clear cache for this CN
    try {
      invalidateCacheForCN(cn);
      Logger.log(`Cache invalidated for CN: ${cn}`);
    } catch (cacheError) {
      Logger.log(`Failed to invalidate cache: ${cacheError.message}`);
      // Don't fail the whole update operation if cache invalidation fails
    }

    // [PDF CACHE] Invalidate cached PDFs for this CN
    try {
      invalidatePdfCacheForCN(cn);
    } catch (pdfCacheError) {
      Logger.log(`Failed to invalidate PDF cache: ${pdfCacheError.message}`);
    }

    return {
      success: true,
      message: `Data updated successfully in ${sheetName}${toolingData.length > 0 ? ` with ${toolingData.length} tools` : ''}.`
    };
  } catch (e) {
    Logger.log(`updateData Error: ${e.message}`);
    Logger.log(e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Save data as a new revision (creates new row with incremented REV)
 * [UPDATED] Now handles separated tooling data
 * @param {Object} formData - Form data object with ECN information
 * @returns {Object} Success status and message
 */
function saveAsNewRevision(formData) {
  try {
    const sheetName = formData.sheetName;
    const cn = formData.CN;
    const processCode = formData.Process_Code;

    // Validate required ECN fields
    if (!formData.ecnNo || !formData.ecnDate || !formData.ecnDescription) {
      throw new Error('ECN Number, Date, and Description are required for new revisions.');
    }

    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet '${sheetName}' not found.`);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');

    // Check if Setup_Data_Sheet_REV column exists
    if (revIndex === -1) {
      throw new Error('Setup_Data_Sheet_REV column not found in sheet. Please add Setup_Data_Sheet_REV column first.');
    }

    // Get next revision number (with machine for triple key sheets)
    const machine = formData.Machine || null;
    const nextRev = getNextRevision(sheetName, cn, processCode, machine);

    // Get current user
    const user = getUserInfo();

    // [NEW] Extract tooling data from form data
    const extracted = extractToolingFromFormData(formData, sheetName);
    const setupData = extracted.setupData;
    const toolingData = extracted.toolingData;

    Logger.log(`[saveAsNewRevision] Separated into ${Object.keys(setupData).length} setup fields and ${toolingData.length} tools`);
    Logger.log(`[saveAsNewRevision] ECN Data: NO=${formData.ecnNo}, Date=${formData.ecnDate}, Desc=${formData.ecnDescription}`);

    // Build new row with updated data and new Setup_Data_Sheet_REV (setup data only)
    const newRow = headers.map(header => {
      if (header === 'Setup_Data_Sheet_REV') {
        return nextRev;
      } else if (header === 'Prepared_By' || header === 'Checked_By' || header === 'Approved_By') {
        // Reset workflow stamps for new revision
        return '';
      } else if (header === 'Prepared_Date' || header === 'Checked_Date' || header === 'Approved_Date') {
        // Reset workflow dates for new revision
        return '';
      }
      // [REMOVED] ECN data now stored ONLY in RevisionHistory (not in main sheet)
      // This eliminates data redundancy and maintains single source of truth
      else if (setupData.hasOwnProperty(header)) {
        // Use updated value from form
        return setupData[header];
      } else {
        // Keep existing value (from previous revision)
        return '';
      }
    });

    // Get existing data to copy unchanged fields
    const findResult = getDataByCnAndProcessCode(sheetName, cn, processCode, null, machine);
    if (findResult.success) {
      // [UPDATED] Don't copy workflow fields from previous revision
      // ECN fields are stored in RevisionHistory only, not in main sheet
      const excludeFields = ['Prepared_By', 'Checked_By', 'Approved_By',
                             'Prepared_Date', 'Checked_Date', 'Approved_Date'];

      headers.forEach((header, index) => {
        if (newRow[index] === '' && !excludeFields.includes(header)) {
          newRow[index] = findResult.data[header] || '';
        }
      });
    }

    // Append new row with text formatting
    const newRowIndex = sheet.getLastRow() + 1;
    const newRange = sheet.getRange(newRowIndex, 1, 1, headers.length);
    newRange.setNumberFormat('@');
    newRange.setValues([newRow]);

    // [NEW] Handle tooling data for new revision
    if (SHEETS_WITH_TOOLING.includes(sheetName)) {
      let toolingToSave = toolingData;

      // If no tooling data in form, copy from previous revision
      if (toolingToSave.length === 0 && findResult.success) {
        Logger.log(`[saveAsNewRevision] No tooling in form, copying from previous revision`);
        const oldRev = findResult.data.Setup_Data_Sheet_REV || 'NC';

        // Get tooling from previous revision
        const previousTooling = getToolingData(sheetName, cn, processCode, machine, oldRev);
        if (previousTooling && previousTooling.length > 0) {
          toolingToSave = previousTooling;
          Logger.log(`[saveAsNewRevision] Copied ${previousTooling.length} tools from revision ${oldRev}`);
        }
      }

      // Save tooling data with new revision number
      if (toolingToSave.length > 0) {
        const toolingResult = saveToolingData(sheetName, cn, processCode, machine, nextRev, toolingToSave);
        if (!toolingResult.success) {
          Logger.log(`Warning: Failed to save tooling for new revision: ${toolingResult.error}`);
        } else {
          Logger.log(`Successfully saved ${toolingToSave.length} tools for revision ${nextRev}`);
        }
      }
    }

    // Log revision history
    logRevisionHistory(
      cn,
      nextRev,
      formData.ecnNo,
      formData.ecnDate,
      formData.ecnDescription,
      formData.ecnRemark || '',
      sheetName,
      processCode,
      user.email
    );

    // [AUTO-UPDATE] Update MasterSearchIndex with new revision row
    try {
      // FIX: Construct data object and pass to updater to prevent race condition
      const newRevisionObject = {};
      headers.forEach((header, index) => {
        newRevisionObject[header] = newRow[index];
      });
      updateMasterIndexRow(sheetName, cn, processCode, nextRev, machine, newRevisionObject);
      Logger.log(`MasterSearchIndex updated for CN: ${cn}, REV: ${nextRev}`);
    } catch (indexError) {
      Logger.log(`Failed to update MasterSearchIndex: ${indexError.message}`);
      // Don't fail the whole operation if index update fails
    }

    // [PHASE 2: CACHE INVALIDATION] Clear cache for this CN
    try {
      invalidateCacheForCN(cn);
      Logger.log(`Cache invalidated for CN: ${cn}`);
    } catch (cacheError) {
      Logger.log(`Failed to invalidate cache: ${cacheError.message}`);
      // Don't fail the whole operation if cache invalidation fails
    }

    // [PDF CACHE] Invalidate cached PDFs for this CN
    try {
      invalidatePdfCacheForCN(cn);
    } catch (pdfCacheError) {
      Logger.log(`Failed to invalidate PDF cache: ${pdfCacheError.message}`);
    }

    Logger.log(`New revision created: CN ${cn}, REV ${nextRev}`);

    return {
      success: true,
      message: `New revision ${nextRev} created successfully for CN ${cn}.`,
      newRevision: nextRev
    };

  } catch (e) {
    Logger.log(`saveAsNewRevision Error: ${e.message}`);
    Logger.log(e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Get existing data for editing
 * [UPDATED] Now uses getFormDataForEdit() to include tooling data in flat format
 * @param {string} sheetName - Name of the sheet
 * @param {string} cn - Control Number
 * @param {string} process_code - Process Code
 * @param {string} rev - Revision number (optional)
 * @returns {Object} Success status and data object
 */
function getExistingData(sheetName, cn, process_code, rev) {
  try {
    // Use new getFormDataForEdit() which combines main data + tooling data
    const result = getFormDataForEdit(sheetName, cn, process_code, rev, null);

    if (result.success) {
      // Format dates for display
      for (const key in result.data) {
        if (result.data[key] instanceof Date) {
          result.data[key] = Utilities.formatDate(result.data[key], "GMT+7", "yyyy-MM-dd");
        }
      }
    }
    return result;
  } catch (e) {
    Logger.log(`getExistingData Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get headers for a specific sheet (excluding system columns)
 * [UPDATED] Now uses getFormHeaders() to include tooling fields from separated sheets
 * @param {string} sheetName - Name of the sheet
 * @returns {Object} Success status and headers array
 */
function getTemplateHeaders(sheetName) {
  try {
    // Use new getFormHeaders() which combines main sheet + tooling sheet headers
    // Default mode is 'edit' for backward compatibility
    return getFormHeaders(sheetName);
  } catch (e) {
    Logger.log(`getTemplateHeaders Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get template headers for Add Form (main fields only, no tooling)
 * Used by add-data.html to show only main fields
 * Tooling will be added via interactive modal
 *
 * @param {string} sheetName - Sheet name
 * @returns {Object} Success status and main headers only
 */
function getTemplateHeadersForAdd(sheetName) {
  try {
    // Use getFormHeaders() with mode='add' to get main headers only
    return getFormHeaders(sheetName, { mode: 'add' });
  } catch (e) {
    Logger.log(`getTemplateHeadersForAdd Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get template headers for Edit Form (with dynamic tooling count)
 * Used by edit-data.html to show only actual tooling fields
 *
 * @param {string} sheetName - Sheet name
 * @param {string} cn - Customer Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {Object} Success status and headers array with actual tooling count
 */
function getTemplateHeadersForEdit(sheetName, cn, processCode, machine, rev) {
  try {
    // Use getFormHeaders() with mode='edit' and actual data parameters
    return getFormHeaders(sheetName, {
      mode: 'edit',
      cn: cn,
      processCode: processCode,
      machine: machine,
      rev: rev
    });
  } catch (e) {
    Logger.log(`getTemplateHeadersForEdit Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Check and initialize Setup_Data_Sheet_REV column
 * @param {string} sheetName - Name of the sheet
 * @returns {Object} Success status
 */
function addRevColumnToSheet(sheetName) {
  try {
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found.`);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const revIndex = headers.indexOf('Setup_Data_Sheet_REV');

    // If Setup_Data_Sheet_REV column already exists, just check if values need initialization
    if (revIndex !== -1) {
      // Check if there are empty values and fill with 'NC'
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const dataRange = sheet.getRange(2, revIndex + 1, lastRow - 1, 1);
        const values = dataRange.getValues();
        let hasEmpty = false;

        const updatedValues = values.map(row => {
          if (!row[0] || String(row[0]).trim() === '') {
            hasEmpty = true;
            return ['NC'];
          }
          return row;
        });

        if (hasEmpty) {
          dataRange.setValues(updatedValues);
          dataRange.setNumberFormat('@'); // Text format
          Logger.log(`Initialized empty Setup_Data_Sheet_REV values in ${sheetName}`);
        }
      }

      return { success: true, message: `Setup_Data_Sheet_REV column already exists in ${sheetName}.` };
    }

    // If column doesn't exist, log warning (should already exist in your system)
    Logger.log(`WARNING: Setup_Data_Sheet_REV column not found in ${sheetName}. Please add it manually.`);
    return { success: false, error: `Setup_Data_Sheet_REV column not found in ${sheetName}.` };

  } catch (e) {
    Logger.log(`addRevColumnToSheet Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Add REV column to all data sheets (auto-detect, exclude system sheets)
 * @returns {Object} Summary of operations
 */
function initializeRevisionSystem() {
  try {
    // Get all sheets
    const allSheets = dataSs.getSheets();

    // System sheets to exclude
    const excludeSheets = [
      'AuthorizedUsers',
      'MasterSearchIndex',
      'AssignmentLog',
      'RejectionLog',
      'RevisionHistory'
    ];

    // Filter to get only data sheets
    const dataSheets = allSheets
      .map(s => s.getName())
      .filter(name => !excludeSheets.includes(name));

    Logger.log(`Found ${dataSheets.length} data sheets to process`);

    const results = [];

    // Setup RevisionHistory sheet first
    const setupResult = setupRevisionHistorySheet();
    results.push({ sheet: 'RevisionHistory', result: setupResult });

    // Add REV column to each data sheet
    dataSheets.forEach(sheetName => {
      Logger.log(`Processing sheet: ${sheetName}`);
      const result = addRevColumnToSheet(sheetName);
      results.push({ sheet: sheetName, result: result });
    });

    return {
      success: true,
      message: `Revision system initialized. Processed ${dataSheets.length} sheets.`,
      results: results
    };

  } catch (e) {
    Logger.log(`initializeRevisionSystem Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ================================================================= //
//                      AUTOCOMPLETE SYSTEM                         //
// ================================================================= //

/**
 * Get autocomplete suggestions for a field based on existing data
 * Searches through sheet data and returns distinct values that match the search term
 *
 * @param {string} sheetName - Main sheet name or tooling sheet name
 * @param {string} fieldName - Field name to get suggestions for
 * @param {string} searchTerm - Search term for filtering (optional, case-insensitive)
 * @param {number} limit - Maximum number of results (default 10)
 * @returns {Object} { success: boolean, suggestions: Array<string> }
 */
function getFieldSuggestions(sheetName, fieldName, searchTerm = '', limit = 10) {
  try {
    // Validate inputs
    if (!sheetName || !fieldName) {
      return { success: false, error: 'sheetName and fieldName are required' };
    }

    // Check if this is a tooling field request
    // Tooling fields for grinding: tooling_no, maker
    // Tooling fields for turning: Tool_Name, Insert_Info, Insert_I, Insert_E, etc.
    const grindingToolingFields = ['tooling_no', 'maker', 'Tooling_No', 'Maker'];
    const turningToolingFields = [
      'Tool_Name', 'Tool_Detail', 'Insert_Info', 'Insert_I', 'Insert_E', 'Insert_Maker',
      'Holder_Info', 'Holder_Maker', 'Hand', 'Overhang', 'H_Width',
      'Rotation', 'F', 'AP', 'Nose_R', 'Usaged'
    ];

    let targetSheet;
    let targetFieldName = fieldName;

    // Determine if we need to search in tooling sheets
    if (grindingToolingFields.includes(fieldName)) {
      // Search in Grinding_Tooling sheet
      targetSheet = dataSs.getSheetByName('Grinding_Tooling');
      // Map lowercase field names to proper case
      if (fieldName === 'tooling_no') targetFieldName = 'Tooling_No';
      if (fieldName === 'maker') targetFieldName = 'Maker';
    } else if (turningToolingFields.includes(fieldName)) {
      // Search in Turning_Tooling sheet
      targetSheet = dataSs.getSheetByName('Turning_Tooling');
    } else {
      // Search in main sheet
      targetSheet = dataSs.getSheetByName(sheetName);
    }

    if (!targetSheet) {
      return { success: false, error: `Sheet not found: ${sheetName}` };
    }

    // Get sheet data
    const data = targetSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, suggestions: [] }; // No data rows
    }

    const headers = data.shift().map(h => String(h).trim());

    // Find field column index
    const fieldIndex = headers.indexOf(targetFieldName);
    if (fieldIndex === -1) {
      return { success: false, error: `Field '${targetFieldName}' not found in sheet` };
    }

    // Extract values from the field column
    const values = data.map(row => String(row[fieldIndex]).trim())
      .filter(val => val !== ''); // Remove empty values

    // Get distinct values
    const distinctValues = [...new Set(values)];

    // Filter by search term (case-insensitive partial match)
    const searchLower = String(searchTerm).toLowerCase().trim();
    let filtered = distinctValues;

    if (searchLower !== '') {
      filtered = distinctValues.filter(val =>
        String(val).toLowerCase().includes(searchLower)
      );
    }

    // Sort alphabetically
    filtered.sort((a, b) => String(a).localeCompare(String(b)));

    // Limit results
    const limited = filtered.slice(0, limit);

    Logger.log(`[getFieldSuggestions] Sheet=${sheetName}, Field=${fieldName}, Found ${limited.length} suggestions`);

    return {
      success: true,
      suggestions: limited
    };

  } catch (e) {
    Logger.log(`getFieldSuggestions Error: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message
    };
  }
}