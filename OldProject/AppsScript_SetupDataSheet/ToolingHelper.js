// ================================================================= //
//                    TOOLING DATA HELPER FUNCTIONS                 //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Tooling Helper Module
 * Centralized functions for managing tooling data across sheets
 * Supports both Grinding_Tooling and Turning_Tooling architectures
 */

/**
 * Extract tooling data from form data
 * Separates tooling fields from main setup fields
 *
 * @param {Object} formData - Form data object
 * @param {string} sheetName - Main sheet name (to determine machine type)
 * @returns {Object} { setupData, toolingData }
 */
function extractToolingFromFormData(formData, sheetName) {
  try {
    const setupData = {};
    const toolingData = [];

    // Determine machine type
    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';

    if (machineType === 'grinding') {
      // === GRINDING: Horizontal format with numbered columns ===
      // Pattern: tooling_no_01, no_01_maker (removed tool_type and grinding_wheel_spec)

      const toolingNoPattern = /^tooling_no_(\d+)$/i;
      const makerPattern = /^no_(\d+)_maker$/i;
      const toolsByNumber = {}; // Group by tool number

      for (const key in formData) {
        let match = key.match(toolingNoPattern);
        let isMaker = false;

        if (!match) {
          match = key.match(makerPattern);
          isMaker = true;
        }

        if (match) {
          // This is a tooling field
          const toolNum = String(parseInt(match[1])).padStart(2, '0'); // Normalize: 1 → 01

          if (!toolsByNumber[toolNum]) {
            toolsByNumber[toolNum] = {
              Tool_Number: `T${toolNum}`
            };
          }

          // Map field to tooling sheet column
          if (isMaker) {
            toolsByNumber[toolNum].Maker = formData[key];
          } else {
            toolsByNumber[toolNum].Tooling_No = formData[key];
          }
        } else {
          // This is a setup field
          setupData[key] = formData[key];
        }
      }

      // Convert to array (only tools with data)
      for (const toolNum in toolsByNumber) {
        const tool = toolsByNumber[toolNum];
        // Only include tools that have at least Tooling_No
        if (tool.Tooling_No && String(tool.Tooling_No).trim() !== '') {
          toolingData.push(tool);
        }
      }

      Logger.log(`[extractToolingFromFormData] Extracted ${toolingData.length} grinding tools`);

    } else if (machineType === 'turning') {
      // === TURNING: Numbered fields for each tool position ===
      // Pattern: Tool_Name_1, Tool_Detail_1, Insert_Info_1, Holder_Info_1, Hand_1, Usaged_1, etc.

      const turningPattern = /^(Tool_Name|Tool_Number|Tool_Detail|Insert_Info|Insert_I|Insert_E|Insert_Maker|Holder_Info|Holder_Maker|Hand|Overhang|H_Width|Rotation|F|AP|Nose_R|Usaged)_(\d+)$/i;
      const toolsByNumber = {}; // Group by tool number

      for (const key in formData) {
        const match = key.match(turningPattern);

        if (match) {
          // This is a tooling field
          const fieldName = match[1]; // Field name without number
          const toolNum = parseInt(match[2]); // Tool position (1-12)

          if (!toolsByNumber[toolNum]) {
            toolsByNumber[toolNum] = {
              Tool_Number: String(toolNum).padStart(2, '0') // 1 → "01"
            };
          }

          // Store value with original field name
          toolsByNumber[toolNum][fieldName] = formData[key];
        } else {
          // This is a setup field
          setupData[key] = formData[key];
        }
      }

      // Convert to array (only tools with data)
      for (const toolNum in toolsByNumber) {
        const tool = toolsByNumber[toolNum];
        // Only include tools that have Tool_Name or Insert_Info
        if ((tool.Tool_Name && String(tool.Tool_Name).trim() !== '') ||
            (tool.Insert_Info && String(tool.Insert_Info).trim() !== '')) {
          toolingData.push(tool);
        }
      }

      Logger.log(`[extractToolingFromFormData] Extracted ${toolingData.length} turning tools`);

    } else {
      // Unknown machine type - no tooling extraction
      Logger.log(`[extractToolingFromFormData] Unknown machine type: ${machineType}, treating all as setup data`);
      for (const key in formData) {
        setupData[key] = formData[key];
      }
    }

    return {
      setupData: setupData,
      toolingData: toolingData
    };

  } catch (e) {
    Logger.log(`extractToolingFromFormData Error: ${e.message}`);
    Logger.log(e.stack);
    // Return all as setup data on error
    return {
      setupData: formData,
      toolingData: []
    };
  }
}

