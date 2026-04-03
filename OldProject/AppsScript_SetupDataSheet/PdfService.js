// ================================================================= //
//                      PDF EXPORT SYSTEM                          //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - PDF Service Module
 * Handles PDF generation and export functionality
 */

/**
 * [OPTIMIZED] Export sheet data as PDF with formatted stamps.
 * This version no longer copies the entire file, which is slow.
 * It now copies the template *sheet* within the template file,
 * which is significantly faster.
 * @param {Object} params - Export parameters
 * @returns {Object} Success status and PDF data
 */
function exportSheetAsPdf(params) {

  // [DEBUG] Log all parameters received
  Logger.log(`[exportSheetAsPdf] Received params:`);
  Logger.log(`  sheetName: ${params.sheetName}`);
  Logger.log(`  cn: ${params.cn}`);
  Logger.log(`  process_code: ${params.process_code}`);
  Logger.log(`  rev: ${params.rev}`);
  Logger.log(`  machine: ${params.machine}`);

  // [PDF CACHE] Check cache first
  try {
    const cached = getCachedPdf(params.cn, params.process_code, params.rev, params.machine, params.sheetName);
    if (cached) {
      Logger.log(`[exportSheetAsPdf] Returning cached PDF for CN=${params.cn}`);
      return cached;
    }
  } catch (cacheErr) {
    Logger.log(`[exportSheetAsPdf] Cache check failed, generating fresh: ${cacheErr.message}`);
  }

  // [RETRY] Retry for transient "Service Spreadsheets failed" errors
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  let tempSheet = null;
  let tempSsFile = null; // Temporary spreadsheet file for PDF generation
  try {
    // Get template mapping
    const mappingRow = getMapping(params.sheetName);
const templateName = mappingRow[1];

    // Get the original template sheet from the template spreadsheet
    const originalTemplateSheet = getTemplateSs().getSheetByName(templateName);
    if (!originalTemplateSheet) {
      throw new Error(`Template sheet '${templateName}' not found in Template file.`);
    }

    // [FIX] Create a temporary spreadsheet file and copy the template sheet into it.
    // This avoids modifying the template file (which causes "Service Spreadsheets failed"
    // after heavy batch usage due to accumulated copy/delete operations).
    tempSsFile = SpreadsheetApp.create(`SDS_Temp_PDF_${params.cn}_${Date.now()}`);
    tempSheet = originalTemplateSheet.copyTo(tempSsFile);
    tempSheet.setName(templateName);
    tempSheet.showSheet(); // Must show BEFORE deleting default sheet

    // Remove default "Sheet1" from temp file
    const defaultSheets = tempSsFile.getSheets();
    for (let s = 0; s < defaultSheets.length; s++) {
      if (defaultSheets[s].getSheetId() !== tempSheet.getSheetId()) {
        tempSsFile.deleteSheet(defaultSheets[s]);
      }
    }
    
    // Get data for template population
    const dataResult = getDataByCnAndProcessCode(params.sheetName, params.cn, params.process_code, params.rev, params.machine);
if (!dataResult.success) throw new Error(dataResult.error);
    let data = dataResult.data;

    // [NEW] Get ECN data from RevisionHistory (single source of truth)
    // ECN data is no longer stored in main sheet to eliminate redundancy
    if (data.Setup_Data_Sheet_REV && data.Setup_Data_Sheet_REV !== 'NC' && data.Setup_Data_Sheet_REV !== '') {
      try {
        const ecnResult = getRevisionHistory(data.CN, data.Process_Code);
        if (ecnResult.success && ecnResult.revisions && ecnResult.revisions.length > 0) {
          const currentEcn = ecnResult.revisions.find(
            r => String(r.REV).trim() === String(data.Setup_Data_Sheet_REV).trim()
          );
          if (currentEcn) {
            // [NEW] Format ECN_Date to display date only (YYYY-MM-DD), not timestamp
            let ecnDateFormatted = '';
            if (currentEcn.ECN_Date) {
              try {
                const ecnDate = new Date(currentEcn.ECN_Date);
                if (!isNaN(ecnDate.getTime())) {
                  ecnDateFormatted = Utilities.formatDate(ecnDate, "GMT+7", "yyyy-MM-dd");
                } else {
                  ecnDateFormatted = String(currentEcn.ECN_Date); // Fallback to raw value
                }
              } catch (e) {
                ecnDateFormatted = String(currentEcn.ECN_Date); // Fallback to raw value
              }
            }

            data.ECN_Date = ecnDateFormatted;
            data.ECN_NO = currentEcn.ECN_NO || '';
            data.DESCRIPTION = currentEcn.DESCRIPTION || '';
            data.REMARK = currentEcn.REMARK || '';
            data.REV = currentEcn.REV || '';
            Logger.log(`[PDF Export] ECN data loaded from RevisionHistory: ECN_NO=${data.ECN_NO}, Date=${data.ECN_Date}`);
          } else {
            Logger.log(`[PDF Export] Warning: No ECN found in RevisionHistory for REV=${data.Setup_Data_Sheet_REV}`);
            data.REV = '';
          }
        } else {
          Logger.log(`[PDF Export] Warning: RevisionHistory not found or empty`);
          data.REV = '';
        }
      } catch (e) {
        Logger.log(`[PDF Export] Error loading ECN from RevisionHistory: ${e.message}`);
        data.REV = '';
      }
    } else {
      // No ECN for NC or empty revision
      data.REV = '';
      data.ECN_Date = '';
      data.ECN_NO = '';
      data.DESCRIPTION = '';
      data.REMARK = '';
    }

    Logger.log(`[PDF Export] Setup_Data_Sheet_REV: ${data.Setup_Data_Sheet_REV}, REV (for ECN): ${data.REV}`);

    // [NEW] Merge tooling data into flat format for template placeholders
    let toolingData = [];

    Logger.log(`[PDF Export] Tooling data check: dataResult.tooling exists=${!!dataResult.tooling}, length=${dataResult.tooling ? dataResult.tooling.length : 0}`);

    if (dataResult.tooling && dataResult.tooling.length > 0) {
      toolingData = dataResult.tooling; // Store for later use
      Logger.log(`[PDF Export] Tooling data received: ${JSON.stringify(dataResult.tooling[0])}`); // Show first tool

      // Determine machine type and use appropriate converter
      const machineType = MACHINE_TYPE_MAP[params.sheetName] || 'grinding';

      if (machineType === 'turning') {
        data = convertTurningToolingToFlat(data, dataResult.tooling);
        Logger.log(`Merged ${dataResult.tooling.length} turning tools into template data`);
      } else {
        data = convertToolingToFlat(data, dataResult.tooling);
        Logger.log(`Merged ${dataResult.tooling.length} grinding tools into template data`);
      }
    } else {
      Logger.log(`[PDF Export] ⚠️ WARNING: No tooling data found! Placeholders will not be replaced.`);
    }

    // [FIXED] Replace template placeholders with actual data - Cell-by-Cell Mode
    // This fixes "Service error: Spreadsheets" when using batch setValues()
    const dataRange = tempSheet.getDataRange();
    const values = dataRange.getValues();

    let replacementCount = 0;

    // Replace placeholders cell by cell to avoid Service error
    for (let row = 0; row < values.length; row++) {
      for (let col = 0; col < values[row].length; col++) {
        const cell = values[row][col];

        if (typeof cell === 'string' && cell.includes('{{')) {
          const newValue = cell.replace(/{{(.*?)}}/g, (match, key) => {
            const value = data[key.trim()];
            if (value !== undefined && value !== null) {
              replacementCount++;
              return String(value); // Force to string to avoid type issues
            }
            return '';
          });

          if (newValue !== cell) {
            // Set value cell by cell
            tempSheet.getRange(row + 1, col + 1).setValue(newValue);
          }
        }
      }
    }

    Logger.log(`[PDF Export] Replaced ${replacementCount} placeholders using cell-by-cell mode`);

    // [NEW] Apply tool images for TURNING templates
    const machineType = MACHINE_TYPE_MAP[params.sheetName] || 'grinding';
    if (machineType === 'turning' && toolingData.length > 0) {
      Logger.log('\n[PDF Export] Applying tool images...');
      applyTurningToolImages(tempSheet, data, toolingData);
    }

    // [NEW] Apply cutting layout for TURNING templates
    if (machineType === 'turning') {
      Logger.log('\n[PDF Export] Applying cutting layout...');
      applyCuttingLayout(tempSheet, data, params.sheetName);
    }

    // [NEW] Apply grinding layout for GRINDING templates
    if (machineType === 'grinding') {
      Logger.log('\n[PDF Export] Applying grinding layout...');
      applyGrindingLayout(tempSheet, data, params.sheetName);
    }

// Apply approval stamps
    applyApprovalStamps(tempSheet, data);
    
    // [OPTIMIZED] Removed Utilities.sleep(3000)
    // We use SpreadsheetApp.flush() instead to ensure all changes are saved
    // before we attempt to export.
    SpreadsheetApp.flush();
// Allow time for rendering (This comment is from old code, flush() handles it)
    
    // Export as PDF from the temporary spreadsheet file
    const pdfBlob = exportSheetToPdf(tempSsFile.getId(), tempSheet, data, params);

    // FIX: Post-generation cache check to prevent race condition.
    // Check if another process has cached a PDF while this one was generating.
    try {
      const raceConditionCheck = getCachedPdf(params.cn, params.process_code, params.rev, params.machine, params.sheetName);
      if (raceConditionCheck) {
        Logger.log(`[PDF Race Condition] Detected a newer PDF in cache after generation. Discarding generated PDF and returning cached version.`);
        return raceConditionCheck; // Return the newer PDF from cache
      }
    } catch (raceErr) {
      Logger.log(`[PDF Race Condition] Post-generation cache check failed: ${raceErr.message}`);
    }
    // End of FIX

    const pdfData = Utilities.base64Encode(pdfBlob.getBytes());

    // [PDF CACHE] Save to cache for next time
    try {
      savePdfToCache(params.cn, params.process_code, params.rev, params.machine, params.sheetName, pdfBlob);
    } catch (cacheErr) {
      Logger.log(`[exportSheetAsPdf] Failed to save to cache: ${cacheErr.message}`);
    }

    return {
      success: true,
      pdfData: pdfData,
      fileName: pdfBlob.getName()
    };
} catch (e) {
    lastError = e;
    Logger.log(`[exportSheetAsPdf] Attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}`);

    // Check if this is a retryable transient error
    if (attempt < MAX_RETRIES && _isRetryableSpreadsheetError(e)) {
      Logger.log(`[exportSheetAsPdf] Retrying after ${attempt * 2}s...`);
      _templateSs = null; // Force fresh connection on retry
      Utilities.sleep(attempt * 2000);
      continue;
    }

    // Non-retryable or last attempt — return error
    return { success: false, error: e.message };
} finally {
    // Clean up the temporary spreadsheet file
    if (tempSsFile) {
      try {
        DriveApp.getFileById(tempSsFile.getId()).setTrashed(true);
        Logger.log(`[PDF] Temp file deleted: ${tempSsFile.getId()}`);
} catch (err) {
        Logger.log('Failed to delete temp file: ' + err);
}
    }
  }
  } // end retry loop

  // All retries exhausted
  Logger.log(`[exportSheetAsPdf] All ${MAX_RETRIES} attempts failed.`);
  return { success: false, error: lastError ? lastError.message : 'PDF generation failed after retries' };
}

