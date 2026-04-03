// ================================================================= //
//                    FORM GENERATION HELPER                        //
// ================================================================= //

/**
 * Get combined headers for form generation
 * Combines main sheet headers + tooling sheet headers
 *
 * This allows forms to show tooling fields without having tooling columns in main sheet
 *
 * @param {string} sheetName - Main sheet name (e.g., 'SPG_ks400b1')
 * @param {Object} options - Optional parameters
 * @param {string} options.mode - Form mode: 'add' or 'edit' (default: 'edit')
 * @param {string} options.cn - Customer Number (for dynamic tooling count in edit mode)
 * @param {string} options.processCode - Process Code (for dynamic tooling count in edit mode)
 * @param {string} options.machine - Machine (for dynamic tooling count in edit mode)
 * @param {string} options.rev - Revision (for dynamic tooling count in edit mode)
 * @returns {Object} Success status and combined headers array
 */
function getFormHeaders(sheetName, options = {}) {
  try {
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found.`);
    }

    const mode = options.mode || 'edit'; // Default to 'edit' for backward compatibility

    // Get main sheet headers
    const mainHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Define system columns to exclude from form
    const excludedHeaders = [
      'Prepared_By', 'Prepared_Date',
      'Checked_By', 'Checked_Date',
      'Approved_By', 'Approved_Date'
    ];

    // Filter main headers
    const validMainHeaders = mainHeaders.filter(header => {
      return header && header.trim() !== '' && !excludedHeaders.includes(header.trim());
    });

    // Check if this sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(sheetName)) {
      // No tooling - return main headers only
      return {
        success: true,
        headers: validMainHeaders,
        mode: mode
      };
    }

    // === ADD MODE: Return main headers only (no tooling fields) ===
    if (mode === 'add') {
      Logger.log(`[getFormHeaders] ADD mode: ${sheetName} - returning ${validMainHeaders.length} main headers only (no tooling)`);
      return {
        success: true,
        headers: validMainHeaders,
        mode: 'add',
        mainHeadersCount: validMainHeaders.length,
        toolingHeadersCount: 0
      };
    }

    // === EDIT MODE: Return main + tooling headers ===
    // Determine machine type and tooling sheet
    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];

    if (!toolingSheetName) {
      Logger.log(`No tooling sheet configured for ${sheetName}, using main headers only`);
      return {
        success: true,
        headers: validMainHeaders,
        mode: mode
      };
    }

    // Determine tooling count for edit mode
    let maxTools = 12; // Default

    // For Edit mode: get actual tooling count if CN/ProcessCode provided
    if (options.cn && options.processCode) {
      const actualCount = getActualToolingCount(sheetName, options.cn, options.processCode, options.machine, options.rev);
      if (actualCount > 0) {
        maxTools = actualCount;
        Logger.log(`[getFormHeaders] EDIT mode: Using actual tooling count = ${actualCount}`);
      }
    }

    // Get tooling sheet structure
    const toolingHeaders = getToolingFormFields(machineType, maxTools);

    // Combine headers
    const combinedHeaders = [...validMainHeaders, ...toolingHeaders];

    Logger.log(`[getFormHeaders] EDIT mode: ${sheetName} - ${validMainHeaders.length} main + ${toolingHeaders.length} tooling = ${combinedHeaders.length} total`);

    return {
      success: true,
      headers: combinedHeaders,
      mode: 'edit',
      mainHeadersCount: validMainHeaders.length,
      toolingHeadersCount: toolingHeaders.length
    };

  } catch (e) {
    Logger.log(`getFormHeaders Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Get actual tooling count for a specific setup
 * Used for dynamic form generation in edit mode
 *
 * @param {string} sheetName - Main sheet name
 * @param {string} cn - Customer Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {number} Number of tooling records (0 if none)
 */
function getActualToolingCount(sheetName, cn, processCode, machine, rev) {
  try {
    if (!SHEETS_WITH_TOOLING.includes(sheetName)) {
      return 0;
    }

    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];
    const toolingSheet = dataSs.getSheetByName(toolingSheetName);

    if (!toolingSheet) {
      return 0;
    }

    const data = toolingSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 0; // No data rows
    }

    const headers = data.shift().map(h => String(h).trim());

    // Get column indices
    const sheetNameIdx = headers.indexOf('Sheet_Name');
    const cnIdx = headers.indexOf('CN');
    const processCodeIdx = headers.indexOf('Process_Code');
    const machineIdx = headers.indexOf('Machine');
    const revIdx = headers.indexOf('Setup_Data_Sheet_REV');

    // Count matching rows
    let count = 0;
    data.forEach(row => {
      const matchSheet = sheetNameIdx > -1 ? String(row[sheetNameIdx]) === sheetName : true;
      const matchCn = cnIdx > -1 ? String(row[cnIdx]) === String(cn) : true;
      const matchProcess = processCodeIdx > -1 ? String(row[processCodeIdx]) === String(processCode) : true;
      const matchMachine = machineIdx > -1 && machine ? String(row[machineIdx]) === String(machine) : true;
      const matchRev = revIdx > -1 && rev ? String(row[revIdx]) === String(rev) : true;

      if (matchSheet && matchCn && matchProcess && matchMachine && matchRev) {
        count++;
      }
    });

    Logger.log(`[getActualToolingCount] Found ${count} tools for CN=${cn}, ProcessCode=${processCode}, Machine=${machine}`);
    return count;

  } catch (e) {
    Logger.log(`getActualToolingCount Error: ${e.message}`);
    return 0;
  }
}

