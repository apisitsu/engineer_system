// ================================================================= //
//            ADD TOOLING PLACEHOLDER COLUMNS TO TEMPLATES         //
// ================================================================= //

/**
 * Add tooling placeholder columns to template sheets
 * These columns allow forms to show tooling fields
 * but actual tooling data is saved to separate Grinding_Tooling/Turning_Tooling sheets
 */

/**
 * Add tooling placeholder columns for Grinding sheets
 * @param {string} sheetName - Sheet name (e.g., 'SPG_ks400b1')
 * @param {number} maxTools - Maximum number of tools (default 12)
 */
function addGrindingToolingPlaceholders(sheetName, maxTools = 12) {
  try {
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const existingHeaders = headers.map(h => String(h).trim());

    // Define grinding tooling columns (lowercase with underscore pattern)
    const toolingColumns = [];

    for (let i = 1; i <= maxTools; i++) {
      const num = String(i).padStart(2, '0'); // 01, 02, ..., 12

      // Check if columns don't already exist
      if (!existingHeaders.includes(`tooling_no_${num}`)) {
        toolingColumns.push(`tooling_no_${num}`);
      }
      if (!existingHeaders.includes(`no_${num}_maker`)) {
        toolingColumns.push(`no_${num}_maker`);
      }
      if (!existingHeaders.includes(`tool_type_${num}`)) {
        toolingColumns.push(`tool_type_${num}`);
      }
      if (!existingHeaders.includes(`grinding_wheel_spec_${num}`)) {
        toolingColumns.push(`grinding_wheel_spec_${num}`);
      }
    }

    if (toolingColumns.length === 0) {
      Logger.log(`[${sheetName}] All grinding tooling columns already exist`);
      return { success: true, message: 'Columns already exist', added: 0 };
    }

    // Add new columns at the end
    const lastCol = sheet.getLastColumn();

    toolingColumns.forEach((colName, index) => {
      const newColIndex = lastCol + index + 1;
      sheet.insertColumnAfter(lastCol + index);
      sheet.getRange(1, newColIndex).setValue(colName);
    });

    Logger.log(`[${sheetName}] Added ${toolingColumns.length} grinding tooling placeholder columns`);

    return {
      success: true,
      message: `Added ${toolingColumns.length} tooling columns`,
      added: toolingColumns.length
    };

  } catch (e) {
    Logger.log(`Error adding grinding tooling placeholders to ${sheetName}: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Add tooling placeholder columns for Turning sheets
 * @param {string} sheetName - Sheet name (e.g., 'Turn_bfd')
 * @param {number} maxTools - Maximum number of tools (default 12)
 */
function addTurningToolingPlaceholders(sheetName, maxTools = 12) {
  try {
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const existingHeaders = headers.map(h => String(h).trim());

    // Define turning tooling columns (CamelCase with underscore pattern)
    const toolingColumns = [];

    for (let i = 1; i <= maxTools; i++) {
      const fieldNames = [
        `Tool_Name_${i}`,
        `Tool_Number_${i}`,
        `Insert_Info_${i}`,
        `Insert_I_${i}`,
        `Insert_E_${i}`,
        `Insert_Maker_${i}`,
        `Holder_Info_${i}`,
        `Holder_Maker_${i}`,
        `Overhang_${i}`,
        `H_Width_${i}`,
        `Rotation_${i}`,
        `F_${i}`,
        `AP_${i}`,
        `Nose_R_${i}`,
        `Unaged_${i}`
      ];

      fieldNames.forEach(fieldName => {
        if (!existingHeaders.includes(fieldName)) {
          toolingColumns.push(fieldName);
        }
      });
    }

    if (toolingColumns.length === 0) {
      Logger.log(`[${sheetName}] All turning tooling columns already exist`);
      return { success: true, message: 'Columns already exist', added: 0 };
    }

    // Add new columns at the end
    const lastCol = sheet.getLastColumn();

    toolingColumns.forEach((colName, index) => {
      const newColIndex = lastCol + index + 1;
      sheet.insertColumnAfter(lastCol + index);
      sheet.getRange(1, newColIndex).setValue(colName);
    });

    Logger.log(`[${sheetName}] Added ${toolingColumns.length} turning tooling placeholder columns`);

    return {
      success: true,
      message: `Added ${toolingColumns.length} tooling columns`,
      added: toolingColumns.length
    };

  } catch (e) {
    Logger.log(`Error adding turning tooling placeholders to ${sheetName}: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Add tooling placeholders to all configured sheets
 * Run this once to set up all template sheets
 */
function addToolingPlaceholdersToAllSheets() {
  Logger.log('========================================');
  Logger.log('  ADDING TOOLING PLACEHOLDERS');
  Logger.log('========================================\n');

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  try {
    // Process each sheet based on machine type
    for (const sheetName in MACHINE_TYPE_MAP) {
      const machineType = MACHINE_TYPE_MAP[sheetName];

      Logger.log(`Processing: ${sheetName} (${machineType})`);

      let result;
      if (machineType === 'grinding') {
        result = addGrindingToolingPlaceholders(sheetName);
      } else if (machineType === 'turning') {
        result = addTurningToolingPlaceholders(sheetName);
      } else {
        Logger.log(`  ⚠ Unknown machine type: ${machineType}\n`);
        results.skipped.push(sheetName);
        continue;
      }

      if (result.success) {
        if (result.added > 0) {
          Logger.log(`  ✓ Added ${result.added} columns\n`);
          results.success.push({ sheet: sheetName, added: result.added });
        } else {
          Logger.log(`  - Already has columns\n`);
          results.skipped.push(sheetName);
        }
      } else {
        Logger.log(`  ✗ Failed: ${result.error}\n`);
        results.failed.push({ sheet: sheetName, error: result.error });
      }
    }

    // Summary
    Logger.log('========================================');
    Logger.log('  SUMMARY');
    Logger.log('========================================');
    Logger.log(`Success: ${results.success.length} sheets`);
    Logger.log(`Skipped: ${results.skipped.length} sheets (already have columns)`);
    Logger.log(`Failed:  ${results.failed.length} sheets\n`);

    if (results.success.length > 0) {
      Logger.log('Successfully updated:');
      results.success.forEach(item => {
        Logger.log(`  - ${item.sheet}: ${item.added} columns added`);
      });
    }

    if (results.failed.length > 0) {
      Logger.log('\nFailed sheets:');
      results.failed.forEach(item => {
        Logger.log(`  - ${item.sheet}: ${item.error}`);
      });
    }

    return {
      success: true,
      results: results
    };

  } catch (e) {
    Logger.log(`\nError in addToolingPlaceholdersToAllSheets: ${e.message}`);
    return {
      success: false,
      error: e.message,
      results: results
    };
  }
}

/**
 * Add tooling placeholders to specific sheets only
 * @param {Array<string>} sheetNames - Array of sheet names
 */
function addToolingPlaceholdersToSpecificSheets(sheetNames) {
  Logger.log('========================================');
  Logger.log('  ADDING TOOLING PLACEHOLDERS');
  Logger.log('  (Specific Sheets)');
  Logger.log('========================================\n');

  const results = [];

  sheetNames.forEach(sheetName => {
    const machineType = MACHINE_TYPE_MAP[sheetName];

    if (!machineType) {
      Logger.log(`[${sheetName}] Not configured in MACHINE_TYPE_MAP, skipping\n`);
      results.push({ sheet: sheetName, success: false, error: 'Not configured' });
      return;
    }

    Logger.log(`Processing: ${sheetName} (${machineType})`);

    let result;
    if (machineType === 'grinding') {
      result = addGrindingToolingPlaceholders(sheetName);
    } else if (machineType === 'turning') {
      result = addTurningToolingPlaceholders(sheetName);
    }

    results.push({
      sheet: sheetName,
      success: result.success,
      added: result.added,
      error: result.error
    });

    if (result.success && result.added > 0) {
      Logger.log(`  ✓ Added ${result.added} columns\n`);
    } else if (result.success && result.added === 0) {
      Logger.log(`  - Already has columns\n`);
    } else {
      Logger.log(`  ✗ Failed: ${result.error}\n`);
    }
  });

  return { success: true, results: results };
}

/**
 * TEST: Check if a sheet has tooling columns
 * @param {string} sheetName - Sheet name to check
 */
function checkToolingColumns(sheetName) {
  try {
    const sheet = dataSs.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const machineType = MACHINE_TYPE_MAP[sheetName];

    Logger.log(`Sheet: ${sheetName}`);
    Logger.log(`Machine Type: ${machineType}`);
    Logger.log(`Total Columns: ${headers.length}\n`);

    let toolingHeaders;
    if (machineType === 'grinding') {
      toolingHeaders = headers.filter(h => /^(tooling_no|no_\d+_maker|tool_type|grinding_wheel_spec)_\d+$/i.test(h));
    } else if (machineType === 'turning') {
      toolingHeaders = headers.filter(h => /^(Tool_Name|Tool_Number|Insert_Info|Insert_I|Insert_E|Insert_Maker|Holder_Info|Holder_Maker|Overhang|H_Width|Rotation|F|AP|Nose_R|Unaged)_\d+$/i.test(h));
    }

    if (toolingHeaders && toolingHeaders.length > 0) {
      Logger.log(`✓ Has ${toolingHeaders.length} tooling columns:`);
      Logger.log(`  First few: ${toolingHeaders.slice(0, 5).join(', ')}`);
      return { success: true, hasTooling: true, count: toolingHeaders.length };
    } else {
      Logger.log(`✗ No tooling columns found`);
      return { success: true, hasTooling: false, count: 0 };
    }

  } catch (e) {
    Logger.log(`Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}