/**
 * Get template mapping for a sheet
 * @param {string} sheetName - Sheet name
 * @returns {Array} Mapping row
 */
function getMapping(sheetName) {
  const mappingSheet = getTemplateSs().getSheetByName('_Mapping');
if (!mappingSheet) {
    throw new Error("Cannot find '_Mapping' sheet in Template file.");
}
  
  const mappingData = mappingSheet.getRange("A2:B" + mappingSheet.getLastRow()).getValues();
  const mappingRow = mappingData.find(row => row[0] === sheetName);
if (!mappingRow) {
    throw new Error(`No template mapping found for '${sheetName}'. (Check _Mapping sheet for this exact name)`);
}
  
  return mappingRow;
}

/**
 * Apply approval stamps to PDF template
 * @param {Sheet} tempSheet - Temporary sheet object
 * @param {Object} data - Data object containing approval information
 */
function applyApprovalStamps(tempSheet, data) {
  const stampCellLocations = { 
    prepared: 'AN4', 
    checked: 'AQ4', 
    approved: 'AT4' 
  };
const authSheet = dataSs.getSheetByName('AuthorizedUsers');
  const authData = authSheet ? authSheet.getDataRange().getValues() : [];
/**
   * Get department by email from authorized users
   * @param {string} email - User email
   * @returns {string} Department name
   */
  const getDeptByEmail = (email) => {
    if (!email) return 'N/A';
const userRow = authData.find(row => row[0] === email);
    return userRow ? userRow[2] : 'N/A';
  };
/**
   * Apply individual stamp for a role
   * @param {string} status - Role status (prepared/checked/approved)
   * @param {string} userEmail - User email
   * @param {string} userDate - Approval date
   */
  const applyStamp = (status, userEmail, userDate) => {
    const location = stampCellLocations[status];
if (!location || !userEmail || !userDate) return;
    
    const dept = getDeptByEmail(userEmail);
    let date = Utilities.formatDate(new Date(userDate), "GMT+7", "dd MMM yyyy");
// Format month to uppercase
    try {
      const dateParts = date.split(' ');
if (dateParts.length === 3) {
        dateParts[1] = dateParts[1].toUpperCase();
        date = dateParts.join(' ');
}
    } catch (e) { 
      Logger.log('Could not parse date for uppercase month: ' + e);
}
    
    // Format name from email (Last.Initial)
    let name = '';
const emailPrefix = userEmail.split('@')[0];
    const nameParts = emailPrefix.split('.');
    if (nameParts.length >= 2) {
      const firstPart = nameParts[0].toUpperCase();
const secondPartInitial = nameParts[1].charAt(0).toUpperCase();
      name = `${secondPartInitial}.${firstPart}`;
    } else {
      name = emailPrefix.toUpperCase();
}
    
    const stampText = ` \n${date}\n${name}`;
tempSheet.getRange(location)
      .setValue(stampText)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setFontColor("#FF0000")
      .setFontSize(8);
};

  // Apply stamps for each approval role
  if (data.Prepared_By) applyStamp('prepared', data.Prepared_By, data.Prepared_Date);
  if (data.Checked_By) applyStamp('checked', data.Checked_By, data.Checked_Date);
if (data.Approved_By) applyStamp('approved', data.Approved_By, data.Approved_Date);
}