/**
 * Get tooling field names for forms based on machine type
 * @param {string} machineType - 'grinding' or 'turning'
 * @param {number} maxTools - Maximum number of tools (default 12)
 * @returns {Array<string>} Array of tooling field names
 */
function getToolingFormFields(machineType, maxTools = 12) {
  const fields = [];

  if (machineType === 'grinding') {
    // Grinding tooling fields (lowercase with underscore)
    // NOTE: Only tooling_no and maker fields (removed tool_type and grinding_wheel_spec)
    for (let i = 1; i <= maxTools; i++) {
      const num = String(i).padStart(2, '0'); // 01, 02, ..., 12
      fields.push(`tooling_no_${num}`);
      fields.push(`no_${num}_maker`);
    }
  } else if (machineType === 'turning') {
    // Turning tooling fields (CamelCase with underscore)
    for (let i = 1; i <= maxTools; i++) {
      fields.push(`Tool_Name_${i}`);
      fields.push(`Tool_Number_${i}`);
      fields.push(`Tool_Detail_${i}`);
      fields.push(`Insert_Info_${i}`);
      fields.push(`Insert_I_${i}`);
      fields.push(`Insert_E_${i}`);
      fields.push(`Insert_Maker_${i}`);
      fields.push(`Holder_Info_${i}`);
      fields.push(`Holder_Maker_${i}`);
      fields.push(`Hand_${i}`);
      fields.push(`Overhang_${i}`);
      fields.push(`H_Width_${i}`);
      fields.push(`Rotation_${i}`);
      fields.push(`F_${i}`);
      fields.push(`AP_${i}`);
      fields.push(`Nose_R_${i}`);
      fields.push(`Usaged_${i}`);
    }
  }

  return fields;
}

/**
 * Get data for edit form (combines main data + tooling data)
 * @param {string} sheetName - Main sheet name
 * @param {string} cn - Customer Number
 * @param {string} processCode - Process Code
 * @param {string} rev - Revision
 * @param {string} machine - Machine name
 * @returns {Object} Combined data object
 */