/**
 * Save tooling data to appropriate tooling sheet
 * Handles both grinding and turning formats
 *
 * @param {string} sheetName - Main sheet name
 * @param {string} cn - Customer Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @param {Array} toolingData - Array of tool objects
 * @returns {Object} Success status
 */
function saveToolingData(sheetName, cn, processCode, machine, rev, toolingData) {
  try {
    // Check if sheet has tooling
    if (!SHEETS_WITH_TOOLING.includes(sheetName)) {
      Logger.log(`[saveToolingData] Sheet '${sheetName}' does not have tooling, skipping`);
      return { success: true, message: 'No tooling to save' };
    }

    // Determine which tooling sheet to use
    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];

    if (!toolingSheetName) {
      throw new Error(`No tooling sheet configured for machine type '${machineType}'`);
    }

    const toolingSheet = dataSs.getSheetByName(toolingSheetName);
    if (!toolingSheet) {
      throw new Error(`Tooling sheet '${toolingSheetName}' not found`);
    }

    // Delete existing tooling for this setup first
    deleteToolingForSetup(toolingSheetName, sheetName, cn, processCode, machine, rev);

    // If no tooling data provided, we're done (just deleted old data)
    if (!toolingData || toolingData.length === 0) {
      Logger.log(`[saveToolingData] No tooling data to save`);
      return { success: true, message: 'Existing tooling deleted, no new tooling to save' };
    }

    // Get tooling sheet headers
    const toolingHeaders = toolingSheet.getRange(1, 1, 1, toolingSheet.getLastColumn())
      .getValues()[0].map(h => String(h).trim());

    // Prepare rows to insert
    let rowsInserted = 0;

    toolingData.forEach(tool => {
      const newRow = new Array(toolingHeaders.length).fill('');

      // Populate common identification columns
      const sheetNameIdx = toolingHeaders.indexOf('Sheet_Name');
      const cnIdx = toolingHeaders.indexOf('CN');
      const processCodeIdx = toolingHeaders.indexOf('Process_Code');
      const machineIdx = toolingHeaders.indexOf('Machine');
      const revIdx = toolingHeaders.indexOf('Setup_Data_Sheet_REV');
      const toolNumberIdx = toolingHeaders.indexOf('Tool_Number');

      if (sheetNameIdx > -1) newRow[sheetNameIdx] = sheetName;
      if (cnIdx > -1) newRow[cnIdx] = cn;
      if (processCodeIdx > -1) newRow[processCodeIdx] = processCode;
      if (machineIdx > -1) newRow[machineIdx] = machine || '';
      if (revIdx > -1) newRow[revIdx] = rev;
      if (toolNumberIdx > -1) newRow[toolNumberIdx] = tool.Tool_Number || '';

      // Populate tool-specific columns
      for (const key in tool) {
        if (key === 'Tool_Number') continue; // Already handled

        const colIdx = toolingHeaders.indexOf(key);
        if (colIdx > -1) {
          newRow[colIdx] = tool[key] || '';
        }
      }

      // Append row
      toolingSheet.appendRow(newRow);
      rowsInserted++;
    });

    Logger.log(`[saveToolingData] Saved ${rowsInserted} tools to ${toolingSheetName}`);

    return {
      success: true,
      message: `Saved ${rowsInserted} tools to ${toolingSheetName}`,
      rowsInserted: rowsInserted
    };

  } catch (e) {
    Logger.log(`saveToolingData Error: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Delete tooling data for a specific setup
 *
 * @param {string} toolingSheetName - Name of tooling sheet (Grinding_Tooling or Turning_Tooling)
 * @param {string} sheetName - Main sheet name
 * @param {string} cn - Customer Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {Object} Success status
 */
function deleteToolingForSetup(toolingSheetName, sheetName, cn, processCode, machine, rev) {
  try {
    const toolingSheet = dataSs.getSheetByName(toolingSheetName);
    if (!toolingSheet) {
      Logger.log(`[deleteToolingForSetup] Tooling sheet '${toolingSheetName}' not found`);
      return { success: true, message: 'Tooling sheet not found, nothing to delete' };
    }

    const data = toolingSheet.getDataRange().getValues();
    const headers = data.shift();

    // Get column indices
    const sheetNameIdx = headers.indexOf('Sheet_Name');
    const cnIdx = headers.indexOf('CN');
    const processCodeIdx = headers.indexOf('Process_Code');
    const machineIdx = headers.indexOf('Machine');
    const revIdx = headers.indexOf('Setup_Data_Sheet_REV');

    // Find rows to delete (in reverse order to avoid index shifting)
    const rowsToDelete = [];

    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const actualRowIndex = i + 2; // +2 because: +1 for 0-index, +1 for header row

      // Match criteria
      const matchSheet = sheetNameIdx > -1 ? String(row[sheetNameIdx]) === sheetName : true;
      const matchCn = cnIdx > -1 ? String(row[cnIdx]) === String(cn) : true;
      const matchProcess = processCodeIdx > -1 ? String(row[processCodeIdx]) === String(processCode) : true;
      const matchMachine = machineIdx > -1 && machine ? String(row[machineIdx]) === String(machine) : true;
      const matchRev = revIdx > -1 && rev ? String(row[revIdx]) === String(rev) : true;

      if (matchSheet && matchCn && matchProcess && matchMachine && matchRev) {
        rowsToDelete.push(actualRowIndex);
      }
    }

    // Delete rows
    rowsToDelete.forEach(rowIndex => {
      toolingSheet.deleteRow(rowIndex);
    });

    Logger.log(`[deleteToolingForSetup] Deleted ${rowsToDelete.length} tooling rows from ${toolingSheetName}`);

    return {
      success: true,
      message: `Deleted ${rowsToDelete.length} tooling rows`,
      rowsDeleted: rowsToDelete.length
    };

  } catch (e) {
    Logger.log(`deleteToolingForSetup Error: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Delete all tooling for a setup (convenience function)
 * Automatically determines correct tooling sheet
 *
 * @param {string} sheetName - Main sheet name
 * @param {string} cn - Customer Number
 * @param {string} processCode - Process Code
 * @param {string} machine - Machine name
 * @param {string} rev - Revision
 * @returns {Object} Success status
 */
function deleteAllToolingForSetup(sheetName, cn, processCode, machine, rev) {
  try {
    if (!SHEETS_WITH_TOOLING.includes(sheetName)) {
      Logger.log(`[deleteAllToolingForSetup] Sheet '${sheetName}' does not have tooling`);
      return { success: true, message: 'No tooling to delete' };
    }

    const machineType = MACHINE_TYPE_MAP[sheetName] || 'grinding';
    const toolingSheetName = TOOLING_SHEETS[machineType];

    if (!toolingSheetName) {
      throw new Error(`No tooling sheet configured for machine type '${machineType}'`);
    }

    return deleteToolingForSetup(toolingSheetName, sheetName, cn, processCode, machine, rev);

  } catch (e) {
    Logger.log(`deleteAllToolingForSetup Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}