/**
 * [OPTIMIZED] Export sheet to PDF blob
 * @param {string} spreadsheetId - The ID of the *spreadsheet file* (now the template file)
 * @param {Sheet} tempSheet - Temporary sheet object (this contains the GID)
 * @param {Object} data - Data object
 * @param {Object} params - Export parameters
 * @returns {Blob} PDF blob
 */
function exportSheetToPdf(spreadsheetId, tempSheet, data, params) { // [OPTIMIZED] Changed 'tempFileId' to 'spreadsheetId' for clarity
  const marginParams = '&top_margin=0.20&bottom_margin=0.20&left_margin=0.20&right_margin=0.20';
const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` // Use the main spreadsheet ID
                  + `format=pdf&gid=${tempSheet.getSheetId()}` // Use the GID of the temp sheet
                  + `&size=a4&portrait=false&scale=4`
                  + `&gridlines=false&printtitle=false&sheetnames=false`
                  + marginParams;
const oauthToken = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(exportUrl, { 
    headers: { Authorization: 'Bearer ' + oauthToken }, 
    muteHttpExceptions: true 
  });
const responseCode = response.getResponseCode();
  if (responseCode !== 200) { 
    throw new Error(`Failed to export PDF. HTTP code: ${responseCode}`);
}
  
  const process = data.Process || '';
  const newFileName = `${params.cn}-${params.process_code || ''}-${process}.pdf`;
  return response.getBlob().setName(newFileName);
}

// ================================================================= //
//                  BATCH PDF CACHE GENERATION                       //
// ================================================================= //

/**
 * Batch generate PDF cache - processes a batch of items per invocation
 * Uses PropertiesService to track progress across trigger invocations
 * Generates 2 PDFs per run to stay within 30s Apps Script limit
 * @returns {Object} Status with progress information
 */
function batchGeneratePdfCache() {
  const props = PropertiesService.getScriptProperties();
  const BATCH_SIZE = 2; // PDFs per run (keep within 30s limit)

  try {
    // Read MasterSearchIndex for all rows
    const indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
    if (!indexSheet) {
      throw new Error('MasterSearchIndex not found.');
    }

    const data = indexSheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());

    const cnIdx = headers.indexOf('CN');
    const pcIdx = headers.indexOf('Process_Code');
    const revIdx = headers.indexOf('Setup_Data_Sheet_REV');
    const machineIdx = headers.indexOf('Machine');
    const tableIdx = headers.indexOf('actual_table');

    if (cnIdx === -1 || tableIdx === -1) {
      throw new Error('Required columns not found in MasterSearchIndex.');
    }

    // Build list of all items to process
    const allItems = data
      .filter(row => String(row[cnIdx]).trim() !== '')
      .map(row => ({
        cn: String(row[cnIdx]).trim(),
        processCode: pcIdx > -1 ? String(row[pcIdx]).trim() : '',
        rev: revIdx > -1 ? String(row[revIdx]).trim() : 'NC',
        machine: machineIdx > -1 ? String(row[machineIdx]).trim() : '',
        sheetName: String(row[tableIdx]).trim()
      }));

    const totalItems = allItems.length;
    const lastIndex = parseInt(props.getProperty('pdf_batch_index') || '0', 10);

    // Check which ones already have cached PDFs, starting from lastIndex
    const folder = getPdfCacheFolder();
    let generated = 0;
    let currentIndex = lastIndex;

    for (let i = lastIndex; i < totalItems && generated < BATCH_SIZE; i++) {
      const item = allItems[i];
      const fileName = buildPdfCacheFileName(item.cn, item.processCode, item.rev, item.machine, item.sheetName);

      // Check if already cached
      const existingFiles = folder.getFilesByName(fileName);
      if (existingFiles.hasNext()) {
        currentIndex = i + 1;
        continue; // Already cached, skip
      }

      // Generate PDF
      try {
        Logger.log(`[Batch PDF] Generating ${i + 1}/${totalItems}: ${fileName}`);
        const result = exportSheetAsPdf({
          sheetName: item.sheetName,
          cn: item.cn,
          process_code: item.processCode,
          rev: item.rev,
          machine: item.machine
        });
        if (result && result.success) {
          generated++;
        } else {
          Logger.log(`[Batch PDF] Failed: ${fileName} — ${result ? result.error : 'No result'}`);
        }
      } catch (genErr) {
        Logger.log(`[Batch PDF] Error generating ${fileName}: ${genErr.message}`);
      }

      currentIndex = i + 1;
    }

    // Save progress
    props.setProperty('pdf_batch_index', String(currentIndex));

    // Count total cached (approximate from current index)
    const isComplete = currentIndex >= totalItems;

    if (isComplete) {
      // Reset index for next batch run
      props.deleteProperty('pdf_batch_index');
      stopBatchPdfGeneration();
      Logger.log(`[Batch PDF] COMPLETE: All ${totalItems} items processed.`);
    }

    return {
      success: true,
      processed: currentIndex,
      total: totalItems,
      generatedThisRun: generated,
      isComplete: isComplete,
      message: isComplete
        ? `Batch PDF generation complete. ${totalItems} items processed.`
        : `Progress: ${currentIndex}/${totalItems} (generated ${generated} this run)`
    };

  } catch (e) {
    Logger.log(`[Batch PDF] Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Start batch PDF generation by creating a time-based trigger
 * Runs batchGeneratePdfCache every 1 minute
 * @returns {Object} Status
 */
function startBatchPdfGeneration() {
  try {
    // Stop any existing triggers first
    stopBatchPdfGeneration();

    // Reset progress
    const props = PropertiesService.getScriptProperties();
    props.setProperty('pdf_batch_index', '0');

    // Create trigger to run every 1 minute
    ScriptApp.newTrigger('batchGeneratePdfCache')
      .timeBased()
      .everyMinutes(1)
      .create();

    Logger.log('[Batch PDF] Started batch generation trigger (every 1 minute)');
    return { success: true, message: 'Batch PDF generation started.' };

  } catch (e) {
    Logger.log(`[Batch PDF] Error starting batch: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Stop batch PDF generation by deleting the trigger
 * @returns {Object} Status
 */
function stopBatchPdfGeneration() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deleted = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'batchGeneratePdfCache') {
        ScriptApp.deleteTrigger(trigger);
        deleted++;
      }
    });

    // Clear progress
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('pdf_batch_index');

    Logger.log(`[Batch PDF] Stopped batch generation (${deleted} trigger(s) deleted)`);
    return { success: true, message: `Batch generation stopped. ${deleted} trigger(s) removed.` };

  } catch (e) {
    Logger.log(`[Batch PDF] Error stopping batch: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get batch PDF generation progress
 * @returns {Object} Progress status (processed/total/percentage)
 */
function getBatchPdfStatus() {
  try {
    const props = PropertiesService.getScriptProperties();
    const lastIndex = parseInt(props.getProperty('pdf_batch_index') || '0', 10);

    // Check if trigger is running
    const triggers = ScriptApp.getProjectTriggers();
    const isRunning = triggers.some(t => t.getHandlerFunction() === 'batchGeneratePdfCache');

    // Get total items from MasterSearchIndex
    const indexSheet = dataSs.getSheetByName(MASTER_INDEX_SHEET);
    let totalItems = 0;
    if (indexSheet) {
      totalItems = Math.max(0, indexSheet.getLastRow() - 1); // Subtract header row
    }

    const percentage = totalItems > 0 ? Math.round((lastIndex / totalItems) * 100) : 0;

    return {
      success: true,
      isRunning: isRunning,
      processed: lastIndex,
      total: totalItems,
      percentage: percentage,
      message: isRunning
        ? `Generating PDFs: ${lastIndex}/${totalItems} (${percentage}%)`
        : (lastIndex > 0 && lastIndex >= totalItems)
          ? `Complete: ${totalItems}/${totalItems} (100%)`
          : 'Not running'
    };

  } catch (e) {
    Logger.log(`[Batch PDF] Error getting status: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ================================================================= //
//                    HELPER & UTILITY FUNCTIONS                      //
// ================================================================= //

/**
 * Check if an error is a transient Spreadsheets service error
 * that can be resolved by retrying with a fresh connection
 * @param {Error} e - Error object
 * @returns {boolean} True if the error is retryable
 */
function _isRetryableSpreadsheetError(e) {
  const msg = (e && e.message) ? e.message.toLowerCase() : '';
  return msg.includes('service spreadsheets failed') ||
         msg.includes('service error') ||
         msg.includes('server error') ||
         msg.includes('internal error') ||
         msg.includes('temporarily unavailable');
}

/**
 * Clean up any leftover temporary PDF sheets from the template file
 * Run this manually if batch generation was interrupted
 * @returns {Object} Cleanup results
 */
function cleanupTempSheets() {
  try {
    const ss = getTemplateSs(true); // Force fresh connection
    const sheets = ss.getSheets();
    let deleted = 0;

    sheets.forEach(sheet => {
      if (sheet.getName().startsWith('Temp_PDF_')) {
        try {
          ss.deleteSheet(sheet);
          deleted++;
          Logger.log(`[Cleanup] Deleted temp sheet: ${sheet.getName()}`);
        } catch (err) {
          Logger.log(`[Cleanup] Failed to delete ${sheet.getName()}: ${err.message}`);
        }
      }
    });

    Logger.log(`[Cleanup] Done. Deleted ${deleted} temp sheet(s).`);
    return { success: true, deleted: deleted };

  } catch (e) {
    Logger.log(`[Cleanup] Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}