function getFormDataForEdit(sheetName, cn, processCode, rev, machine) {
  try {
    // Get main sheet data
    const mainDataResult = getDataByCnAndProcessCode(sheetName, cn, processCode, rev, machine);

    if (!mainDataResult.success) {
      return mainDataResult;
    }

    const combinedData = { ...mainDataResult.data };

    // Check if sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(sheetName)) {
      return {
        success: true,
        data: combinedData
      };
    }

    // Get tooling data
    const toolingArray = getToolingData(sheetName, cn, processCode, machine, rev);

    // Determine machine type
    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';

    // Convert tooling to flat format (only for actual tools that exist)
    let flatData;
    if (machineType === 'grinding') {
      flatData = convertToolingToFlat(combinedData, toolingArray);
    } else if (machineType === 'turning') {
      flatData = convertTurningToolingToFlat(combinedData, toolingArray);
    } else {
      flatData = combinedData;
    }

    Logger.log(`[getFormDataForEdit] Retrieved data for CN=${cn}, with ${toolingArray.length} tools (dynamic form fields)`);

    return {
      success: true,
      data: flatData,
      toolingCount: toolingArray.length
    };

  } catch (e) {
    Logger.log(`getFormDataForEdit Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Get tooling field metadata for Add Form
 * Returns field definitions for building dynamic tooling modal
 *
 * @param {string} sheetName - Main sheet name
 * @returns {Object} Field metadata including machine type, fields, and tool numbers
 */
function getToolingFieldsMetadata(sheetName) {
  try {
    // Check if sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(sheetName)) {
      return {
        success: true,
        hasTooling: false,
        message: 'This sheet does not support tooling'
      };
    }

    // Determine machine type
    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';

    // Generate tool numbers (T01 to T12)
    const toolNumbers = [];
    for (let i = 1; i <= 12; i++) {
      toolNumbers.push(String(i).padStart(2, '0'));
    }

    if (machineType === 'grinding') {
      return {
        success: true,
        hasTooling: true,
        machineType: 'grinding',
        fields: [
          {
            name: 'tooling_no',
            label: 'Tooling No',
            type: 'text',
            required: true,
            placeholder: 'e.g., T01, WA60K'
          },
          {
            name: 'maker',
            label: 'Maker',
            type: 'text',
            required: false,
            placeholder: 'e.g., NIKKEN, Sandvik'
          }
        ],
        toolNumbers: toolNumbers
      };
    } else if (machineType === 'turning') {
      return {
        success: true,
        hasTooling: true,
        machineType: 'turning',
        fields: [
          { name: 'Tool_Name', label: 'Tool Name', type: 'text', required: false, placeholder: 'Tool description' },
          { name: 'Insert_Info', label: 'Insert Info', type: 'text', required: false, placeholder: 'Insert specification' },
          { name: 'Insert_I', label: 'Insert I', type: 'text', required: false, placeholder: 'Insert I' },
          { name: 'Insert_E', label: 'Insert E', type: 'text', required: false, placeholder: 'Insert E' },
          { name: 'Insert_Maker', label: 'Insert Maker', type: 'text', required: false, placeholder: 'e.g., Sandvik, Kyocera' },
          { name: 'Holder_Info', label: 'Holder Info', type: 'text', required: false, placeholder: 'Holder specification' },
          { name: 'Holder_Maker', label: 'Holder Maker', type: 'text', required: false, placeholder: 'e.g., NIKKEN, MST' },
          { name: 'Hand', label: 'Hand', type: 'text', required: false, placeholder: 'L/R' },
          { name: 'Overhang', label: 'Overhang (mm)', type: 'text', required: false, placeholder: 'Overhang length' },
          { name: 'H_Width', label: 'H Width (mm)', type: 'text', required: false, placeholder: 'Width' },
          { name: 'Rotation', label: 'Rotation (RPM)', type: 'text', required: false, placeholder: 'Spindle speed' },
          { name: 'F', label: 'Feed (mm/rev)', type: 'text', required: false, placeholder: 'Feed rate' },
          { name: 'AP', label: 'Depth of Cut (mm)', type: 'text', required: false, placeholder: 'Cutting depth' },
          { name: 'Nose_R', label: 'Nose Radius (mm)', type: 'text', required: false, placeholder: 'Nose R' },
          { name: 'Usaged', label: 'Usaged', type: 'text', required: false, placeholder: 'Usaged spec' }
        ],
        toolNumbers: toolNumbers
      };
    } else {
      return {
        success: false,
        error: `Unknown machine type: ${machineType}`
      };
    }

  } catch (e) {
    Logger.log(`getToolingFieldsMetadata Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * TEST: Compare old vs new form headers
 * @param {string} sheetName - Sheet name to test
 */
function compareFormHeaders(sheetName) {
  Logger.log('========================================');
  Logger.log(`  FORM HEADERS COMPARISON: ${sheetName}`);
  Logger.log('========================================\n');

  // Old method (reads from main sheet only)
  const oldResult = getTemplateHeaders(sheetName);

  // New method (combines main + tooling)
  const newResult = getFormHeaders(sheetName);

  Logger.log('OLD METHOD (getTemplateHeaders):');
  Logger.log(`  Total headers: ${oldResult.headers.length}`);
  Logger.log(`  Sample: ${oldResult.headers.slice(0, 5).join(', ')}`);

  Logger.log('\nNEW METHOD (getFormHeaders):');
  Logger.log(`  Total headers: ${newResult.headers.length}`);
  Logger.log(`  Main headers: ${newResult.mainHeadersCount || 0}`);
  Logger.log(`  Tooling headers: ${newResult.toolingHeadersCount || 0}`);
  Logger.log(`  Sample main: ${newResult.headers.slice(0, 5).join(', ')}`);

  if (newResult.toolingHeadersCount > 0) {
    const toolingStart = newResult.mainHeadersCount;
    Logger.log(`  Sample tooling: ${newResult.headers.slice(toolingStart, toolingStart + 5).join(', ')}`);
  }

  Logger.log('\nDIFFERENCE:');
  const diff = newResult.headers.length - oldResult.headers.length;
  Logger.log(`  ${diff > 0 ? '+' : ''}${diff} headers`);

  return {
    old: oldResult,
    new: newResult,
    difference: diff
  };
}
